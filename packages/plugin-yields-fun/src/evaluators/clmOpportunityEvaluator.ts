import { Evaluator, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { TokenPairTrustManager } from "../providers/tokenPairTrustProvider";
import { DexScreenerProvider } from "../providers/dexScreenerProvider";
import { BirdeyeProvider } from "../providers/birdeyeProvider";
import { Connection } from "@solana/web3.js";

export interface CLMOpportunityMetrics {
    // Core Metrics
    volumeToLiquidity: number; // Higher ratio = better fee generation
    feeAPR: number; // Estimated annual fee returns
    priceVolatility: number; // 24h price volatility
    volumeStability: number; // Consistency of volume over time
    liquidityDepth: number; // Depth and stability of liquidity

    // Risk Metrics
    securityScore: number; // Token contract security assessment
    rugPullRisk: number; // Risk assessment for rug pulls
    impermanentLossRisk: number; // Estimated IL risk based on volatility

    // Market Metrics
    marketTrend: "bullish" | "bearish" | "sideways";
    buyPressure: number; // Buy vs sell pressure ratio
    holderMetrics: {
        totalHolders: number;
        holdingDistribution: number; // Gini coefficient of token distribution
        topHolderConcentration: number; // % held by top 10 wallets
    };

    // Performance Metrics
    historicalFeeAPY: number; // Historical fee performance
    volumeGrowth24h: number; // 24h volume growth rate
    priceGrowth24h: number; // 24h price growth rate
}

export interface CLMRangeRecommendation {
    lowerTick: number;
    upperTick: number;
    expectedAPR: number;
    confidenceScore: number;
    timeHorizon: "short" | "medium" | "long";
    rebalanceFrequency: "hourly" | "daily" | "weekly";
    maxExposure: number; // Recommended max position size as % of portfolio
}

export interface CLMOpportunityEvaluation {
    pairAddress: string;
    baseToken: string;
    quoteToken: string;
    dex: string;
    metrics: CLMOpportunityMetrics;
    recommendation: CLMRangeRecommendation;
    riskLevel: "low" | "medium" | "high" | "extreme";
    confidenceScore: number; // Overall confidence in evaluation (0-100)
    action: "provide" | "avoid" | "monitor";
}

const EVALUATION_TASKS = {
    SECURITY_CHECK: "Assess token pair security and contract risks",
    MARKET_ANALYSIS: "Analyze market conditions and trading patterns",
    VOLUME_ANALYSIS: "Evaluate volume stability and fee generation potential",
    RANGE_OPTIMIZATION: "Calculate optimal CLM range based on volatility",
    RISK_ASSESSMENT:
        "Evaluate overall risk profile and exposure recommendations",
};

export class CLMOpportunityEvaluator {
    private trustManager: TokenPairTrustManager;
    private dexScreener: DexScreenerProvider;
    private birdeye: BirdeyeProvider;
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
        this.trustManager = new TokenPairTrustManager();
        this.dexScreener = new DexScreenerProvider();
        this.birdeye = new BirdeyeProvider();
    }

    async evaluateOpportunity(
        baseAddress: string,
        quoteAddress: string,
        state?: State
    ): Promise<CLMOpportunityEvaluation> {
        console.log(
            `Evaluating CLM opportunity for ${baseAddress}/${quoteAddress}`
        );

        // 1. Security Analysis
        const trustState = await this.trustManager.getTrustState(
            baseAddress,
            quoteAddress
        );
        const securityMetrics =
            await this.birdeye.getTokenSecurity(baseAddress);

        // 2. Market Analysis
        const marketData = await this.birdeye.getPriceVolume(baseAddress);
        const trades = await this.birdeye.getTradesPair(
            baseAddress,
            quoteAddress
        );
        const ohlcv = await this.birdeye.getOHLCV(baseAddress);

        // 3. Holder Analysis
        const holderData = await this.birdeye.getTokenHolder(baseAddress);

        // Calculate core metrics
        const metrics = this.calculateMetrics(
            trustState,
            securityMetrics,
            marketData,
            trades,
            ohlcv,
            holderData
        );

        // Generate range recommendation
        const recommendation = this.generateRangeRecommendation(
            metrics,
            marketData,
            ohlcv
        );

        // Determine overall evaluation
        const evaluation = this.generateEvaluation(
            baseAddress,
            quoteAddress,
            metrics,
            recommendation
        );

        return evaluation;
    }

    private calculateMetrics(
        trustState: any,
        securityMetrics: any,
        marketData: any,
        trades: any,
        ohlcv: any,
        holderData: any
    ): CLMOpportunityMetrics {
        // Calculate volume stability
        const volumeStability = this.calculateVolumeStability(ohlcv);

        // Calculate price volatility
        const priceVolatility = this.calculatePriceVolatility(ohlcv);

        // Calculate volume/liquidity ratio
        const vtl = marketData.volume24h / marketData.liquidity;

        // Calculate fee APR based on volume and current fee tier
        const feeAPR = this.calculateFeeAPR(marketData);

        // Calculate buy pressure
        const buyPressure = this.calculateBuyPressure(trades);

        // Calculate holder metrics
        const holderMetrics = this.calculateHolderMetrics(holderData);

        // Calculate security scores
        const securityScore = this.calculateSecurityScore(securityMetrics);

        return {
            volumeToLiquidity: vtl,
            feeAPR,
            priceVolatility,
            volumeStability,
            liquidityDepth: marketData.liquidity,
            securityScore,
            rugPullRisk: this.calculateRugPullRisk(
                securityMetrics,
                holderMetrics
            ),
            impermanentLossRisk: this.calculateILRisk(priceVolatility),
            marketTrend: this.determineMarketTrend(ohlcv),
            buyPressure,
            holderMetrics,
            historicalFeeAPY: this.calculateHistoricalFeeAPY(marketData),
            volumeGrowth24h: marketData.volumeChange24h,
            priceGrowth24h: marketData.priceChange24h,
        };
    }

    private generateRangeRecommendation(
        metrics: CLMOpportunityMetrics,
        marketData: any,
        ohlcv: any
    ): CLMRangeRecommendation {
        const currentPrice = marketData.price;

        // Calculate optimal range based on volatility and market trend
        let lowerBound, upperBound;

        if (metrics.securityScore >= 80 && metrics.volumeStability >= 70) {
            // Stable token with good security - tighter range
            lowerBound = currentPrice * 0.95;
            upperBound = currentPrice * 1.05;
        } else if (metrics.priceVolatility > 50) {
            // Volatile token - wider range
            lowerBound = currentPrice * 0.7;
            upperBound = currentPrice * 2.0;
        } else {
            // Default moderate range
            lowerBound = currentPrice * 0.8;
            upperBound = currentPrice * 1.5;
        }

        // Calculate expected APR
        const expectedAPR = this.calculateExpectedAPR(
            metrics.feeAPR,
            metrics.volumeStability,
            metrics.impermanentLossRisk
        );

        // Determine time horizon based on metrics
        const timeHorizon = this.determineTimeHorizon(metrics);

        // Calculate confidence score
        const confidenceScore = this.calculateConfidenceScore(metrics);

        return {
            lowerTick: this.priceToTick(lowerBound),
            upperTick: this.priceToTick(upperBound),
            expectedAPR,
            confidenceScore,
            timeHorizon,
            rebalanceFrequency: this.determineRebalanceFrequency(metrics),
            maxExposure: this.calculateMaxExposure(metrics),
        };
    }

    private generateEvaluation(
        baseAddress: string,
        quoteAddress: string,
        metrics: CLMOpportunityMetrics,
        recommendation: CLMRangeRecommendation
    ): CLMOpportunityEvaluation {
        // Determine risk level
        const riskLevel = this.calculateRiskLevel(metrics);

        // Determine action based on metrics and risk
        const action = this.determineAction(metrics, riskLevel);

        return {
            pairAddress: `${baseAddress}/${quoteAddress}`,
            baseToken: baseAddress,
            quoteToken: quoteAddress,
            dex: this.determineBestDex(metrics),
            metrics,
            recommendation,
            riskLevel,
            confidenceScore: recommendation.confidenceScore,
            action,
        };
    }

    // Helper methods for calculations
    private calculateVolumeStability(ohlcv: any): number {
        // Calculate coefficient of variation for volume
        const volumes = ohlcv.map((d: any) => d.volume);
        const mean =
            volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
        const variance =
            volumes.reduce(
                (a: number, b: number) => a + Math.pow(b - mean, 2),
                0
            ) / volumes.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, 100 - (stdDev / mean) * 100);
    }

    private calculatePriceVolatility(ohlcv: any): number {
        const returns = ohlcv
            .slice(1)
            .map((d: any, i: number) => Math.log(d.close / ohlcv[i].close));
        const stdDev = Math.sqrt(
            returns.reduce((a: number, b: number) => a + b * b, 0) /
                returns.length
        );
        return stdDev * Math.sqrt(365) * 100; // Annualized volatility
    }

    private calculateFeeAPR(marketData: any): number {
        const dailyVolume = marketData.volume24h;
        const liquidity = marketData.liquidity;
        const feeTier = 0.003; // Assuming 0.3% fee tier
        return ((dailyVolume * feeTier * 365) / liquidity) * 100;
    }

    private calculateBuyPressure(trades: any): number {
        const buyVolume = trades
            .filter((t: any) => t.side === "buy")
            .reduce((sum: number, t: any) => sum + t.volume, 0);
        const totalVolume = trades.reduce(
            (sum: number, t: any) => sum + t.volume,
            0
        );
        return buyVolume / totalVolume;
    }

    private calculateHolderMetrics(holderData: any): any {
        return {
            totalHolders: holderData.totalHolders,
            holdingDistribution: this.calculateGiniCoefficient(
                holderData.holdings
            ),
            topHolderConcentration: this.calculateTopHolderConcentration(
                holderData.holdings
            ),
        };
    }

    private calculateSecurityScore(securityMetrics: any): number {
        let score = 100;
        if (securityMetrics.isHoneypot) score -= 100;
        if (securityMetrics.hasBlacklist) score -= 20;
        if (securityMetrics.hasMintFunction) score -= 30;
        if (!securityMetrics.hasRenounced) score -= 10;
        return Math.max(0, score);
    }

    private calculateRugPullRisk(
        securityMetrics: any,
        holderMetrics: any
    ): number {
        let risk = 0;
        if (securityMetrics.hasMintFunction) risk += 30;
        if (holderMetrics.topHolderConcentration > 50) risk += 30;
        if (!securityMetrics.hasRenounced) risk += 20;
        if (holderMetrics.totalHolders < 100) risk += 20;
        return Math.min(100, risk);
    }

    private calculateILRisk(volatility: number): number {
        return Math.min(100, volatility * 2);
    }

    private determineMarketTrend(
        ohlcv: any
    ): "bullish" | "bearish" | "sideways" {
        const prices = ohlcv.map((d: any) => d.close);
        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = this.calculateSMA(prices, 50);

        if (sma20 > sma50 * 1.05) return "bullish";
        if (sma20 < sma50 * 0.95) return "bearish";
        return "sideways";
    }

    private calculateHistoricalFeeAPY(marketData: any): number {
        return marketData.feeAPY || 0;
    }

    private calculateExpectedAPR(
        feeAPR: number,
        volumeStability: number,
        ilRisk: number
    ): number {
        return feeAPR * (volumeStability / 100) * (1 - ilRisk / 200);
    }

    private determineTimeHorizon(
        metrics: CLMOpportunityMetrics
    ): "short" | "medium" | "long" {
        if (metrics.priceVolatility > 50 || metrics.rugPullRisk > 50)
            return "short";
        if (metrics.volumeStability > 70 && metrics.securityScore > 80)
            return "long";
        return "medium";
    }

    private determineRebalanceFrequency(
        metrics: CLMOpportunityMetrics
    ): "hourly" | "daily" | "weekly" {
        if (metrics.priceVolatility > 50) return "hourly";
        if (metrics.priceVolatility > 20) return "daily";
        return "weekly";
    }

    private calculateMaxExposure(metrics: CLMOpportunityMetrics): number {
        const baseExposure = 20; // Max 20% of portfolio
        const riskMultiplier = (100 - metrics.rugPullRisk) / 100;
        const volumeMultiplier = metrics.volumeStability / 100;
        return baseExposure * riskMultiplier * volumeMultiplier;
    }

    private calculateRiskLevel(
        metrics: CLMOpportunityMetrics
    ): "low" | "medium" | "high" | "extreme" {
        const riskScore =
            metrics.rugPullRisk * 0.4 +
            metrics.impermanentLossRisk * 0.3 +
            (100 - metrics.securityScore) * 0.3;

        if (riskScore < 20) return "low";
        if (riskScore < 40) return "medium";
        if (riskScore < 60) return "high";
        return "extreme";
    }

    private determineAction(
        metrics: CLMOpportunityMetrics,
        riskLevel: "low" | "medium" | "high" | "extreme"
    ): "provide" | "avoid" | "monitor" {
        if (riskLevel === "extreme") return "avoid";
        if (metrics.feeAPR < 20 || metrics.volumeStability < 30) return "avoid";
        if (riskLevel === "high" && metrics.feeAPR < 100) return "monitor";
        if (metrics.securityScore < 50) return "avoid";
        return "provide";
    }

    private determineBestDex(metrics: CLMOpportunityMetrics): string {
        // Implement DEX selection logic based on metrics
        return "raydium"; // Default to Raydium for now
    }

    private calculateSMA(data: number[], period: number): number {
        return data.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    private calculateGiniCoefficient(holdings: any[]): number {
        // Implement Gini coefficient calculation
        return 0.5; // Placeholder
    }

    private calculateTopHolderConcentration(holdings: any[]): number {
        // Calculate concentration of top 10 holders
        return 0.3; // Placeholder
    }

    private priceToTick(price: number): number {
        // Implement price to tick conversion
        return Math.floor(Math.log(price) / Math.log(1.0001));
    }
}

// Export the evaluator interface for the Eliza framework
export const clmOpportunityEvaluator: Evaluator = {
    name: "CLM_OPPORTUNITY",
    similes: ["CONCENTRATED_LIQUIDITY", "CLM_EVALUATION"],
    description: "Evaluates concentrated liquidity market making opportunities",
    alwaysRun: false,

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const state = message.state as State;
        return !!(state?.baseAddress && state?.quoteAddress);
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const evaluator = new CLMOpportunityEvaluator(runtime.connection);

            const baseAddress = state?.baseAddress;
            const quoteAddress = state?.quoteAddress;

            if (!baseAddress || !quoteAddress) {
                return "Missing token addresses for evaluation";
            }

            const evaluation = await evaluator.evaluateOpportunity(
                baseAddress,
                quoteAddress,
                state
            );

            // Store evaluation in state for other components
            if (state) {
                state.set("lastClmEvaluation", evaluation);
            }

            return JSON.stringify(evaluation, null, 2);
        } catch (error) {
            console.error("Error in CLM opportunity evaluator:", error);
            return "Failed to evaluate CLM opportunity";
        }
    },
};
