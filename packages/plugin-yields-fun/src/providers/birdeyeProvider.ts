import { Provider } from "@ai16z/eliza";
import axios from "axios";
import NodeCache from "node-cache";
import {
    BIRDEYE_API_BASE_URL,
    HistoricalPriceParams,
    HistoricalPriceResponse,
    HISTORY_PRICE,
    TokenSecurityResponse,
    PriceVolumeResponse,
    TradeResponse,
    OHLCVResponse,
    TokenHolderResponse,
    TokenMarketDataResponse,
    PairOverviewResponse,
    WalletTokenListResponse,
    WalletTransactionListResponse,
    getApiHeaders,
    MARKET_DATA,
    PAIR_OVERVIEW,
    WALLET_TOKEN_LIST,
    WALLET_TX_LIST,
    HistoricalPriceDataPoint,
} from "./birdeyeEndpoints";

export class BirdeyeProvider {
    private readonly API_KEY: string;
    private readonly BASE_URL = BIRDEYE_API_BASE_URL;
    private cache: NodeCache;

    constructor() {
        this.API_KEY = process.env.BIRDEYE_API_KEY || "";
        if (!this.API_KEY) {
            throw new Error("BIRDEYE_API_KEY is required");
        }

        // Cache settings: 5 minutes for most data, 1 hour for security data
        this.cache = new NodeCache({
            stdTTL: 300, // 5 minutes default
            checkperiod: 60,
        });
    }

    async getTokenSecurity(
        tokenAddress: string
    ): Promise<TokenSecurityResponse> {
        const cacheKey = `security_${tokenAddress}`;
        const cached = this.cache.get<TokenSecurityResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/defi/token_security`,
                {
                    headers: { "X-API-KEY": this.API_KEY },
                    params: { address: tokenAddress },
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 3600); // Cache for 1 hour
            return data;
        } catch (error) {
            console.error("Error fetching token security data:", error);
            throw error;
        }
    }

    async getPriceVolume(tokenAddress: string): Promise<PriceVolumeResponse> {
        const cacheKey = `pricevol_${tokenAddress}`;
        const cached = this.cache.get<PriceVolumeResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/token/price-volume/${tokenAddress}`,
                {
                    headers: { "X-API-KEY": this.API_KEY },
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching price volume:", error);
            throw error;
        }
    }

    async getTradesPair(
        baseAddress: string,
        quoteAddress: string,
        limit: number = 100
    ): Promise<TradeResponse[]> {
        const cacheKey = `trades_${baseAddress}_${quoteAddress}`;
        const cached = this.cache.get<TradeResponse[]>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(`${this.BASE_URL}/trades/pair`, {
                headers: { "X-API-KEY": this.API_KEY },
                params: {
                    base_address: baseAddress,
                    quote_address: quoteAddress,
                    limit,
                },
            });

            const data = response.data;
            this.cache.set(cacheKey, data, 60); // Cache for 1 minute
            return data;
        } catch (error) {
            console.error("Error fetching trades:", error);
            throw error;
        }
    }

    async getOHLCV(
        tokenAddress: string,
        interval: string = "1h",
        limit: number = 168 // 1 week of hourly data
    ): Promise<OHLCVResponse[]> {
        const cacheKey = `ohlcv_${tokenAddress}_${interval}`;
        const cached = this.cache.get<OHLCVResponse[]>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/token/ohlcv/${tokenAddress}`,
                {
                    headers: { "X-API-KEY": this.API_KEY },
                    params: { interval, limit },
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching OHLCV:", error);
            throw error;
        }
    }

    async getTokenHolder(tokenAddress: string): Promise<TokenHolderResponse> {
        const cacheKey = `holders_${tokenAddress}`;
        const cached = this.cache.get<TokenHolderResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/token/holder/${tokenAddress}`,
                {
                    headers: { "X-API-KEY": this.API_KEY },
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 3600); // Cache for 1 hour
            return data;
        } catch (error) {
            console.error("Error fetching token holders:", error);
            throw error;
        }
    }

    async getTokenMetadata(tokenAddress: string): Promise<any> {
        const cacheKey = `metadata_${tokenAddress}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}/token/metadata/${tokenAddress}`,
                {
                    headers: { "X-API-KEY": this.API_KEY },
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 86400); // Cache for 24 hours
            return data;
        } catch (error) {
            console.error("Error fetching token metadata:", error);
            throw error;
        }
    }

    async getMarketData(
        tokenAddress: string
    ): Promise<TokenMarketDataResponse> {
        const cacheKey = `market_${tokenAddress}`;
        const cached = this.cache.get<TokenMarketDataResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}${MARKET_DATA(tokenAddress)}`,
                {
                    headers: getApiHeaders(this.API_KEY),
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching market data:", error);
            throw error;
        }
    }

    async getHistoricalPrices(
        params: HistoricalPriceParams
    ): Promise<HistoricalPriceResponse> {
        const cacheKey = `history_${params.address}_${params.type || "1D"}`;
        const cached = this.cache.get<HistoricalPriceResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}${HISTORY_PRICE}`,
                {
                    headers: { "X-API-KEY": this.API_KEY },
                    params: {
                        address: params.address,
                        address_type: params.address_type || "token",
                        type: params.type || "1D",
                        time_from: params.time_from,
                        time_to: params.time_to,
                    },
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching historical prices:", error);
            throw error;
        }
    }

    async getPairOverview(pairAddress: string): Promise<PairOverviewResponse> {
        const cacheKey = `pair_${pairAddress}`;
        const cached = this.cache.get<PairOverviewResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}${PAIR_OVERVIEW(pairAddress)}`,
                {
                    headers: getApiHeaders(this.API_KEY),
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching pair overview:", error);
            throw error;
        }
    }

    async getWalletTokens(
        walletAddress: string
    ): Promise<WalletTokenListResponse> {
        const cacheKey = `wallet_tokens_${walletAddress}`;
        const cached = this.cache.get<WalletTokenListResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}${WALLET_TOKEN_LIST(walletAddress)}`,
                {
                    headers: getApiHeaders(this.API_KEY),
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching wallet tokens:", error);
            throw error;
        }
    }

    async getWalletTransactions(
        walletAddress: string,
        limit: number = 100
    ): Promise<WalletTransactionListResponse> {
        const cacheKey = `wallet_tx_${walletAddress}_${limit}`;
        const cached = this.cache.get<WalletTransactionListResponse>(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(
                `${this.BASE_URL}${WALLET_TX_LIST(walletAddress, limit)}`,
                {
                    headers: getApiHeaders(this.API_KEY),
                }
            );

            const data = response.data;
            this.cache.set(cacheKey, data, 300); // Cache for 5 minutes
            return data;
        } catch (error) {
            console.error("Error fetching wallet transactions:", error);
            throw error;
        }
    }

    async evaluatePair(
        baseAddress: string,
        quoteAddress: string
    ): Promise<PairEvaluation> {
        try {
            // Gather all necessary data
            const [
                baseTokenSecurity,
                quoteTokenSecurity,
                basePriceVolume,
                quotePriceVolume,
                baseHolders,
                quoteHolders,
                trades,
                baseHistory,
                quoteHistory,
            ] = await Promise.all([
                this.getTokenSecurity(baseAddress),
                this.getTokenSecurity(quoteAddress),
                this.getPriceVolume(baseAddress),
                this.getPriceVolume(quoteAddress),
                this.getTokenHolder(baseAddress),
                this.getTokenHolder(quoteAddress),
                this.getTradesPair(baseAddress, quoteAddress),
                this.getHistoricalPrices({ address: baseAddress }),
                this.getHistoricalPrices({ address: quoteAddress }),
            ]);

            // Calculate risk metrics
            const riskMetrics = this.calculateRiskMetrics(
                baseTokenSecurity,
                quoteTokenSecurity,
                baseHolders,
                quoteHolders
            );

            // Calculate market health
            const marketHealth = this.calculateMarketHealth(
                basePriceVolume,
                quotePriceVolume,
                trades
            );

            // Calculate volatility metrics
            const volatilityMetrics = this.calculateVolatilityMetrics(
                baseHistory,
                quoteHistory
            );

            // Generate final evaluation
            return {
                riskLevel: this.determineRiskLevel(riskMetrics),
                marketHealth,
                volatilityMetrics,
                recommendation: this.generateRecommendation(
                    riskMetrics,
                    marketHealth,
                    volatilityMetrics
                ),
                confidenceScore: this.calculateConfidenceScore(
                    riskMetrics,
                    marketHealth,
                    volatilityMetrics
                ),
            };
        } catch (error) {
            console.error("Error evaluating pair:", error);
            throw error;
        }
    }

    private calculateRiskMetrics(
        baseTokenSecurity: TokenSecurityResponse,
        quoteTokenSecurity: TokenSecurityResponse,
        baseHolders: TokenHolderResponse,
        quoteHolders: TokenHolderResponse
    ) {
        return {
            securityScore: Math.min(
                this.calculateSecurityScore(baseTokenSecurity),
                this.calculateSecurityScore(quoteTokenSecurity)
            ),
            holderConcentration: Math.max(
                baseTokenSecurity.top10HolderPercent,
                quoteTokenSecurity.top10HolderPercent
            ),
            holderCount: Math.min(
                baseHolders.totalHolders,
                quoteHolders.totalHolders
            ),
            contractRisk: this.calculateContractRisk(
                baseTokenSecurity,
                quoteTokenSecurity
            ),
        };
    }

    private calculateSecurityScore(security: TokenSecurityResponse): number {
        let score = 100;
        const data = security.data;

        // Deduct points for concerning security factors
        if (data.mutableMetadata) score -= 10;
        if (data.freezeable) score -= 15;
        if (data.transferFeeEnable) score -= 10;
        if (data.top10HolderPercent > 0.5) score -= 20;
        if (data.isToken2022 === false) score -= 5; // Older token standard
        if (data.metaplexUpdateAuthorityPercent > 0.1) score -= 15;

        // Additional checks for concentration risks
        if (data.creatorPercentage && data.creatorPercentage > 0.2) score -= 15;
        if (data.ownerPercentage && data.ownerPercentage > 0.2) score -= 15;

        return Math.max(0, score);
    }

    private calculateContractRisk(
        base: TokenSecurityResponse,
        quote: TokenSecurityResponse
    ): "low" | "medium" | "high" | "extreme" {
        const riskFactors = [
            base.data.mutableMetadata || quote.data.mutableMetadata,
            base.data.freezeable || quote.data.freezeable,
            base.data.transferFeeEnable || quote.data.transferFeeEnable,
            base.data.top10HolderPercent > 0.5 ||
                quote.data.top10HolderPercent > 0.5,
            base.data.metaplexUpdateAuthorityPercent > 0.1 ||
                quote.data.metaplexUpdateAuthorityPercent > 0.1,
        ];

        const riskCount = riskFactors.filter(Boolean).length;
        if (riskCount >= 4) return "extreme";
        if (riskCount >= 3) return "high";
        if (riskCount >= 2) return "medium";
        return "low";
    }

    private calculateMarketHealth(
        basePriceVolume: PriceVolumeResponse,
        quotePriceVolume: PriceVolumeResponse,
        trades: TradeResponse[]
    ) {
        const volumeHealth = Math.min(
            basePriceVolume.volume24h,
            quotePriceVolume.volume24h
        );

        const liquidityHealth = Math.min(
            basePriceVolume.liquidity,
            quotePriceVolume.liquidity
        );

        const recentTrades = trades.slice(0, 100);
        const buyCount = recentTrades.filter((t) => t.side === "buy").length;
        const buyPressure = buyCount / recentTrades.length;

        return {
            volume24h: volumeHealth,
            liquidity: liquidityHealth,
            volumeChange24h: Math.min(
                basePriceVolume.volumeChange24h,
                quotePriceVolume.volumeChange24h
            ),
            buyPressure,
            feeAPY: Math.min(
                basePriceVolume.feeAPY || 0,
                quotePriceVolume.feeAPY || 0
            ),
        };
    }

    private calculateVolatilityMetrics(
        baseHistory: HistoricalPriceResponse,
        quoteHistory: HistoricalPriceResponse
    ) {
        const baseVolatility = this.calculateVolatility(baseHistory.data);
        const quoteVolatility = this.calculateVolatility(quoteHistory.data);

        return {
            baseVolatility,
            quoteVolatility,
            pairVolatility: Math.max(baseVolatility, quoteVolatility),
            priceStability: this.calculatePriceStability(
                baseHistory.data,
                quoteHistory.data
            ),
        };
    }

    private calculateVolatility(priceData: HistoricalPriceDataPoint[]): number {
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

    private calculatePriceStability(
        basePrices: HistoricalPriceDataPoint[],
        quotePrices: HistoricalPriceDataPoint[]
    ): number {
        const baseStability = this.calculatePriceRange(basePrices);
        const quoteStability = this.calculatePriceRange(quotePrices);
        return Math.min(baseStability, quoteStability);
    }

    private calculatePriceRange(prices: HistoricalPriceDataPoint[]): number {
        if (prices.length < 2) return 1;

        const values = prices.map((p) => p.value);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const avg = values.reduce((a, b) => a + b) / values.length;

        return 1 - (max - min) / avg;
    }

    private determineRiskLevel(
        metrics: any
    ): "low" | "medium" | "high" | "extreme" {
        const riskFactors = {
            securityScore:
                metrics.securityScore < 50
                    ? 3
                    : metrics.securityScore < 70
                      ? 2
                      : 1,

            holderConcentration:
                metrics.holderConcentration > 80
                    ? 3
                    : metrics.holderConcentration > 60
                      ? 2
                      : 1,

            holderCount:
                metrics.holderCount < 100
                    ? 3
                    : metrics.holderCount < 500
                      ? 2
                      : 1,

            contractRisk:
                metrics.contractRisk === "extreme"
                    ? 3
                    : metrics.contractRisk === "high"
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
        riskMetrics: any,
        marketHealth: any,
        volatilityMetrics: any
    ): "provide" | "avoid" | "monitor" {
        if (
            riskMetrics.contractRisk === "extreme" ||
            riskMetrics.securityScore < 50 ||
            marketHealth.liquidity < 100000
        ) {
            return "avoid";
        }

        if (
            marketHealth.feeAPY > 20 &&
            marketHealth.liquidity > 250000 &&
            marketHealth.volume24h > 100000 &&
            riskMetrics.securityScore > 70
        ) {
            return "provide";
        }

        return "monitor";
    }

    private calculateConfidenceScore(
        riskMetrics: any,
        marketHealth: any,
        volatilityMetrics: any
    ): number {
        const factors = {
            security: riskMetrics.securityScore / 100,
            liquidity: Math.min(marketHealth.liquidity / 1000000, 1),
            volume: Math.min(marketHealth.volume24h / 1000000, 1),
            stability: Math.max(0, 1 - volatilityMetrics.pairVolatility / 100),
        };

        return (Object.values(factors).reduce((a, b) => a + b, 0) / 4) * 100;
    }

    // Helper method to clear cache for testing
    clearCache(): void {
        this.cache.flushAll();
    }
}

interface PairEvaluation {
    riskLevel: "low" | "medium" | "high" | "extreme";
    marketHealth: {
        volume24h: number;
        liquidity: number;
        volumeChange24h: number;
        buyPressure: number;
        feeAPY: number;
    };
    volatilityMetrics: {
        baseVolatility: number;
        quoteVolatility: number;
        pairVolatility: number;
        priceStability: number;
    };
    recommendation: "provide" | "avoid" | "monitor";
    confidenceScore: number;
}

// Export provider interface for Eliza framework
export const birdeyeProvider = {
    name: "BIRDEYE_PROVIDER",
    description: "Provides token analysis data from Birdeye API",
    version: "1.0.0",

    initialize: async () => {
        return new BirdeyeProvider();
    },
};
