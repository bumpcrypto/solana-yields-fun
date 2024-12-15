import { IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { TokenPairTrustManager } from "../providers/tokenPairTrustProvider";
import { DexScreenerProvider } from "../providers/dexScreenerProvider";

export interface TokenPairEvaluation {
    trustState: {
        overallScore: number;
        riskLevel: string;
        metrics: {
            volume: number;
            liquidity: number;
            volatility: number;
            transactions: number;
        };
    };
    marketState: {
        bestDex: string;
        currentPrice: number;
        volume24h: number;
        liquidityUsd: number;
    };
    recommendation: {
        action: "provide" | "avoid" | "monitor";
        confidence: number;
        maxExposure: number;
        suggestedTickRange?: {
            lower: number;
            upper: number;
        };
    };
}

const EVALUATION_TASKS = {
    ASSESS_TRUST: "Assess token pair trust metrics and risk level",
    ANALYZE_MARKET: "Analyze current market conditions and liquidity",
    GENERATE_RECOMMENDATION:
        "Generate actionable recommendation based on analysis",
};

const EVALUATION_INSTRUCTIONS = {
    [EVALUATION_TASKS.ASSESS_TRUST]:
        "Calculate trust scores and risk metrics for the token pair",
    [EVALUATION_TASKS.ANALYZE_MARKET]:
        "Evaluate market conditions including volume, liquidity, and price action",
    [EVALUATION_TASKS.GENERATE_RECOMMENDATION]:
        "Determine optimal action and exposure based on trust and market analysis",
};

export class TokenPairEvaluator {
    private trustManager: TokenPairTrustManager;
    private dexScreener: DexScreenerProvider;

    constructor() {
        this.trustManager = new TokenPairTrustManager();
        this.dexScreener = new DexScreenerProvider();
    }

    async evaluatePair(
        baseAddress: string,
        quoteAddress: string,
        state?: State
    ): Promise<TokenPairEvaluation> {
        // Task 1: Assess Trust
        console.log(`Executing task: ${EVALUATION_TASKS.ASSESS_TRUST}`);
        console.log(
            `Instructions: ${EVALUATION_INSTRUCTIONS[EVALUATION_TASKS.ASSESS_TRUST]}`
        );
        const trustState = await this.trustManager.getTrustState(
            baseAddress,
            quoteAddress
        );

        // Task 2: Analyze Market
        console.log(`Executing task: ${EVALUATION_TASKS.ANALYZE_MARKET}`);
        console.log(
            `Instructions: ${EVALUATION_INSTRUCTIONS[EVALUATION_TASKS.ANALYZE_MARKET]}`
        );
        const bestDex = await this.dexScreener.getBestDexForPair(
            baseAddress,
            quoteAddress
        );
        const pairs =
            await this.dexScreener.getPairsByTokenAddress(baseAddress);
        const activePair = pairs.find(
            (p) => p.pairAddress === bestDex.pairAddress
        );

        // Task 3: Generate Recommendation
        console.log(
            `Executing task: ${EVALUATION_TASKS.GENERATE_RECOMMENDATION}`
        );
        console.log(
            `Instructions: ${EVALUATION_INSTRUCTIONS[EVALUATION_TASKS.GENERATE_RECOMMENDATION]}`
        );
        const recommendation = this.generateRecommendation(
            trustState,
            bestDex,
            activePair
        );

        return {
            trustState: {
                overallScore: trustState.metrics.overallTrustScore,
                riskLevel: trustState.recommendations.riskLevel,
                metrics: {
                    volume: trustState.metrics.volumeScore,
                    liquidity: trustState.metrics.liquidityScore,
                    volatility: trustState.metrics.volatilityScore,
                    transactions: trustState.metrics.transactionScore,
                },
            },
            marketState: {
                bestDex: bestDex.dexId,
                currentPrice: activePair ? parseFloat(activePair.priceUsd) : 0,
                volume24h: bestDex.volumeUsd24h,
                liquidityUsd: bestDex.liquidityUsd,
            },
            recommendation,
        };
    }

    private generateRecommendation(
        trustState: any,
        bestDex: any,
        activePair: any
    ): TokenPairEvaluation["recommendation"] {
        const confidence = trustState.metrics.overallTrustScore;
        const currentPrice = activePair ? parseFloat(activePair.priceUsd) : 0;

        let action: "provide" | "avoid" | "monitor";
        if (confidence >= 70 && bestDex.volumeUsd24h >= 50000) {
            action = "provide";
        } else if (confidence < 40 || bestDex.volumeUsd24h < 10000) {
            action = "avoid";
        } else {
            action = "monitor";
        }

        const recommendation: TokenPairEvaluation["recommendation"] = {
            action,
            confidence,
            maxExposure: trustState.recommendations.maxExposure,
        };

        if (action === "provide" && currentPrice > 0) {
            const volatility = 100 - trustState.metrics.volatilityScore;
            const range = Math.max(0.01, Math.min(0.05, volatility / 1000));
            recommendation.suggestedTickRange = {
                lower: currentPrice * (1 - range),
                upper: currentPrice * (1 + range),
            };
        }

        return recommendation;
    }
}

export const tokenPairEvaluator = {
    evaluate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const evaluator = new TokenPairEvaluator();

            const baseAddress = message.get("baseTokenAddress");
            const quoteAddress = message.get("quoteTokenAddress");

            if (!baseAddress || !quoteAddress) {
                return "Please provide both base and quote token addresses for evaluation.";
            }

            const evaluation = await evaluator.evaluatePair(
                baseAddress,
                quoteAddress,
                state
            );

            if (state) {
                state.set("lastTokenPairEvaluation", evaluation);
            }

            return JSON.stringify(evaluation, null, 2);
        } catch (error) {
            console.error("Error in token pair evaluator:", error);
            return "Failed to evaluate token pair.";
        }
    },
};
