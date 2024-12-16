import { Connection, PublicKey } from "@solana/web3.js";
import { ICacheManager } from "@ai16z/eliza";
import { YieldOpportunity, RiskMetrics } from "../types/yield";
import axios from "axios";

export abstract class YieldProvider {
    protected connection: Connection;
    protected walletPublicKey: PublicKey | null;
    protected cacheManager: ICacheManager;

    constructor(
        connection: Connection,
        walletPublicKey: PublicKey | null,
        cacheManager: ICacheManager
    ) {
        this.connection = connection;
        this.walletPublicKey = walletPublicKey;
        this.cacheManager = cacheManager;
    }

    // Core methods that all providers must implement
    abstract getYieldOpportunities(): Promise<YieldOpportunity[]>;

    // Common utility methods
    protected async getCachedData<T>(key: string): Promise<T | null> {
        try {
            return await this.cacheManager.get(key);
        } catch (error) {
            console.error("Cache read error:", error);
            return null;
        }
    }

    protected async writeToCache<T>(key: string, data: T): Promise<void> {
        try {
            await this.cacheManager.set(key, data);
        } catch (error) {
            console.error("Cache write error:", error);
        }
    }

    protected async fetchWithRetry(
        url: string,
        options: any,
        retries: number = 3,
        delay: number = 1000
    ): Promise<any> {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await axios.get(url, options);
                return response.data;
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise((resolve) =>
                    setTimeout(resolve, delay * (i + 1))
                );
            }
        }
    }

    // Common risk calculation methods
    protected calculateBaseRiskMetrics(
        tvl: number,
        volume24h: number,
        volatility: number = 0,
        protocolRisk: number = 5
    ): RiskMetrics {
        const volumeToTvlRatio = volume24h / tvl;
        const volatilityScore = Math.min(volatility * 10, 10);
        const liquidityScore = Math.min(tvl / 1000000, 10);

        // Calculate impermanent loss risk based on volume and TVL
        const ilRisk = Math.min(volumeToTvlRatio * 10, 10);

        return {
            volatility: volatilityScore,
            impermanentLoss: ilRisk,
            liquidityDepth: liquidityScore,
            counterpartyRisk: 0,
            protocolRisk,
            score:
                (volatilityScore +
                    ilRisk +
                    (10 - liquidityScore) +
                    protocolRisk) /
                4,
        };
    }

    // Helper methods for APY/APR calculations
    protected calculateDailyRate(
        dailyVolume: number,
        fee: number,
        tvl: number
    ): number {
        return (dailyVolume * fee) / tvl;
    }

    protected calculateAPY(dailyRate: number): number {
        return (Math.pow(1 + dailyRate, 365) - 1) * 100;
    }

    protected calculateAPR(dailyRate: number): number {
        return dailyRate * 365 * 100;
    }
}
