import { Connection, PublicKey } from "@solana/web3.js";
import { ICacheManager } from "@ai16z/eliza";
import NodeCache from "node-cache";
import { YieldOpportunity } from "../types/yield";
import BigNumber from "bignumber.js";

interface LidoStakeData {
    totalStaked: number;
    apy: number;
    validatorCount: number;
    totalValidators: number;
    stSOLSupply: number;
    exchangeRate: number;
}

interface LidoValidatorInfo {
    voteAccount: string;
    score: number;
    activeStake: number;
    commission: number;
    apy: number;
    performance: number;
}

const PROVIDER_CONFIG = {
    LIDO_PROGRAM_ID: "CrX7kMhLC3cSsXJdT7JDgqrRVWGnUpX3gfEfxxU2NVLi",
    LIDO_STATE_ID: "49Yi1TKkNyYjPAFdR9LBvoHcUjuPX4Df5T5yv39w2XTn",
    STSOL_MINT: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    CACHE_TTL: 300, // 5 minutes
};

export class LidoProvider {
    private cache: NodeCache;
    private connection: Connection;

    constructor(
        connection: Connection,
        private cacheManager: ICacheManager
    ) {
        this.cache = new NodeCache({ stdTTL: PROVIDER_CONFIG.CACHE_TTL });
        this.connection = connection;
    }

    async getStakingOpportunities(): Promise<YieldOpportunity[]> {
        const cacheKey = "lido_staking_opportunities";
        const cached = this.cache.get<YieldOpportunity[]>(cacheKey);
        if (cached) return cached;

        try {
            const stakeData = await this.fetchLidoStakeData();
            const validators = await this.fetchValidatorList();

            const opportunities: YieldOpportunity[] = [
                {
                    protocol: "Lido",
                    type: "STAKING",
                    apy: stakeData.apy,
                    tvl: stakeData.totalStaked,
                    risk: this.calculateRisk(stakeData, validators),
                    tokens: ["SOL", "stSOL"],
                    address: PROVIDER_CONFIG.LIDO_STATE_ID,
                    description: `Lido liquid staking with ${stakeData.validatorCount} active validators`,
                },
            ];

            // Add individual validator opportunities if they have higher APY
            validators
                .filter((v) => v.apy > stakeData.apy)
                .forEach((validator) => {
                    opportunities.push({
                        protocol: "Lido",
                        type: "STAKING",
                        apy: validator.apy,
                        tvl: validator.activeStake,
                        risk: this.calculateValidatorRisk(validator),
                        tokens: ["SOL"],
                        address: validator.voteAccount,
                        description: `Lido validator staking with ${validator.commission}% commission`,
                    });
                });

            this.cache.set(cacheKey, opportunities);
            return opportunities;
        } catch (error) {
            console.error("Error fetching Lido staking opportunities:", error);
            return [];
        }
    }

    private async fetchLidoStakeData(): Promise<LidoStakeData> {
        try {
            // TODO: Implement actual Lido state account fetching
            // This is a placeholder until we have the actual Lido SDK integration
            return {
                totalStaked: 1000000,
                apy: 7.2,
                validatorCount: 80,
                totalValidators: 100,
                stSOLSupply: 950000,
                exchangeRate: 1.05,
            };
        } catch (error) {
            console.error("Error fetching Lido stake data:", error);
            throw error;
        }
    }

    private async fetchValidatorList(): Promise<LidoValidatorInfo[]> {
        try {
            // TODO: Implement actual validator list fetching
            // This is a placeholder until we have the actual Lido SDK integration
            return [
                {
                    voteAccount: "vote111111111111111111111111111111111111111",
                    score: 95,
                    activeStake: 150000,
                    commission: 3,
                    apy: 7.5,
                    performance: 99.9,
                },
            ];
        } catch (error) {
            console.error("Error fetching validator list:", error);
            throw error;
        }
    }

    private calculateRisk(
        stakeData: LidoStakeData,
        validators: LidoValidatorInfo[]
    ): number {
        // Risk factors:
        // 1. Validator concentration
        // 2. Average validator performance
        // 3. Protocol security (fixed score based on audits, TVL history, etc.)
        // 4. stSOL exchange rate stability
        let risk = 2; // Base risk score - Lido is considered very safe

        // Validator concentration risk
        const validatorRatio =
            stakeData.validatorCount / stakeData.totalValidators;
        if (validatorRatio < 0.3) risk += 2;
        else if (validatorRatio < 0.5) risk += 1;

        // Average validator performance risk
        const avgPerformance =
            validators.reduce((sum, v) => sum + v.performance, 0) /
            validators.length;
        if (avgPerformance < 98) risk += 2;
        else if (avgPerformance < 99) risk += 1;

        // Exchange rate risk
        const exchangeRateDeviation = Math.abs(stakeData.exchangeRate - 1);
        if (exchangeRateDeviation > 0.05) risk += 2;
        else if (exchangeRateDeviation > 0.02) risk += 1;

        return Math.min(risk, 10); // Cap at 10
    }

    private calculateValidatorRisk(validator: LidoValidatorInfo): number {
        let risk = 3; // Base risk score - individual validators in Lido are well-vetted

        // Commission risk
        if (validator.commission > 8) risk += 1;

        // Performance risk
        if (validator.performance < 98) risk += 3;
        else if (validator.performance < 99) risk += 2;
        else if (validator.performance < 99.5) risk += 1;

        // Stake concentration risk
        if (validator.activeStake < 100000) risk += 2;
        else if (validator.activeStake < 500000) risk += 1;

        return Math.min(risk, 10); // Cap at 10
    }
}

// Create the provider instance for the Eliza framework
export const lidoProvider = {
    get: async (runtime: any, _message: any, _state?: any): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || PROVIDER_CONFIG.DEFAULT_RPC
            );

            const provider = new LidoProvider(connection, runtime.cacheManager);
            const opportunities = await provider.getStakingOpportunities();

            // Format opportunities into a readable report
            let report = "🌊 Lido Staking Opportunities\n\n";

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
            console.error("Error in Lido provider:", error);
            return "Unable to fetch Lido opportunities. Please try again later.";
        }
    },
};
