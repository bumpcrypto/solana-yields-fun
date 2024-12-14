import { Connection, PublicKey } from "@solana/web3.js";
import { YieldProvider } from "./yieldProvider";
import { ICacheManager } from "@ai16z/eliza";
import { YieldOpportunity, PoolData, RiskMetrics } from "../types/yield";
import BigNumber from "bignumber.js";

interface MeteoraPool {
    address: string;
    token0: {
        address: string;
        symbol: string;
        decimals: number;
    };
    token1: {
        address: string;
        symbol: string;
        decimals: number;
    };
    fee: number;
    apy: number;
    tvl: number;
    volume24h: number;
    feesUSD24h: number;
}

export class MeteoraProvider extends YieldProvider {
    private meteoraApiUrl: string;

    constructor(
        connection: Connection,
        walletPublicKey: PublicKey,
        cacheManager: ICacheManager,
        apiKey: string
    ) {
        super(connection, walletPublicKey, cacheManager);
        this.meteoraApiUrl = `https://api.meteora.ag/v1`;
    }

    private async fetchPools(): Promise<MeteoraPool[]> {
        const cacheKey = "meteora_pools";
        const cached = await this.getCachedData<MeteoraPool[]>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const response = await this.fetchWithRetry(
                `${this.meteoraApiUrl}/pools`,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.success) {
                throw new Error("Failed to fetch Meteora pools");
            }

            const pools: MeteoraPool[] = response.data.map((pool: any) => ({
                address: pool.address,
                token0: {
                    address: pool.token0Address,
                    symbol: pool.token0Symbol,
                    decimals: pool.token0Decimals,
                },
                token1: {
                    address: pool.token1Address,
                    symbol: pool.token1Symbol,
                    decimals: pool.token1Decimals,
                },
                fee: pool.fee,
                apy: this.calculatePoolApy(pool),
                tvl: pool.tvlUSD,
                volume24h: pool.volumeUSD24h,
                feesUSD24h: pool.feesUSD24h,
            }));

            await this.writeToCache(cacheKey, pools);
            return pools;
        } catch (error) {
            console.error("Error fetching Meteora pools:", error);
            return [];
        }
    }

    private calculatePoolApy(pool: any): number {
        // Calculate APY based on 24h fees and TVL
        const dailyFeeRate = new BigNumber(pool.feesUSD24h).dividedBy(
            pool.tvlUSD
        );
        const yearlyFeeRate = dailyFeeRate.multipliedBy(365);
        return yearlyFeeRate.multipliedBy(100).toNumber(); // Convert to percentage
    }

    private calculatePoolRisk(pool: MeteoraPool): RiskMetrics {
        // Implement risk calculation specific to Meteora pools
        const volumeToTvlRatio = new BigNumber(pool.volume24h).dividedBy(
            pool.tvl
        );
        const volatilityScore = volumeToTvlRatio.multipliedBy(10).toNumber();

        // Calculate impermanent loss risk based on volume and TVL
        const ilRisk = Math.min(volatilityScore * 1.5, 10);

        // Calculate liquidity depth score
        const liquidityScore = Math.min(
            new BigNumber(pool.tvl).dividedBy(1000000).toNumber(),
            10
        );

        // Protocol risk score for Meteora (can be adjusted based on protocol security)
        const protocolRisk = 3;

        // Calculate overall risk score
        const score =
            (volatilityScore + ilRisk + (10 - liquidityScore) + protocolRisk) /
            4;

        return {
            volatility: volatilityScore,
            impermanentLoss: ilRisk,
            liquidityDepth: liquidityScore,
            counterpartyRisk: 0, // No counterparty risk in AMMs
            protocolRisk,
            score,
        };
    }

    async getYieldOpportunities(): Promise<YieldOpportunity[]> {
        const pools = await this.fetchPools();

        return pools.map((pool) => ({
            protocol: "Meteora",
            type: "LP",
            apy: pool.apy,
            tvl: pool.tvl,
            risk: this.calculatePoolRisk(pool).score,
            tokens: [pool.token0.symbol, pool.token1.symbol],
            address: pool.address,
            description: `Meteora LP pool for ${pool.token0.symbol}/${pool.token1.symbol} with ${pool.fee}% fee`,
        }));
    }

    async getPoolData(poolAddress: string): Promise<PoolData | null> {
        const pools = await this.fetchPools();
        const pool = pools.find((p) => p.address === poolAddress);

        if (!pool) {
            return null;
        }

        return {
            address: pool.address,
            token0: pool.token0.address,
            token1: pool.token1.address,
            fee: pool.fee,
            liquidity: pool.tvl,
            sqrtPrice: 0, // Need to fetch from chain
            tick: 0, // Need to fetch from chain
            token0Price: 0, // Need to fetch from chain
            token1Price: 0, // Need to fetch from chain
            token0Volume24h: 0, // Need to calculate from pool data
            token1Volume24h: 0, // Need to calculate from pool data
            volumeUSD24h: pool.volume24h,
            feesUSD24h: pool.feesUSD24h,
            tvlUSD: pool.tvl,
        };
    }
}

// Create the provider instance for the Eliza framework
export const meteoraProvider = {
    get: async (runtime: any, _message: any, _state?: any): Promise<string> => {
        try {
            const connection = new Connection(runtime.getSetting("RPC_URL"));
            const provider = new MeteoraProvider(
                connection,
                runtime.cacheManager
            );
            const opportunities = await provider.getYieldOpportunities();

            // Format opportunities into a readable report
            let report = "🌊 Meteora LP Opportunities\n\n";

            opportunities
                .sort((a, b) => b.apy - a.apy)
                .forEach((opp) => {
                    report += `${opp.description}\n`;
                    report += `APY: ${opp.apy.toFixed(2)}%\n`;
                    report += `TVL: $${opp.tvl.toLocaleString()}\n`;
                    report += `Risk: ${opp.risk}/10\n\n`;
                });

            return report;
        } catch (error) {
            console.error("Error in Meteora provider:", error);
            return "Unable to fetch Meteora opportunities. Please try again later.";
        }
    },
};
