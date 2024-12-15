import {
    IAgentRuntime,
    Memory,
    State,
    Evaluator,
    composeContext,
    ModelClass,
    generateObjectArray,
    booleanFooter,
} from "@ai16z/eliza";
import { Connection, PublicKey } from "@solana/web3.js";
import { BirdeyeProvider } from "../providers/birdeyeProvider";
import { RaydiumProvider } from "../providers/raydiumProvider";

export type YieldIntent = "farm" | "provide_liquidity" | "monitor";

export interface YieldOpportunityMetrics {
    // Market Health
    price: number;
    priceChange24h: number;
    volume24h: number;
    tvl: number;
    volumeToTVLRatio: number;

    // Yield Metrics
    estimatedAPR: number;
    feeAPR: number;
    rewardAPR: number;
    impermanentLossRisk: number;

    // Risk Metrics
    securityScore: number;
    priceVolatility: number;
    liquidityConcentration: number;
    holderDistribution: number;

    // Delta Neutral Metrics
    hedgingCost: number;
    borrowingCost: number;
    hedgeEfficiency: number;
    netDeltaExposure: number;
    fundingRate: number;
    borrowUtilization: number;
}

export interface RangeStrategy {
    lowerTick: number;
    upperTick: number;
    expectedAPR: number;
    rebalanceFrequency: "hourly" | "daily" | "weekly";
    confidenceScore: number;
}

export interface YieldRecommendation {
    intent: YieldIntent;
    strategy: "concentrated" | "full-range" | "observe";
    rangeStrategy?: RangeStrategy;
    maxExposure: number;
    riskLevel: "low" | "medium" | "high" | "extreme";
    reasoning: string[];
}

const shouldProcessTemplate = `# Task: Decide if the recent messages should be processed for yield opportunity evaluation.

Look for messages that contain keywords related to:

1. Staking Opportunities:
- Liquid staking (mSOL, stSOL, jitoSOL)
- Native SOL staking
- Governance token staking
- Protocol staking rewards
- Validator staking
- Restaking protocols

2. Liquidity Providing (LP):
- Concentrated liquidity positions
- Traditional liquidity pools
- Single-sided liquidity
- Stable pools
- Volatile pairs
- Range orders
- Active LP management
- Automated market making

3. Yield Farming:
- Incentivized pools
- Dual rewards
- Emission rewards
- Trading fee sharing
- Protocol revenue sharing
- Yield aggregation
- Auto-compounding
- Leveraged farming

4. DeFi Lending:
- Supply/lending yields
- Borrowing rates
- Collateral optimization
- Interest rate markets
- Money markets
- Lending protocols

5. Protocol Rewards:
- Governance rewards
- Trading fee rebates
- Referral rewards
- Protocol revenue distribution
- Loyalty programs
- Airdrop farming

Based on the following conversation, should the messages be processed for yield evaluation? YES or NO

{{recentMessages}}

Should the messages be processed for yield evaluation? ${booleanFooter}`;

const yieldRecommendationTemplate = `# Task: Evaluate yield opportunities based on the conversation and market data.

# Context
Recent market data and metrics are provided below:
{{marketMetrics}}

Previous recommendations:
{{previousRecommendations}}

User's stated intent: {{intent}}

# Yield Categories to Consider

1. Staking Opportunities:
- Liquid staking protocols and their current rates
- Native staking positions and validator performance
- Governance staking and voting rewards
- Protocol-specific staking mechanisms

2. Liquidity Providing:
- Concentrated vs traditional liquidity analysis
- Range optimization for volatile pairs
- Stable pool opportunities
- Single-sided vs dual-sided exposure
- Fee tier selection and volume analysis

3. Yield Farming:
- Current farming incentives and their sustainability
- Reward token analysis and vesting schedules
- Auto-compounding opportunities
- Leveraged farming risks and rewards

4. Lending Markets:
- Supply and borrow rate spreads
- Collateral factor optimization
- Interest rate trends
- Protocol health and utilization

5. Protocol Rewards:
- Revenue sharing mechanisms
- Governance participation benefits
- Trading fee rebates
- Long-term incentive alignment

6. Delta Neutral Strategies:
- Long-short paired positions
- Hedged liquidity providing
- Market making with delta hedging
- Cross-protocol arbitrage opportunities
- Funding rate arbitrage
- Basis trading strategies
- Perpetual-spot arbitrage
- Options-based neutral strategies

# Evaluation Criteria
1. Market Health:
- Price stability and trends
- Volume consistency
- TVL growth and retention
- Market depth and resilience

2. Yield Components:
- Base yield (trading fees, interest)
- Incentive yield (rewards, emissions)
- Governance yield (voting, revenue share)
- Compound yield opportunities
- Hedging costs and efficiency
- Net funding rate income

3. Risk Assessment:
- Smart contract security
- Market manipulation risks
- Impermanent loss exposure
- Protocol governance risks
- Centralization risks
- Market volatility impact
- Correlation risk
- Basis risk
- Liquidation risk
- Oracle reliability

4. Operational Considerations:
- Gas efficiency
- Rebalancing frequency
- Automation possibilities
- Position management complexity
- Hedging infrastructure requirements
- Cross-protocol dependencies
- Liquidation management
- Monitoring requirements

# Response Format
Response should be a JSON object with the following structure:
\`\`\`json
{
    "intent": "farm" | "provide_liquidity" | "monitor",
    "strategy": "concentrated" | "full-range" | "observe" | "delta-neutral",
    "rangeStrategy": {
        "lowerTick": number,
        "upperTick": number,
        "expectedAPR": number,
        "rebalanceFrequency": "hourly" | "daily" | "weekly",
        "confidenceScore": number
    },
    "deltaStrategy": {
        "longComponent": string,
        "shortComponent": string,
        "hedgeRatio": number,
        "expectedNetAPR": number,
        "hedgingFrequency": "hourly" | "daily" | "weekly",
        "confidenceScore": number
    },
    "maxExposure": number,
    "riskLevel": "low" | "medium" | "high" | "extreme",
    "reasoning": string[]
}
\`\`\``;

export class YieldOpportunityEvaluator implements Evaluator {
    name = "YIELD_OPPORTUNITY_EVALUATOR";
    similes = ["YIELD_EVAL", "OPPORTUNITY_EVAL"];
    description =
        "Evaluates DeFi yield opportunities based on market data and user intent";

    private birdeye: BirdeyeProvider;
    private raydium: RaydiumProvider;

    constructor(private connection: Connection) {
        this.birdeye = new BirdeyeProvider();
        this.raydium = new RaydiumProvider(connection, null);
    }

    async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
        const state = await runtime.composeState(message);
        const context = composeContext({
            state,
            template: shouldProcessTemplate,
        });

        return await runtime.generateTrueOrFalse({
            context,
            modelClass: ModelClass.SMALL,
        });
    }

    async handler(
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<any> {
        console.log("Evaluating yield opportunity");

        // Extract token address and intent from message
        const { tokenAddress, intent } = await this.extractTokenInfo(
            runtime,
            message
        );
        if (!tokenAddress) {
            console.log("No token address found in message");
            return null;
        }

        // Gather market data
        const marketData = await this.gatherMarketData(tokenAddress);

        // Compose evaluation context
        const context = composeContext({
            state: {
                ...state,
                marketMetrics: JSON.stringify(marketData),
                intent,
                previousRecommendations: await this.getPreviousRecommendations(
                    runtime,
                    message.roomId
                ),
            },
            template: yieldRecommendationTemplate,
        });

        // Generate evaluation using LLM
        const evaluation = await generateObjectArray({
            runtime,
            context,
            modelClass: ModelClass.LARGE,
        });

        // Store evaluation in memory
        await this.storeEvaluation(runtime, message, evaluation);

        return evaluation;
    }

    private async extractTokenInfo(
        runtime: IAgentRuntime,
        message: Memory
    ): Promise<{ tokenAddress: string; intent: YieldIntent }> {
        // Implementation to extract token address and intent from message
        // This would use runtime's LLM capabilities to parse the message
        return { tokenAddress: "", intent: "monitor" }; // Placeholder
    }

    private async gatherMarketData(tokenAddress: string) {
        const [priceData, securityData, holderData, historicalPrices] =
            await Promise.all([
                this.birdeye.getPriceVolume(tokenAddress),
                this.birdeye.getTokenSecurity(tokenAddress),
                this.birdeye.getTokenHolder(tokenAddress),
                this.birdeye.getHistoricalPrices(tokenAddress),
            ]);

        return this.calculateMetrics(
            priceData,
            securityData,
            holderData,
            historicalPrices
        );
    }

    private async getPreviousRecommendations(
        runtime: IAgentRuntime,
        roomId: string
    ): Promise<string> {
        const memoryManager = runtime.memoryManager;
        const recommendations = await memoryManager.getMemories({
            roomId,
            count: 5,
            type: "yield_recommendation",
        });

        return recommendations.map((r) => JSON.stringify(r.content)).join("\n");
    }

    private async storeEvaluation(
        runtime: IAgentRuntime,
        message: Memory,
        evaluation: any
    ) {
        await runtime.memoryManager.createMemory({
            userId: message.userId,
            agentId: runtime.agentId,
            content: evaluation,
            roomId: message.roomId,
            type: "yield_recommendation",
            createdAt: Date.now(),
        });
    }

    private calculateMetrics(
        priceData: any,
        securityData: any,
        holderData: any,
        historicalPrices: any
    ): YieldOpportunityMetrics {
        const volatility = this.calculateVolatility(historicalPrices);
        const volumeToTVL = priceData.volume24h / priceData.tvl;

        return {
            price: priceData.price,
            priceChange24h: priceData.priceChange24h,
            volume24h: priceData.volume24h,
            tvl: priceData.tvl,
            volumeToTVLRatio: volumeToTVL,
            estimatedAPR: this.calculateEstimatedAPR(priceData, volumeToTVL),
            feeAPR: this.calculateFeeAPR(priceData),
            rewardAPR: this.calculateRewardAPR(priceData),
            impermanentLossRisk: this.calculateILRisk(volatility),
            securityScore: securityData.score,
            priceVolatility: volatility,
            liquidityConcentration:
                this.calculateLiquidityConcentration(priceData),
            holderDistribution: this.calculateHolderDistribution(holderData),
            hedgingCost: 0,
            borrowingCost: 0,
            hedgeEfficiency: 0,
            netDeltaExposure: 0,
            fundingRate: 0,
            borrowUtilization: 0,
        };
    }

    private calculateVolatility(prices: number[]): number {
        if (prices.length < 2) return 0;
        const returns = prices
            .slice(1)
            .map((price, i) => Math.log(price / prices[i]));
        const mean = returns.reduce((a, b) => a + b) / returns.length;
        const variance =
            returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            returns.length;
        return Math.sqrt(variance);
    }

    private calculateEstimatedAPR(priceData: any, volumeToTVL: number): number {
        return volumeToTVL * 365 * 0.003 * 100; // Assuming 0.3% fee tier
    }

    private calculateFeeAPR(priceData: any): number {
        return ((priceData.volume24h * 0.003 * 365) / priceData.tvl) * 100;
    }

    private calculateRewardAPR(priceData: any): number {
        return priceData.rewardAPR || 0;
    }

    private calculateILRisk(volatility: number): number {
        return Math.min(100, volatility * 200);
    }

    private calculateLiquidityConcentration(priceData: any): number {
        return priceData.liquidityConcentration || 50;
    }

    private calculateHolderDistribution(holderData: any): number {
        return holderData.distribution || 50;
    }

    private calculateMaxExposure(
        metrics: YieldOpportunityMetrics,
        riskLevel: string
    ): number {
        const baseExposure = {
            low: 20,
            medium: 10,
            high: 5,
            extreme: 0,
        }[riskLevel];

        return Math.max(
            0,
            Math.min(20, baseExposure * (metrics.securityScore / 100))
        );
    }

    private determineRebalanceFrequency(
        metrics: YieldOpportunityMetrics
    ): "hourly" | "daily" | "weekly" {
        if (metrics.priceVolatility > 0.4) return "hourly";
        if (metrics.priceVolatility > 0.2) return "daily";
        return "weekly";
    }

    private calculateConfidenceScore(metrics: YieldOpportunityMetrics): number {
        return Math.min(
            100,
            metrics.securityScore * 0.3 +
                (100 - metrics.impermanentLossRisk) * 0.3 +
                metrics.holderDistribution * 0.2 +
                metrics.volumeToTVLRatio * 100 * 0.2
        );
    }

    private calculateDeltaNeutralMetrics(
        priceData: any,
        fundingData: any,
        borrowData: any
    ): Partial<YieldOpportunityMetrics> {
        const hedgingCost = this.estimateHedgingCost(priceData.volatility);
        const borrowingCost = borrowData?.borrowRate || 0;
        const hedgeEfficiency = this.calculateHedgeEfficiency(
            priceData.correlation
        );
        const netDeltaExposure = this.calculateNetDelta(
            priceData.delta,
            hedgeEfficiency
        );
        const fundingRate = fundingData?.fundingRate || 0;
        const borrowUtilization = borrowData?.utilization || 0;

        return {
            hedgingCost,
            borrowingCost,
            hedgeEfficiency,
            netDeltaExposure,
            fundingRate,
            borrowUtilization,
        };
    }

    private estimateHedgingCost(volatility: number): number {
        // Estimate hedging cost based on volatility and typical spread
        const baseSpread = 0.001; // 10 bps
        return baseSpread * (1 + volatility);
    }

    private calculateHedgeEfficiency(correlation: number): number {
        // Calculate how effective the hedge is based on correlation
        return Math.min(1, Math.max(0, Math.abs(correlation)));
    }

    private calculateNetDelta(
        rawDelta: number,
        hedgeEfficiency: number
    ): number {
        // Calculate remaining delta exposure after hedging
        return rawDelta * (1 - hedgeEfficiency);
    }
}

// Export the evaluator instance for the Eliza framework
export const yieldOpportunityEvaluator = {
    evaluate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") ||
                    "https://api.mainnet-beta.solana.com"
            );

            const evaluator = new YieldOpportunityEvaluator(connection);
            const tokenAddress = message.get("tokenAddress");
            const intent = (message.get("intent") as YieldIntent) || "monitor";

            if (!tokenAddress) {
                return "Please provide a token address for evaluation.";
            }

            const evaluation = await evaluator.evaluateOpportunity(
                tokenAddress,
                intent,
                state
            );

            if (state) {
                state.set("lastYieldEvaluation", evaluation);
            }

            return JSON.stringify(evaluation, null, 2);
        } catch (error) {
            console.error("Error in yield opportunity evaluator:", error);
            return "Failed to evaluate yield opportunity.";
        }
    },
};
