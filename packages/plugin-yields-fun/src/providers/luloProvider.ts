import { Connection, PublicKey } from "@solana/web3.js";
import { ICacheManager } from "@ai16z/eliza";
import NodeCache from "node-cache";
import { YieldOpportunity } from "../types/yield";
import BigNumber from "bignumber.js";

interface LuloAccountData {
    totalValue: number;
    interestEarned: number;
    realtimeAPY: number;
    settings: {
        owner: string;
        allowedProtocols: string;
        homebase: string | null;
        minimumRate: string;
    };
}

interface LuloOpportunity {
    protocol: string;
    apy: number;
    tvl: number;
    token: string;
    minimumDeposit: number;
}

const PROVIDER_CONFIG = {
    API_URL: "https://api.flexlend.fi",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    CACHE_TTL: 300, // 5 minutes
};

export class LuloProvider {
    private cache: NodeCache;
    private connection: Connection;
    private apiKey: string;

    constructor(
        connection: Connection,
        private cacheManager: ICacheManager,
        apiKey: string
    ) {
        this.cache = new NodeCache({ stdTTL: PROVIDER_CONFIG.CACHE_TTL });
        this.connection = connection;
        this.apiKey = apiKey;
    }

    async getYieldOpportunities(
        walletAddress: string
    ): Promise<YieldOpportunity[]> {
        const cacheKey = `lulo_opportunities_${walletAddress}`;
        const cached = this.cache.get<YieldOpportunity[]>(cacheKey);
        if (cached) return cached;

        try {
            const accountData = await this.fetchAccountData(walletAddress);
            const allowedProtocols =
                accountData.settings.allowedProtocols.split(",");

            // Convert account data into yield opportunities
            const opportunities: YieldOpportunity[] = [
                {
                    protocol: "LuLo",
                    type: "LENDING",
                    apy: accountData.realtimeAPY,
                    tvl: accountData.totalValue,
                    risk: this.calculateRisk(accountData),
                    tokens: ["USDC"], // Currently focusing on USDC
                    address: walletAddress,
                    description: `LuLo lending across ${allowedProtocols.length} protocols with auto-rebalancing`,
                },
            ];

            this.cache.set(cacheKey, opportunities);
            return opportunities;
        } catch (error) {
            console.error("Error fetching LuLo opportunities:", error);
            return [];
        }
    }

    private async fetchAccountData(
        walletAddress: string
    ): Promise<LuloAccountData> {
        try {
            const response = await fetch(`${PROVIDER_CONFIG.API_URL}/account`, {
                headers: {
                    "x-wallet-pubkey": walletAddress,
                    "x-api-key": this.apiKey,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching LuLo account data:", error);
            throw error;
        }
    }

    private calculateRisk(accountData: LuloAccountData): number {
        // Risk factors:
        // 1. Protocol diversification
        // 2. Minimum rate setting
        // 3. Total value locked
        // 4. Historical performance
        let risk = 3; // Base risk score - LuLo has good protocol diversification

        // Protocol diversification risk
        const protocolCount =
            accountData.settings.allowedProtocols.split(",").length;
        if (protocolCount < 2) risk += 3;
        else if (protocolCount < 3) risk += 2;
        else if (protocolCount < 4) risk += 1;

        // Minimum rate risk (higher minimum rate means higher risk as it may miss opportunities)
        const minRate = parseFloat(accountData.settings.minimumRate);
        if (minRate > 8) risk += 2;
        else if (minRate > 5) risk += 1;

        // TVL risk
        if (accountData.totalValue < 10000) risk += 2;
        else if (accountData.totalValue < 100000) risk += 1;

        return Math.min(risk, 10); // Cap at 10
    }

    async getAccountStats(walletAddress: string): Promise<string> {
        try {
            const accountData = await this.fetchAccountData(walletAddress);

            return `
LuLo Account Statistics:
Total Value: $${accountData.totalValue.toLocaleString()}
Interest Earned: $${accountData.interestEarned.toLocaleString()}
Current APY: ${accountData.realtimeAPY.toFixed(2)}%
Active Protocols: ${accountData.settings.allowedProtocols}
Minimum Rate: ${accountData.settings.minimumRate}%
            `.trim();
        } catch (error) {
            console.error("Error fetching account stats:", error);
            return "Unable to fetch LuLo account statistics";
        }
    }
}

// Create the provider instance for the Eliza framework
export const luloProvider = {
    get: async (runtime: any, _message: any, _state?: any): Promise<string> => {
        try {
            const connection = new Connection(runtime.getSetting("RPC_URL"));
            const apiKey = runtime.getSetting("FLEXLEND_API_KEY");
            const walletAddress = runtime.getSetting("WALLET_PUBLIC_KEY");

            if (!apiKey) {
                return "LuLo API key not configured";
            }

            const provider = new LuloProvider(
                connection,
                runtime.cacheManager,
                apiKey
            );
            const opportunities =
                await provider.getYieldOpportunities(walletAddress);
            const stats = await provider.getAccountStats(walletAddress);

            // Format opportunities into a readable report
            let report = "💰 LuLo Lending Opportunities\n\n";

            opportunities
                .sort((a, b) => b.apy - a.apy)
                .forEach((opp) => {
                    report += `${opp.description}\n`;
                    report += `APY: ${opp.apy.toFixed(2)}%\n`;
                    report += `TVL: $${opp.tvl.toLocaleString()}\n`;
                    report += `Risk: ${opp.risk}/10\n\n`;
                });

            report += "\n" + stats;

            return report;
        } catch (error) {
            console.error("Error in LuLo provider:", error);
            return "Unable to fetch LuLo opportunities. Please try again later.";
        }
    },
};
