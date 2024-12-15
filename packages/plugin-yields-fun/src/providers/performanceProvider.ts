import { BirdeyeProvider } from "./birdeyeProvider";
import {
    TimeScope,
    HistoricalPriceResponse,
    HistoricalPriceDataPoint,
} from "./birdeyeEndpoints";

export interface TokenPerformanceMetrics {
    price: number;
    priceChange24h: number;
    volume24h: number;
    volumeChange24h: number;
    liquidity: number;
    historicalVolatility: number;
    volumeToLiquidity: number;
    feeAPR: number;
    buyPressure: number;
}

export interface PerformanceAnalysis {
    metrics: TokenPerformanceMetrics;
    recommendation: {
        action: "provide" | "avoid" | "monitor";
        confidence: number;
        timeHorizon: "short" | "medium" | "long";
        suggestedRange?: {
            lower: number;
            upper: number;
        };
    };
    riskLevel: "low" | "medium" | "high" | "extreme";
}

export class PerformanceProvider {
    constructor(private birdeyeProvider: BirdeyeProvider) {}

    async getTokenPerformance(
        tokenAddress: string,
        timeScope: TimeScope = "1D"
    ): Promise<PerformanceAnalysis> {
        // Get current metrics
        const currentMetrics =
            await this.birdeyeProvider.getPriceAndVolume(tokenAddress);

        // Get historical price data
        const historicalData = await this.birdeyeProvider.getHistoricalPrices({
            address: tokenAddress,
            type: timeScope,
        });

        // Calculate performance metrics
        const metrics = await this.calculatePerformanceMetrics(
            currentMetrics,
            historicalData
        );

        // Generate analysis and recommendations
        return this.analyzePerformance(metrics);
    }

    private async calculatePerformanceMetrics(
        current: any,
        historical: HistoricalPriceResponse
    ): Promise<TokenPerformanceMetrics> {
        const volatility = this.calculateHistoricalVolatility(historical.data);
        const vtl = current.volume24h / current.liquidity;

        return {
            price: current.price,
            priceChange24h: current.priceChange24h,
            volume24h: current.volume24h,
            volumeChange24h: current.volumeChange24h,
            liquidity: current.liquidity,
            historicalVolatility: volatility,
            volumeToLiquidity: vtl,
            feeAPR: current.feeAPY || 0,
            buyPressure: 0.5, // This would need to be calculated from trade data
        };
    }

    private calculateHistoricalVolatility(
        priceData: HistoricalPriceDataPoint[]
    ): number {
        if (priceData.length < 2) return 0;

        const returns = priceData
            .slice(1)
            .map((point, i) => Math.log(point.value / priceData[i].value));

        const mean = returns.reduce((a, b) => a + b) / returns.length;
        const variance =
            returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            returns.length;

        return Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility
    }

    private analyzePerformance(
        metrics: TokenPerformanceMetrics
    ): PerformanceAnalysis {
        // Determine risk level
        const riskLevel = this.calculateRiskLevel(metrics);

        // Generate recommendation
        const recommendation = this.generateRecommendation(metrics, riskLevel);

        return {
            metrics,
            recommendation,
            riskLevel,
        };
    }

    private calculateRiskLevel(
        metrics: TokenPerformanceMetrics
    ): "low" | "medium" | "high" | "extreme" {
        const riskFactors = {
            volatility:
                metrics.historicalVolatility > 100
                    ? 3
                    : metrics.historicalVolatility > 50
                      ? 2
                      : 1,

            volumeStability:
                Math.abs(metrics.volumeChange24h) > 50
                    ? 3
                    : Math.abs(metrics.volumeChange24h) > 25
                      ? 2
                      : 1,

            liquidity:
                metrics.liquidity < 100000
                    ? 3
                    : metrics.liquidity < 500000
                      ? 2
                      : 1,

            vtl:
                metrics.volumeToLiquidity > 2
                    ? 3
                    : metrics.volumeToLiquidity > 1
                      ? 2
                      : 1,
        };

        const riskScore =
            Object.values(riskFactors).reduce((a, b) => a + b, 0) / 4;

        if (riskScore >= 2.5) return "extreme";
        if (riskScore >= 2) return "high";
        if (riskScore >= 1.5) return "medium";
        return "low";
    }

    private generateRecommendation(
        metrics: TokenPerformanceMetrics,
        riskLevel: "low" | "medium" | "high" | "extreme"
    ) {
        // Base confidence on metrics stability
        const confidence = this.calculateConfidence(metrics);

        // Determine time horizon based on volatility and risk
        const timeHorizon = this.determineTimeHorizon(metrics, riskLevel);

        // Determine action based on overall metrics
        const action = this.determineAction(metrics, riskLevel, confidence);

        // Calculate suggested range if action is 'provide'
        const suggestedRange =
            action === "provide"
                ? this.calculateSuggestedRange(metrics)
                : undefined;

        return {
            action,
            confidence,
            timeHorizon,
            suggestedRange,
        };
    }

    private calculateConfidence(metrics: TokenPerformanceMetrics): number {
        const factors = {
            volumeStability:
                Math.max(0, 100 - Math.abs(metrics.volumeChange24h)) / 100,
            liquidityAdequacy: Math.min(metrics.liquidity / 1000000, 1),
            volatilityScore:
                Math.max(0, 100 - metrics.historicalVolatility) / 100,
        };

        return (Object.values(factors).reduce((a, b) => a + b, 0) / 3) * 100;
    }

    private determineTimeHorizon(
        metrics: TokenPerformanceMetrics,
        riskLevel: "low" | "medium" | "high" | "extreme"
    ): "short" | "medium" | "long" {
        if (riskLevel === "extreme" || metrics.historicalVolatility > 100)
            return "short";
        if (riskLevel === "low" && metrics.historicalVolatility < 30)
            return "long";
        return "medium";
    }

    private determineAction(
        metrics: TokenPerformanceMetrics,
        riskLevel: "low" | "medium" | "high" | "extreme",
        confidence: number
    ): "provide" | "avoid" | "monitor" {
        if (riskLevel === "extreme" || confidence < 40) return "avoid";
        if (riskLevel === "high" || confidence < 60) return "monitor";

        const hasGoodMetrics =
            metrics.feeAPR > 20 &&
            metrics.liquidity > 250000 &&
            metrics.volume24h > 100000;

        return hasGoodMetrics ? "provide" : "monitor";
    }

    private calculateSuggestedRange(metrics: TokenPerformanceMetrics) {
        const volatilityFactor = Math.max(
            0.05,
            Math.min(0.5, metrics.historicalVolatility / 200)
        );

        return {
            lower: metrics.price * (1 - volatilityFactor),
            upper: metrics.price * (1 + volatilityFactor),
        };
    }
}
