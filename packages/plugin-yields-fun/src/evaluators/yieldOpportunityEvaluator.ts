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

export interface AmmRouting {
    protocol: "raydium" | "meteora";
    poolAddress: string;
    strategy:
        | "concentrated"
        | "full-range"
        | "dlmm-spot"
        | "dlmm-curve"
        | "dlmm-bid-ask";
    recommendedRange?: {
        lowerTick: number;
        upperTick: number;
        confidenceScore: number;
    };
    dlmmStrategy?: {
        minBinId: number;
        maxBinId: number;
        strategyType: "SpotBalanced" | "Curve" | "BidAsk";
    };
}

export interface YieldRecommendation {
    intent: YieldIntent;
    strategy: "concentrated" | "full-range" | "observe" | "delta-neutral";
    ammRouting: AmmRouting;
    maxExposure: number;
    riskLevel: "low" | "medium" | "high" | "extreme";
    reasoning: string[];
}

export interface PerpTradingMetrics {
    // Market Health
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    openInterest: number;
    volume24h: number;
    volatility24h: number;

    // Risk Metrics
    leverageUtilization: number;
    liquidityDepth: number;
    bidAskSpread: number;
    maxLeverage: number;

    // Position Metrics
    unrealizedPnl: number;
    realizedPnl: number;
    entryPrice: number;
    liquidationPrice: number;
    marginRatio: number;
}

export interface PerpTradingRecommendation {
    action: "OPEN" | "CLOSE" | "MODIFY" | "HOLD";
    side?: "LONG" | "SHORT";
    marketCode: string;
    size: string;
    leverage: number;
    entryPrice?: string;
    stopLoss?: string;
    takeProfit?: string;
    confidence: number;
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

    private async determineOptimalAmm(
        baseAddress: string,
        quoteAddress: string,
        intent: YieldIntent
    ): Promise<AmmRouting> {
        // Get pool data from both AMMs
        const [raydiumPool, meteoraPool] = await Promise.all([
            this.raydium.getPool(baseAddress, quoteAddress),
            this.getMeteoraDlmmPool(baseAddress, quoteAddress),
        ]);

        // Compare metrics
        const raydiumMetrics = await this.getRaydiumPoolMetrics(raydiumPool);
        const meteoraMetrics = await this.getMeteoraDlmmMetrics(meteoraPool);

        // Determine optimal AMM based on:
        // 1. Liquidity depth
        // 2. Volume
        // 3. Fee generation
        // 4. Price impact
        // 5. Strategy requirements (e.g., concentrated liquidity vs DLMM bins)

        if (
            meteoraMetrics.volumeToTVLRatio >
            raydiumMetrics.volumeToTVLRatio * 1.2
        ) {
            // If Meteora has significantly better volume/TVL ratio
            return {
                protocol: "meteora",
                poolAddress: meteoraPool.address.toBase58(),
                strategy: "dlmm-spot",
                dlmmStrategy: {
                    minBinId: meteoraMetrics.optimalMinBin,
                    maxBinId: meteoraMetrics.optimalMaxBin,
                    strategyType: "SpotBalanced",
                },
            };
        } else {
            // Default to Raydium if metrics are similar or better
            return {
                protocol: "raydium",
                poolAddress: raydiumPool.id.toBase58(),
                strategy: "concentrated",
                recommendedRange: {
                    lowerTick: raydiumMetrics.optimalLowerTick,
                    upperTick: raydiumMetrics.optimalUpperTick,
                    confidenceScore: raydiumMetrics.rangeConfidence,
                },
            };
        }
    }

    private async getMeteoraDlmmPool(
        baseAddress: string,
        quoteAddress: string
    ) {
        // Implementation to fetch Meteora DLMM pool
        // This would use the DLMM SDK to get pool information
        return null; // Placeholder
    }

    private async getMeteoraDlmmMetrics(pool: any) {
        // Implementation to calculate Meteora DLMM metrics
        return {
            volumeToTVLRatio: 0,
            optimalMinBin: 0,
            optimalMaxBin: 0,
        }; // Placeholder
    }

    private async getRaydiumPoolMetrics(pool: any) {
        // Implementation to calculate Raydium pool metrics
        return {
            volumeToTVLRatio: 0,
            optimalLowerTick: 0,
            optimalUpperTick: 0,
            rangeConfidence: 0,
        }; // Placeholder
    }

    async evaluatePerpTrade(
        marketCode: string,
        side: "LONG" | "SHORT",
        size: string,
        leverage: number
    ): Promise<PerpTradingRecommendation> {
        // Get market data
        const [ticker, fundingRates, leverageTiers] = await Promise.all([
            this.oxProvider.getTicker(marketCode),
            this.oxProvider.getFundingRates(marketCode),
            this.oxProvider.getLeverageTiers(marketCode),
        ]);

        // Calculate metrics
        const metrics = this.calculatePerpMetrics(
            ticker,
            fundingRates,
            leverageTiers
        );

        // Evaluate trade
        const recommendation = this.generatePerpRecommendation(
            marketCode,
            side,
            size,
            leverage,
            metrics
        );

        return recommendation;
    }

    private calculatePerpMetrics(
        ticker: any,
        fundingRates: any,
        leverageTiers: any
    ): PerpTradingMetrics {
        return {
            markPrice: parseFloat(ticker.data[0].markPrice),
            indexPrice: parseFloat(
                ticker.data[0].indexPrice || ticker.data[0].markPrice
            ),
            fundingRate: parseFloat(fundingRates.data[0]?.fundingRate || "0"),
            openInterest: parseFloat(ticker.data[0].openInterest),
            volume24h: parseFloat(ticker.data[0].volume24h),
            volatility24h: this.calculateVolatility(ticker.data[0]),
            leverageUtilization: this.calculateLeverageUtilization(
                ticker.data[0]
            ),
            liquidityDepth: this.calculateLiquidityDepth(ticker.data[0]),
            bidAskSpread: this.calculateBidAskSpread(ticker.data[0]),
            maxLeverage: this.getMaxLeverageFromTiers(leverageTiers),
            unrealizedPnl: 0,
            realizedPnl: 0,
            entryPrice: 0,
            liquidationPrice: 0,
            marginRatio: 0,
        };
    }

    private generatePerpRecommendation(
        marketCode: string,
        side: "LONG" | "SHORT",
        size: string,
        leverage: number,
        metrics: PerpTradingMetrics
    ): PerpTradingRecommendation {
        const confidence = this.calculateTradeConfidence(metrics, side);
        const reasoning: string[] = [];

        // Analyze funding rate
        if (Math.abs(metrics.fundingRate) > 0.001) {
            reasoning.push(
                `High funding rate (${metrics.fundingRate}) indicates strong ${metrics.fundingRate > 0 ? "long" : "short"} bias`
            );
        }

        // Check leverage against market conditions
        if (leverage > metrics.maxLeverage) {
            reasoning.push(
                `Requested leverage (${leverage}x) exceeds maximum allowed (${metrics.maxLeverage}x)`
            );
        }

        // Analyze volatility
        if (metrics.volatility24h > 0.1) {
            reasoning.push(
                `High volatility (${metrics.volatility24h}) suggests using lower leverage`
            );
        }

        // Make recommendation
        const recommendation: PerpTradingRecommendation = {
            action: confidence > 70 ? "OPEN" : "HOLD",
            side,
            marketCode,
            size,
            leverage: Math.min(leverage, metrics.maxLeverage),
            entryPrice: metrics.markPrice.toString(),
            stopLoss: this.calculateStopLoss(
                metrics.markPrice,
                side,
                leverage
            ).toString(),
            takeProfit: this.calculateTakeProfit(
                metrics.markPrice,
                side,
                leverage
            ).toString(),
            confidence,
            reasoning,
        };

        return recommendation;
    }

    private calculateTradeConfidence(
        metrics: PerpTradingMetrics,
        side: "LONG" | "SHORT"
    ): number {
        let confidence = 50; // Base confidence

        // Adjust based on funding rate
        if (side === "LONG" && metrics.fundingRate < 0) confidence += 10;
        if (side === "SHORT" && metrics.fundingRate > 0) confidence += 10;

        // Adjust based on volatility
        if (metrics.volatility24h < 0.05) confidence += 10;
        if (metrics.volatility24h > 0.15) confidence -= 20;

        // Adjust based on liquidity
        if (metrics.liquidityDepth > 1000000) confidence += 10;
        if (metrics.bidAskSpread < 0.0001) confidence += 10;

        return Math.min(100, Math.max(0, confidence));
    }

    private calculateStopLoss(
        entryPrice: number,
        side: "LONG" | "SHORT",
        leverage: number
    ): number {
        const stopDistance = (entryPrice * 0.1) / leverage; // 10% account risk
        return side === "LONG"
            ? entryPrice - stopDistance
            : entryPrice + stopDistance;
    }

    private calculateTakeProfit(
        entryPrice: number,
        side: "LONG" | "SHORT",
        leverage: number
    ): number {
        const profitDistance = (entryPrice * 0.2) / leverage; // 2:1 reward:risk ratio
        return side === "LONG"
            ? entryPrice + profitDistance
            : entryPrice - profitDistance;
    }

    // Helper methods for metrics calculation
    private calculateVolatility(ticker: any): number {
        const high = parseFloat(ticker.high24h);
        const low = parseFloat(ticker.low24h);
        const avg = (high + low) / 2;
        return (high - low) / avg;
    }

    private calculateLeverageUtilization(ticker: any): number {
        return parseFloat(ticker.openInterest) / parseFloat(ticker.volume24h);
    }

    private calculateLiquidityDepth(ticker: any): number {
        return parseFloat(ticker.volume24h);
    }

    private calculateBidAskSpread(ticker: any): number {
        return 0.0002; // Default spread, should be calculated from orderbook
    }

    private getMaxLeverageFromTiers(leverageTiers: any): number {
        if (!leverageTiers?.data?.[0]?.tiers) return 3;
        return Math.max(
            ...leverageTiers.data[0].tiers.map((t: any) =>
                parseFloat(t.leverage)
            )
        );
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
