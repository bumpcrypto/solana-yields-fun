import { IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { DexScreenerProvider } from "../providers/dexScreenerProvider";
import { TokenPairEvaluator } from "../evaluators/tokenPairEvaluator";
import { RaydiumClmActions } from "../actions/raydiumClmActions";

interface MonitoredPool {
    baseAddress: string;
    quoteAddress: string;
    lastCheck: number;
    lastAnalysis: any;
    currentAmm: string;
}

export class PoolMonitorJob {
    private dexScreener: DexScreenerProvider;
    private evaluator: TokenPairEvaluator;
    private clmActions: RaydiumClmActions;
    private monitoredPools: Map<string, MonitoredPool>;
    private checkInterval: number = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.dexScreener = new DexScreenerProvider();
        this.evaluator = new TokenPairEvaluator();
        this.clmActions = new RaydiumClmActions();
        this.monitoredPools = new Map();
    }

    private getPoolKey(baseAddress: string, quoteAddress: string): string {
        return `${baseAddress.toLowerCase()}-${quoteAddress.toLowerCase()}`;
    }

    async addPoolToMonitor(baseAddress: string, quoteAddress: string) {
        const poolKey = this.getPoolKey(baseAddress, quoteAddress);

        if (!this.monitoredPools.has(poolKey)) {
            const initialAnalysis = await this.evaluator.evaluatePair(
                baseAddress,
                quoteAddress
            );

            this.monitoredPools.set(poolKey, {
                baseAddress,
                quoteAddress,
                lastCheck: Date.now(),
                lastAnalysis: initialAnalysis,
                currentAmm: initialAnalysis.recommendation.preferredAmm,
            });

            console.log(
                `Added pool to monitor with initial AMM: ${initialAnalysis.recommendation.preferredAmm}`
            );
            console.log(
                "AMM Scores:",
                initialAnalysis.recommendation.ammScores
            );
        }
    }

    async checkPool(poolKey: string, state?: State) {
        const pool = this.monitoredPools.get(poolKey);
        if (!pool) return;

        const now = Date.now();
        if (now - pool.lastCheck < this.checkInterval) return;

        const analysis = await this.evaluator.evaluatePair(
            pool.baseAddress,
            pool.quoteAddress
        );

        // Check if we need to switch AMMs
        if (analysis.recommendation.preferredAmm !== pool.currentAmm) {
            console.log(`AMM Switch needed for ${poolKey}`);
            console.log(
                `Current: ${pool.currentAmm} -> New: ${analysis.recommendation.preferredAmm}`
            );
            console.log("New AMM Scores:", analysis.recommendation.ammScores);

            // Remove liquidity from current AMM before switching
            if (pool.currentAmm === "raydium") {
                await this.clmActions.removeLiquidity(
                    pool.baseAddress,
                    pool.quoteAddress,
                    100
                );
            }
            // TODO: Add similar removal logic for other AMMs
        }

        // Update pool state
        pool.lastCheck = now;
        pool.lastAnalysis = analysis;
        pool.currentAmm = analysis.recommendation.preferredAmm;
        this.monitoredPools.set(poolKey, pool);

        // Store in global state
        if (state) {
            const monitoredPoolsState = state.get("monitoredPools") || {};
            monitoredPoolsState[poolKey] = pool;
            state.set("monitoredPools", monitoredPoolsState);
        }

        // Check if action is needed
        if (this.shouldAdjustPosition(pool.lastAnalysis, analysis)) {
            await this.adjustPosition(pool, analysis, state);
        }
    }

    private shouldAdjustPosition(oldAnalysis: any, newAnalysis: any): boolean {
        // Significant changes in metrics that would warrant position adjustment
        const volatilityChange = Math.abs(
            oldAnalysis.metrics.priceVolatility -
                newAnalysis.metrics.priceVolatility
        );
        const volumeChange = Math.abs(
            oldAnalysis.metrics.volumeHealth - newAnalysis.metrics.volumeHealth
        );

        // Check if AMM scores have significantly changed
        const ammScoreChange = Object.keys(
            oldAnalysis.recommendation.ammScores
        ).some((amm) => {
            const oldScore = oldAnalysis.recommendation.ammScores[amm];
            const newScore = newAnalysis.recommendation.ammScores[amm];
            return Math.abs(oldScore - newScore) / oldScore > 0.2; // 20% change threshold
        });

        return volatilityChange > 20 || volumeChange > 30 || ammScoreChange;
    }

    private async adjustPosition(
        pool: MonitoredPool,
        analysis: any,
        state?: State
    ) {
        console.log(
            `Adjusting position for pool using ${analysis.recommendation.preferredAmm}`
        );

        if (!analysis.recommendation.shouldProvide) {
            console.log("Analysis suggests removing liquidity");
            if (pool.currentAmm === "raydium") {
                await this.clmActions.removeLiquidity(
                    pool.baseAddress,
                    pool.quoteAddress,
                    100 // Remove 100%
                );
            }
            // TODO: Add removal logic for other AMMs
        } else {
            console.log(
                `Providing liquidity on ${analysis.recommendation.preferredAmm}`
            );
            console.log("AMM Scores:", analysis.recommendation.ammScores);

            // Add position based on preferred AMM
            if (analysis.recommendation.preferredAmm === "raydium") {
                const { lower, upper } =
                    analysis.recommendation.suggestedTickRange;
                await this.clmActions.adjustPosition(
                    pool.baseAddress,
                    pool.quoteAddress,
                    lower,
                    upper,
                    analysis.recommendation.maxLiquidityUsd
                );
            }
            // TODO: Add position management logic for other AMMs
        }
    }
}

export const poolMonitorJob = {
    run: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const monitor = new PoolMonitorJob();

            // Load monitored pools from state
            const monitoredPools = state?.get("monitoredPools") || {};

            // Check each pool
            for (const poolKey of Object.keys(monitoredPools)) {
                await monitor.checkPool(poolKey, state);
            }

            // Add new pool if specified in message
            const baseAddress = message.get("baseTokenAddress");
            const quoteAddress = message.get("quoteTokenAddress");

            if (baseAddress && quoteAddress) {
                await monitor.addPoolToMonitor(baseAddress, quoteAddress);
            }

            return "Pool monitoring completed successfully";
        } catch (error) {
            console.error("Error in pool monitor job:", error);
            return "Failed to monitor pools";
        }
    },
};
