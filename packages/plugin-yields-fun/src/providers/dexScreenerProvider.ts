import { IAgentRuntime, Memory, State } from "@ai16z/eliza";
import axios from "axios";

interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5?: {
            buys: number;
            sells: number;
        };
        h1: {
            buys: number;
            sells: number;
        };
        h6: {
            buys: number;
            sells: number;
        };
        h24: {
            buys: number;
            sells: number;
        };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv?: number;
    marketCap?: number;
}

interface DexScreenerResponse {
    schemaVersion: string;
    pairs: DexScreenerPair[];
}

export class DexScreenerProvider {
    private baseUrl = "https://api.dexscreener.com/latest/dex";
    private cache: Map<string, { data: any; timestamp: number }>;
    private cacheDuration = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.cache = new Map();
    }

    async getTrendingSolanaPairs(
        minLiquidityUsd = 50000
    ): Promise<DexScreenerPair[]> {
        const cacheKey = `trending_${minLiquidityUsd}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }

        try {
            // Get pairs from all major Solana DEXes
            const [raydiumPairs, meteoraPairs, orcaPairs] = await Promise.all([
                this.getPairsByDex("raydium"),
                this.getPairsByDex("meteora"),
                this.getPairsByDex("orca"),
            ]);

            const allPairs = [...raydiumPairs, ...meteoraPairs, ...orcaPairs];

            // Filter and sort by recent volume and liquidity
            const trendingPairs = allPairs
                .filter(
                    (pair) =>
                        pair.liquidity.usd >= minLiquidityUsd &&
                        pair.volume.h24 > 0
                )
                .sort((a, b) => b.volume.h24 - a.volume.h24)
                .slice(0, 50); // Top 50 pairs

            this.cache.set(cacheKey, {
                data: trendingPairs,
                timestamp: Date.now(),
            });

            return trendingPairs;
        } catch (error) {
            console.error("Error fetching trending pairs:", error);
            return [];
        }
    }

    async getPairsByTokenAddress(address: string): Promise<DexScreenerPair[]> {
        const cacheKey = `token_${address}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }

        try {
            const response = await axios.get<DexScreenerResponse>(
                `${this.baseUrl}/tokens/${address}`
            );

            // Filter for Solana pairs only
            const solanaPairs = (response.data.pairs || []).filter(
                (pair) => pair.chainId === "solana"
            );

            this.cache.set(cacheKey, {
                data: solanaPairs,
                timestamp: Date.now(),
            });

            return solanaPairs;
        } catch (error) {
            console.error("Error fetching pairs from DexScreener:", error);
            return [];
        }
    }

    async getPairsByDex(dexId: string): Promise<DexScreenerPair[]> {
        const cacheKey = `dex_${dexId}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.data;
        }

        try {
            const response = await axios.get<DexScreenerResponse>(
                `${this.baseUrl}/pairs/solana/${dexId}`
            );

            const pairs = response.data.pairs || [];

            this.cache.set(cacheKey, {
                data: pairs,
                timestamp: Date.now(),
            });

            return pairs;
        } catch (error) {
            console.error("Error fetching pairs from DexScreener:", error);
            return [];
        }
    }

    async getBestDexForPair(
        baseAddress: string,
        quoteAddress: string
    ): Promise<{
        dexId: string;
        score: number;
        volumeUsd24h: number;
        liquidityUsd: number;
        pairAddress: string;
    }> {
        const pairs = await this.getPairsByTokenAddress(baseAddress);

        // Find all pairs matching our token pair
        const matchingPairs = pairs.filter(
            (pair) =>
                (pair.baseToken.address.toLowerCase() ===
                    baseAddress.toLowerCase() &&
                    pair.quoteToken.address.toLowerCase() ===
                        quoteAddress.toLowerCase()) ||
                (pair.baseToken.address.toLowerCase() ===
                    quoteAddress.toLowerCase() &&
                    pair.quoteToken.address.toLowerCase() ===
                        baseAddress.toLowerCase())
        );

        if (matchingPairs.length === 0) {
            return {
                dexId: "none",
                score: 0,
                volumeUsd24h: 0,
                liquidityUsd: 0,
                pairAddress: "",
            };
        }

        // Score each pair based on volume and liquidity
        const scoredPairs = matchingPairs.map((pair) => ({
            dexId: pair.dexId,
            score: pair.volume.h24 * 0.7 + pair.liquidity.usd * 0.3,
            volumeUsd24h: pair.volume.h24,
            liquidityUsd: pair.liquidity.usd,
            pairAddress: pair.pairAddress,
        }));

        // Return the best scoring pair
        return scoredPairs.reduce((best, current) =>
            current.score > best.score ? current : best
        );
    }
}

export const dexScreenerProvider = {
    provide: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const provider = new DexScreenerProvider();
        return provider;
    },
};
