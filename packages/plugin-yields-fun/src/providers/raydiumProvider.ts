import { Connection, PublicKey } from "@solana/web3.js";
import { ICacheManager } from "@ai16z/eliza";
import { Liquidity, LiquidityPoolKeys, Market } from "@raydium-io/raydium-sdk";
import NodeCache from "node-cache";
import { YieldOpportunity, PoolData } from "../types/yield";
import BigNumber from "bignumber.js";

const PROVIDER_CONFIG = {
    BIRDEYE_API: "https://public-api.birdeye.so",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    CACHE_TTL: 300, // 5 minutes
};

export class RaydiumProvider {
    private cache: NodeCache;
    private connection: Connection;

    constructor(
        connection: Connection,
        private cacheManager: ICacheManager
    ) {
        this.cache = new NodeCache({ stdTTL: PROVIDER_CONFIG.CACHE_TTL });
        this.connection = connection;
    }

    async getLPOpportunities(): Promise<YieldOpportunity[]> {
        const cacheKey = "raydium_lp_opportunities";
        const cached = this.cache.get<YieldOpportunity[]>(cacheKey);
        if (cached) return cached;

        try {
            // Fetch all Raydium pools
            const pools = await this.fetchRaydiumPools();
            const opportunities: YieldOpportunity[] = [];

            for (const pool of pools) {
                const apy = await this.calculatePoolAPY(pool);

                opportunities.push({
                    protocol: "Raydium",
                    type: "LP",
                    apy,
                    tvl: pool.tvlUSD,
                    risk: this.calculatePoolRisk(pool),
                    tokens: [pool.token0, pool.token1],
                    address: pool.address,
                    description: `Raydium LP pool for ${pool.token0}/${pool.token1}`,
                });
            }

            this.cache.set(cacheKey, opportunities);
            return opportunities;
        } catch (error) {
            console.error("Error fetching Raydium LP opportunities:", error);
            return [];
        }
    }

    private async fetchRaydiumPools(): Promise<PoolData[]> {
        try {
            // Get all liquidity pools from Raydium SDK
            const allPools = await Liquidity.fetchAllPoolKeys(this.connection);

            const poolsData: PoolData[] = await Promise.all(
                allPools.map(async (poolKeys: LiquidityPoolKeys) => {
                    const poolInfo = await Liquidity.fetchInfo({
                        connection: this.connection,
                        poolKeys,
                    });

                    const marketInfo = await Market.fetchInfo({
                        connection: this.connection,
                        marketId: poolKeys.marketId,
                    });

                    // Calculate pool metrics
                    const tvlUSD = this.calculateTVL(poolInfo, marketInfo);
                    const volume24h = await this.fetch24hVolume(poolKeys.id);

                    return {
                        address: poolKeys.id.toString(),
                        token0: poolKeys.baseMint.toString(),
                        token1: poolKeys.quoteMint.toString(),
                        fee: poolInfo.fee,
                        liquidity: poolInfo.lpSupply,
                        sqrtPrice: marketInfo.sqrtPrice,
                        tick: marketInfo.tickCurrent,
                        token0Price: marketInfo.price,
                        token1Price: 1 / marketInfo.price,
                        token0Volume24h: volume24h.token0,
                        token1Volume24h: volume24h.token1,
                        volumeUSD24h: volume24h.usd,
                        feesUSD24h: volume24h.usd * (poolInfo.fee / 1_000_000),
                        tvlUSD,
                    };
                })
            );

            return poolsData;
        } catch (error) {
            console.error("Error fetching Raydium pools:", error);
            return [];
        }
    }

    private async calculatePoolAPY(pool: PoolData): Promise<number> {
        // Calculate APY based on 24h fees and TVL
        const dailyFeeRate = pool.feesUSD24h / pool.tvlUSD;
        const yearlyFeeRate = dailyFeeRate * 365;
        return yearlyFeeRate * 100; // Convert to percentage
    }

    private calculatePoolRisk(pool: PoolData): number {
        // Risk factors:
        // 1. Low liquidity (< $100k) - high risk
        // 2. High volatility (price impact)
        // 3. Low volume (< $10k/24h)
        let risk = 5; // Base risk score out of 10

        if (pool.tvlUSD < 100000) risk += 2;
        if (pool.volumeUSD24h < 10000) risk += 2;

        // Calculate price impact for 1000 USD trade
        const priceImpact = 1000 / pool.tvlUSD;
        if (priceImpact > 0.01) risk += 1; // >1% price impact

        return Math.min(risk, 10); // Cap at 10
    }

    private async fetch24hVolume(poolId: PublicKey): Promise<{
        token0: number;
        token1: number;
        usd: number;
    }> {
        // Use Birdeye API to fetch volume data
        try {
            const response = await fetch(
                `${PROVIDER_CONFIG.BIRDEYE_API}/dex/pools/${poolId}/volume?range=24h`,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = await response.json();
            return {
                token0: data.data.token0Volume || 0,
                token1: data.data.token1Volume || 0,
                usd: data.data.volumeUSD || 0,
            };
        } catch (error) {
            console.error("Error fetching 24h volume:", error);
            return { token0: 0, token1: 0, usd: 0 };
        }
    }

    private calculateTVL(poolInfo: any, marketInfo: any): number {
        const token0Amount = new BigNumber(poolInfo.baseReserve.toString());
        const token1Amount = new BigNumber(poolInfo.quoteReserve.toString());

        // Use market price to calculate TVL in USD
        const token0Value = token0Amount.multipliedBy(marketInfo.price);
        const token1Value = token1Amount;

        return token0Value.plus(token1Value).toNumber();
    }
}

// Create the provider instance for the Eliza framework
export const raydiumProvider = {
    get: async (runtime: any, _message: any, _state?: any): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || PROVIDER_CONFIG.DEFAULT_RPC
            );

            const provider = new RaydiumProvider(
                connection,
                runtime.cacheManager
            );
            const opportunities = await provider.getLPOpportunities();

            // Format opportunities into a readable report
            let report = "🌊 Raydium LP Opportunities\n\n";

            opportunities
                .sort((a, b) => b.apy - a.apy)
                .slice(0, 5) // Top 5 opportunities
                .forEach((opp) => {
                    report += `${opp.tokens[0]}/${opp.tokens[1]}\n`;
                    report += `APY: ${opp.apy.toFixed(2)}%\n`;
                    report += `TVL: $${opp.tvl.toLocaleString()}\n`;
                    report += `Risk: ${opp.risk}/10\n\n`;
                });

            return report;
        } catch (error) {
            console.error("Error in Raydium provider:", error);
            return "Unable to fetch Raydium opportunities. Please try again later.";
        }
    },
};
