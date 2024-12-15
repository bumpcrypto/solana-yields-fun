import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";
import { DexScreenerProvider } from "./dexScreenerProvider";
import axios from "axios";

export interface TokenSecurityMetrics {
    ownerBalance: string;
    creatorBalance: string;
    ownerPercentage: number;
    creatorPercentage: number;
    top10HolderBalance: string;
    top10HolderPercent: number;
    isHoneypot: boolean;
    hasRenounced: boolean;
    hasBlacklist: boolean;
    hasMintFunction: boolean;
}

export interface TokenTradingMetrics {
    price: number;
    priceChange24h: number;
    volume24h: number;
    volumeChange24h: number;
    mcap: number;
    uniqueHolders: number;
    buyTaxBps: number;
    sellTaxBps: number;
    liquidityUSD: number;
    liquiditySOL: number;
}

export interface TokenPairTrustMetrics {
    volumeScore: number;
    liquidityScore: number;
    volatilityScore: number;
    transactionScore: number;
    securityScore: number;
    overallTrustScore: number;
    lastUpdated: Date;
}

export interface TokenPairTrustState {
    baseAddress: string;
    quoteAddress: string;
    security: TokenSecurityMetrics;
    trading: TokenTradingMetrics;
    metrics: TokenPairTrustMetrics;
    recommendations: {
        shouldProvide: boolean;
        riskLevel: "low" | "medium" | "high" | "extreme";
        maxExposure: number;
        warning: string[];
    };
}

export class TokenPairTrustManager {
    private dexScreener: DexScreenerProvider;
    private trustScoreCache: Map<string, TokenPairTrustState>;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly BIRDEYE_API_KEY: string;
    private readonly BIRDEYE_BASE_URL = "https://public-api.birdeye.so";

    constructor(runtime?: IAgentRuntime) {
        this.dexScreener = new DexScreenerProvider();
        this.trustScoreCache = new Map();
        this.BIRDEYE_API_KEY = runtime?.getSetting("BIRDEYE_API_KEY") || "";
    }

    private getCacheKey(baseAddress: string, quoteAddress: string): string {
        return `${baseAddress}-${quoteAddress}`;
    }

    private async getBirdeyeTokenInfo(tokenAddress: string) {
        try {
            const response = await axios.get(
                `${this.BIRDEYE_BASE_URL}/public/token_list`,
                {
                    headers: {
                        "X-API-KEY": this.BIRDEYE_API_KEY,
                    },
                    params: {
                        address: tokenAddress,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching Birdeye token info:", error);
            return null;
        }
    }

    private async getBirdeyeSecurityInfo(tokenAddress: string) {
        try {
            const response = await axios.get(
                `${this.BIRDEYE_BASE_URL}/public/token_security`,
                {
                    headers: {
                        "X-API-KEY": this.BIRDEYE_API_KEY,
                    },
                    params: {
                        address: tokenAddress,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching Birdeye security info:", error);
            return null;
        }
    }

    private async getBirdeyeMarketInfo(tokenAddress: string) {
        try {
            const response = await axios.get(
                `${this.BIRDEYE_BASE_URL}/public/market_info`,
                {
                    headers: {
                        "X-API-KEY": this.BIRDEYE_API_KEY,
                    },
                    params: {
                        address: tokenAddress,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching Birdeye market info:", error);
            return null;
        }
    }

    async calculateTrustMetrics(
        baseAddress: string,
        quoteAddress: string
    ): Promise<{
        security: TokenSecurityMetrics;
        trading: TokenTradingMetrics;
        metrics: TokenPairTrustMetrics;
    }> {
        // Fetch data from Birdeye API
        const [tokenInfo, securityInfo, marketInfo] = await Promise.all([
            this.getBirdeyeTokenInfo(baseAddress),
            this.getBirdeyeSecurityInfo(baseAddress),
            this.getBirdeyeMarketInfo(baseAddress),
        ]);

        // Get DexScreener data for cross-validation
        const pairs =
            await this.dexScreener.getPairsByTokenAddress(baseAddress);
        const solPair = pairs.find(
            (p) =>
                p.quoteToken.symbol === "SOL" || p.quoteToken.symbol === "WSOL"
        );

        // Security Metrics
        const security: TokenSecurityMetrics = {
            ownerBalance: securityInfo?.ownerBalance || "0",
            creatorBalance: securityInfo?.creatorBalance || "0",
            ownerPercentage: securityInfo?.ownerPercentage || 0,
            creatorPercentage: securityInfo?.creatorPercentage || 0,
            top10HolderBalance: securityInfo?.top10HolderBalance || "0",
            top10HolderPercent: securityInfo?.top10HolderPercent || 0,
            isHoneypot: securityInfo?.isHoneypot || false,
            hasRenounced: securityInfo?.hasRenounced || false,
            hasBlacklist: securityInfo?.hasBlacklist || false,
            hasMintFunction: securityInfo?.hasMintFunction || false,
        };

        // Trading Metrics
        const trading: TokenTradingMetrics = {
            price: marketInfo?.price || 0,
            priceChange24h: marketInfo?.priceChange24h || 0,
            volume24h: marketInfo?.volume24h || 0,
            volumeChange24h: marketInfo?.volumeChange24h || 0,
            mcap: marketInfo?.mcap || 0,
            uniqueHolders: marketInfo?.uniqueHolders || 0,
            buyTaxBps: marketInfo?.buyTaxBps || 0,
            sellTaxBps: marketInfo?.sellTaxBps || 0,
            liquidityUSD: solPair?.liquidity?.usd || 0,
            liquiditySOL: solPair?.liquidity?.base || 0,
        };

        // Calculate Trust Metrics
        const metrics = this.calculateScores(security, trading);

        return { security, trading, metrics };
    }

    private calculateScores(
        security: TokenSecurityMetrics,
        trading: TokenTradingMetrics
    ): TokenPairTrustMetrics {
        // Volume Score (0-100)
        const volumeScore = Math.min(100, (trading.volume24h / 50000) * 100);

        // Liquidity Score (0-100)
        const liquidityScore = Math.min(
            100,
            (trading.liquidityUSD / 100000) * 100
        );

        // Volatility Score (0-100, lower is better)
        const volatilityScore = Math.max(
            0,
            100 - Math.abs(trading.priceChange24h) * 2
        );

        // Transaction Score based on holder count and distribution
        const transactionScore = Math.min(
            100,
            (trading.uniqueHolders / 1000) * 100
        );

        // Security Score based on multiple factors
        let securityScore = 100;
        if (security.isHoneypot) securityScore -= 100;
        if (security.hasBlacklist) securityScore -= 20;
        if (security.hasMintFunction) securityScore -= 30;
        if (!security.hasRenounced) securityScore -= 10;
        if (security.top10HolderPercent > 50) securityScore -= 20;
        if (trading.buyTaxBps > 1000 || trading.sellTaxBps > 1000)
            securityScore -= 30;
        securityScore = Math.max(0, securityScore);

        // Overall Trust Score (weighted average)
        const overallTrustScore =
            volumeScore * 0.2 +
            liquidityScore * 0.2 +
            volatilityScore * 0.2 +
            transactionScore * 0.2 +
            securityScore * 0.2;

        return {
            volumeScore,
            liquidityScore,
            volatilityScore,
            transactionScore,
            securityScore,
            overallTrustScore,
            lastUpdated: new Date(),
        };
    }

    async getTrustState(
        baseAddress: string,
        quoteAddress: string
    ): Promise<TokenPairTrustState> {
        const cacheKey = this.getCacheKey(baseAddress, quoteAddress);
        const cached = this.trustScoreCache.get(cacheKey);

        if (
            cached &&
            Date.now() - cached.metrics.lastUpdated.getTime() <
                this.CACHE_DURATION
        ) {
            return cached;
        }

        const { security, trading, metrics } = await this.calculateTrustMetrics(
            baseAddress,
            quoteAddress
        );

        const warnings: string[] = [];
        if (security.isHoneypot) warnings.push("Token is a potential honeypot");
        if (security.hasBlacklist)
            warnings.push("Token contract has blacklist function");
        if (security.hasMintFunction)
            warnings.push("Token contract has mint function");
        if (security.top10HolderPercent > 50)
            warnings.push("High concentration of tokens in top holders");
        if (trading.buyTaxBps > 1000 || trading.sellTaxBps > 1000)
            warnings.push("High transaction taxes detected");
        if (trading.liquidityUSD < 10000)
            warnings.push("Low liquidity, high slippage risk");
        if (trading.uniqueHolders < 100)
            warnings.push("Low number of unique holders");

        const trustState: TokenPairTrustState = {
            baseAddress,
            quoteAddress,
            security,
            trading,
            metrics,
            recommendations: {
                shouldProvide: metrics.overallTrustScore >= 70,
                riskLevel:
                    metrics.overallTrustScore >= 80
                        ? "low"
                        : metrics.overallTrustScore >= 60
                          ? "medium"
                          : metrics.overallTrustScore >= 40
                            ? "high"
                            : "extreme",
                maxExposure: Math.min(
                    trading.liquidityUSD * 0.01,
                    metrics.overallTrustScore * 100
                ),
                warning: warnings,
            },
        };

        this.trustScoreCache.set(cacheKey, trustState);
        return trustState;
    }
}

export const tokenPairTrustProvider: Provider = {
    provide: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        return new TokenPairTrustManager(runtime);
    },
};
