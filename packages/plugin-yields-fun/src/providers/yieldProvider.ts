import {
    ICacheManager,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@ai16z/eliza";
import { Connection, PublicKey } from "@solana/web3.js";
import NodeCache from "node-cache";
import * as path from "path";
import {
    YieldOpportunity,
    PoolData,
    StableYieldData,
    TokenPrice,
    YieldStats,
    RiskMetrics,
} from "../types/yield";

const PROVIDER_CONFIG = {
    BIRDEYE_API: "https://public-api.birdeye.so",
    DEXSCREENER_API: "https://api.dexscreener.com/latest/dex",
    JUPITER_API: "https://price.jup.ag/v4",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    CACHE_TTL: 300, // 5 minutes
};

export class YieldProvider {
    private cache: NodeCache;
    private cacheKey: string = "yields/opportunities";

    constructor(
        private connection: Connection,
        private walletPublicKey: PublicKey,
        private cacheManager: ICacheManager
    ) {
        this.cache = new NodeCache({ stdTTL: PROVIDER_CONFIG.CACHE_TTL });
    }

    private async readFromCache<T>(key: string): Promise<T | null> {
        const cached = await this.cacheManager.get<T>(
            path.join(this.cacheKey, key)
        );
        return cached;
    }

    private async writeToCache<T>(key: string, data: T): Promise<void> {
        await this.cacheManager.set(path.join(this.cacheKey, key), data, {
            expires: Date.now() + PROVIDER_CONFIG.CACHE_TTL * 1000,
        });
    }

    private async getCachedData<T>(key: string): Promise<T | null> {
        // Check in-memory cache first
        const cachedData = this.cache.get<T>(key);
        if (cachedData) {
            return cachedData;
        }

        // Check file-based cache
        const fileCachedData = await this.readFromCache<T>(key);
        if (fileCachedData) {
            // Populate in-memory cache
            this.cache.set(key, fileCachedData);
            return fileCachedData;
        }

        return null;
    }

    private async fetchWithRetry(
        url: string,
        options: RequestInit = {}
    ): Promise<any> {
        let lastError: Error;

        for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                lastError = error;
                if (i < PROVIDER_CONFIG.MAX_RETRIES - 1) {
                    await new Promise((resolve) =>
                        setTimeout(
                            resolve,
                            PROVIDER_CONFIG.RETRY_DELAY * Math.pow(2, i)
                        )
                    );
                }
            }
        }

        throw lastError;
    }

    async getYieldOpportunities(): Promise<YieldOpportunity[]> {
        const cacheKey = "all_opportunities";
        const cached = await this.getCachedData<YieldOpportunity[]>(cacheKey);
        if (cached) {
            return cached;
        }

        // This will be implemented by specific protocol providers
        return [];
    }

    async calculateRiskMetrics(
        opportunity: YieldOpportunity
    ): Promise<RiskMetrics> {
        // Implement risk calculation logic
        return {
            volatility: 0,
            impermanentLoss: 0,
            liquidityDepth: 0,
            counterpartyRisk: 0,
            protocolRisk: 0,
            score: 0,
        };
    }

    async getYieldStats(): Promise<YieldStats> {
        const cacheKey = "yield_stats";
        const cached = await this.getCachedData<YieldStats>(cacheKey);
        if (cached) {
            return cached;
        }

        // This will be implemented to track overall performance
        return {
            timestamp: Date.now(),
            totalValueLocked: 0,
            totalYieldGenerated: 0,
            averageApy: 0,
            numberOfPositions: 0,
            profitLoss: 0,
        };
    }

    async getFormattedReport(): Promise<string> {
        try {
            const opportunities = await this.getYieldOpportunities();
            const stats = await this.getYieldStats();

            let report = "🌾 Yield Farming Opportunities Report\n\n";

            // Add overall stats
            report += "📊 Overall Stats:\n";
            report += `Total Value Locked: $${stats.totalValueLocked.toLocaleString()}\n`;
            report += `Total Yield Generated: $${stats.totalYieldGenerated.toLocaleString()}\n`;
            report += `Average APY: ${stats.averageApy.toFixed(2)}%\n`;
            report += `Active Positions: ${stats.numberOfPositions}\n`;
            report += `P&L: $${stats.profitLoss.toLocaleString()}\n\n`;

            // Add opportunities
            report += "🎯 Top Opportunities:\n";
            const sortedOpps = opportunities.sort((a, b) => b.apy - a.apy);
            for (const opp of sortedOpps.slice(0, 5)) {
                const risk = await this.calculateRiskMetrics(opp);
                report += `\n${opp.protocol} - ${opp.type}\n`;
                report += `APY: ${opp.apy.toFixed(2)}%\n`;
                report += `TVL: $${opp.tvl.toLocaleString()}\n`;
                report += `Risk Score: ${risk.score.toFixed(2)}/10\n`;
                report += `Tokens: ${opp.tokens.join("/")}\n`;
            }

            return report;
        } catch (error) {
            console.error("Error generating yield report:", error);
            return "Unable to fetch yield information. Please try again later.";
        }
    }
}

// Create the provider instance for the Eliza framework
const yieldProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || PROVIDER_CONFIG.DEFAULT_RPC
            );

            const { publicKey } = await runtime.walletManager.getWallet();

            const provider = new YieldProvider(
                connection,
                publicKey,
                runtime.cacheManager
            );

            return provider.getFormattedReport();
        } catch (error) {
            console.error("Error in yield provider:", error);
            return "Unable to fetch yield information. Please try again later.";
        }
    },
};

export { yieldProvider };
