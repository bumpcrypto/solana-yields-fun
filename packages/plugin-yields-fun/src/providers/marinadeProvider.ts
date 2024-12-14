import { Connection, PublicKey } from "@solana/web3.js";
import { ICacheManager } from "@ai16z/eliza";
import NodeCache from "node-cache";
import { YieldOpportunity } from "../types/yield";
import BigNumber from "bignumber.js";

interface MarinadeStakeData {
    totalStaked: number;
    apy: number;
    validatorCount: number;
    totalValidators: number;
    epochInfo: {
        epoch: number;
        slotIndex: number;
        slotsInEpoch: number;
    };
}

interface ValidatorInfo {
    voteAccount: string;
    score: number;
    activeStake: number;
    commission: number;
    apy: number;
}

const PROVIDER_CONFIG = {
    MARINADE_PROGRAM_ID: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
    MARINADE_STATE_ID: "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    CACHE_TTL: 300, // 5 minutes
};

export class MarinadeProvider {
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
        const cacheKey = "marinade_staking_opportunities";
        const cached = this.cache.get<YieldOpportunity[]>(cacheKey);
        if (cached) return cached;

        try {
            const stakeData = await this.fetchMarinadeStakeData();
            const validators = await this.fetchValidatorList();

            const opportunities: YieldOpportunity[] = [
                {
                    protocol: "Marinade",
                    type: "STAKING",
                    apy: stakeData.apy,
                    tvl: stakeData.totalStaked,
                    risk: this.calculateRisk(stakeData, validators),
                    tokens: ["SOL", "mSOL"],
                    address: PROVIDER_CONFIG.MARINADE_STATE_ID,
                    description: `Marinade liquid staking with ${stakeData.validatorCount} active validators`,
                },
            ];

            // Add individual validator opportunities if they have higher APY
            validators
                .filter((v) => v.apy > stakeData.apy)
                .forEach((validator) => {
                    opportunities.push({
                        protocol: "Marinade",
                        type: "STAKING",
                        apy: validator.apy,
                        tvl: validator.activeStake,
                        risk: this.calculateValidatorRisk(validator),
                        tokens: ["SOL"],
                        address: validator.voteAccount,
                        description: `Marinade validator staking with ${validator.commission}% commission`,
                    });
                });

            this.cache.set(cacheKey, opportunities);
            return opportunities;
        } catch (error) {
            console.error(
                "Error fetching Marinade staking opportunities:",
                error
            );
            return [];
        }
    }

    private async fetchMarinadeStakeData(): Promise<MarinadeStakeData> {
        try {
            // TODO: Implement actual Marinade state account fetching
            // This is a placeholder until we have the actual Marinade SDK integration
            return {
                totalStaked: 1000000,
                apy: 6.5,
                validatorCount: 100,
                totalValidators: 150,
                epochInfo: {
                    epoch: 0,
                    slotIndex: 0,
                    slotsInEpoch: 0,
                },
            };
        } catch (error) {
            console.error("Error fetching Marinade stake data:", error);
            throw error;
        }
    }

    private async fetchValidatorList(): Promise<ValidatorInfo[]> {
        try {
            // TODO: Implement actual validator list fetching
            // This is a placeholder until we have the actual Marinade SDK integration
            return [
                {
                    voteAccount: "vote111111111111111111111111111111111111111",
                    score: 90,
                    activeStake: 100000,
                    commission: 5,
                    apy: 7.0,
                },
            ];
        } catch (error) {
            console.error("Error fetching validator list:", error);
            throw error;
        }
    }

    private calculateRisk(
        stakeData: MarinadeStakeData,
        validators: ValidatorInfo[]
    ): number {
        // Risk factors:
        // 1. Validator concentration
        // 2. Average validator score
        // 3. Protocol security (fixed score based on audits, TVL history, etc.)
        let risk = 3; // Base risk score - Marinade is considered relatively safe

        // Validator concentration risk
        const validatorRatio =
            stakeData.validatorCount / stakeData.totalValidators;
        if (validatorRatio < 0.3) risk += 2;
        else if (validatorRatio < 0.5) risk += 1;

        // Average validator score risk
        const avgScore =
            validators.reduce((sum, v) => sum + v.score, 0) / validators.length;
        if (avgScore < 70) risk += 2;
        else if (avgScore < 85) risk += 1;

        return Math.min(risk, 10); // Cap at 10
    }

    private calculateValidatorRisk(validator: ValidatorInfo): number {
        let risk = 4; // Base risk score - individual validators are riskier than the pool

        // Commission risk
        if (validator.commission > 10) risk += 1;

        // Score risk
        if (validator.score < 70) risk += 3;
        else if (validator.score < 85) risk += 2;
        else if (validator.score < 95) risk += 1;

        // Stake concentration risk
        if (validator.activeStake < 100000) risk += 2;
        else if (validator.activeStake < 500000) risk += 1;

        return Math.min(risk, 10); // Cap at 10
    }
}

// Create the provider instance for the Eliza framework
export const marinadeProvider = {
    get: async (runtime: any, _message: any, _state?: any): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || PROVIDER_CONFIG.DEFAULT_RPC
            );

            const provider = new MarinadeProvider(
                connection,
                runtime.cacheManager
            );
            const opportunities = await provider.getStakingOpportunities();

            // Format opportunities into a readable report
            let report = "🌊 Marinade Staking Opportunities\n\n";

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
            console.error("Error in Marinade provider:", error);
            return "Unable to fetch Marinade opportunities. Please try again later.";
        }
    },
};
