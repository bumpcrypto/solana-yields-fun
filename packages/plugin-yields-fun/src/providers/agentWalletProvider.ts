import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import {
    ICacheManager,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@ai16z/eliza";
import NodeCache from "node-cache";
import BigNumber from "bignumber.js";
import {
    VaultAccount,
    VaultStats,
    UserPosition,
    VaultAction,
} from "../types/vault";

const PROVIDER_CONFIG = {
    BIRDEYE_API: "https://public-api.birdeye.so",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    CACHE_TTL: 300, // 5 minutes
};

export class AgentWalletProvider {
    private cache: NodeCache;
    private vaultProgramId: PublicKey;

    constructor(
        private connection: Connection,
        private agentId: string,
        private cacheManager: ICacheManager
    ) {
        this.cache = new NodeCache({ stdTTL: PROVIDER_CONFIG.CACHE_TTL });
        // This will be your deployed program ID
        this.vaultProgramId = new PublicKey("YOUR_PROGRAM_ID_HERE");
    }

    async findVaultAddress(agentId: string): Promise<[PublicKey, number]> {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), Buffer.from(agentId)],
            this.vaultProgramId
        );
    }

    async getVaultAccount(agentId: string): Promise<VaultAccount | null> {
        const cacheKey = `vault_${agentId}`;
        const cached = this.cache.get<VaultAccount>(cacheKey);
        if (cached) return cached;

        try {
            const [vaultAddress] = await this.findVaultAddress(agentId);
            const accountInfo =
                await this.connection.getAccountInfo(vaultAddress);

            if (!accountInfo) return null;

            // Parse account data based on your vault program's structure
            // This is a placeholder - you'll need to implement actual parsing
            const vaultAccount: VaultAccount = {
                agentId,
                authority: new PublicKey(accountInfo.data.slice(0, 32)),
                totalShares: new BN(accountInfo.data.slice(32, 40)),
                totalAssets: new BN(accountInfo.data.slice(40, 48)),
                allowedTokens: [],
                strategies: [],
                performanceFee: 0,
                managementFee: 0,
                lastHarvestTime: new BN(0),
            };

            this.cache.set(cacheKey, vaultAccount);
            return vaultAccount;
        } catch (error) {
            console.error("Error fetching vault account:", error);
            return null;
        }
    }

    async getVaultStats(agentId: string): Promise<VaultStats> {
        const cacheKey = `vault_stats_${agentId}`;
        const cached = this.cache.get<VaultStats>(cacheKey);
        if (cached) return cached;

        const vault = await this.getVaultAccount(agentId);
        if (!vault) throw new Error("Vault not found");

        // Calculate stats based on vault data
        const stats: VaultStats = {
            tvl: 0, // Calculate based on totalAssets
            apy: 0, // Calculate based on historical performance
            totalShares: vault.totalShares.toNumber(),
            totalUsers: 0, // Need to fetch from program
            performanceFee: vault.performanceFee,
            managementFee: vault.managementFee,
            allowedTokens: vault.allowedTokens.map((t) => t.toString()),
            activeStrategies: vault.strategies.map((s) => s.toString()),
        };

        this.cache.set(cacheKey, stats);
        return stats;
    }

    async getUserPosition(
        userAddress: PublicKey
    ): Promise<UserPosition | null> {
        const cacheKey = `position_${userAddress.toString()}`;
        const cached = this.cache.get<UserPosition>(cacheKey);
        if (cached) return cached;

        try {
            // Fetch user's position from your program
            // This is a placeholder - implement actual fetching
            return null;
        } catch (error) {
            console.error("Error fetching user position:", error);
            return null;
        }
    }

    async getVaultActions(limit: number = 10): Promise<VaultAction[]> {
        const cacheKey = `vault_actions_${limit}`;
        const cached = this.cache.get<VaultAction[]>(cacheKey);
        if (cached) return cached;

        try {
            // Fetch recent vault actions from your program
            // This is a placeholder - implement actual fetching
            return [];
        } catch (error) {
            console.error("Error fetching vault actions:", error);
            return [];
        }
    }

    async getFormattedReport(runtime: IAgentRuntime): Promise<string> {
        try {
            const stats = await this.getVaultStats(this.agentId);
            const recentActions = await this.getVaultActions(5);

            let report = `🏦 Agent Vault Report\n\n`;

            // Add vault stats
            report += `📊 Vault Statistics:\n`;
            report += `TVL: $${stats.tvl.toLocaleString()}\n`;
            report += `APY: ${stats.apy.toFixed(2)}%\n`;
            report += `Total Users: ${stats.totalUsers}\n`;
            report += `Performance Fee: ${stats.performanceFee}%\n`;
            report += `Management Fee: ${stats.managementFee}%\n\n`;

            // Add active strategies
            report += `🎯 Active Strategies:\n`;
            for (const strategy of stats.activeStrategies) {
                report += `- ${strategy}\n`;
            }
            report += `\n`;

            // Add recent actions
            report += `📝 Recent Actions:\n`;
            for (const action of recentActions) {
                report += `${action.type}: ${action.amount} ${action.token}\n`;
                report += `Status: ${action.status} | Tx: ${action.txHash}\n\n`;
            }

            return report;
        } catch (error) {
            console.error("Error generating vault report:", error);
            return "Unable to fetch vault information. Please try again later.";
        }
    }
}

// Create the provider instance for the Eliza framework
const agentWalletProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || PROVIDER_CONFIG.DEFAULT_RPC
            );

            const agentId = runtime.agentId;

            const provider = new AgentWalletProvider(
                connection,
                agentId,
                runtime.cacheManager
            );

            return provider.getFormattedReport(runtime);
        } catch (error) {
            console.error("Error in agent wallet provider:", error);
            return "Unable to fetch wallet information. Please try again later.";
        }
    },
};

export { agentWalletProvider };
