import { Action, IAgentRuntime, Memory } from "@ai16z/eliza";
import { Connection, PublicKey } from "@solana/web3.js";
import { FarmRewardInfo } from "@raydium-io/raydium-sdk-v2";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

export const createRaydiumFarmAction: Action = {
    name: "CREATE_RAYDIUM_FARM",
    similes: ["CREATE_FARM", "SETUP_FARM", "INITIALIZE_FARM"],
    description:
        "Creates a new Raydium farm with specified pool and reward parameters",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if message contains required parameters
        const content = message.content as any;
        return !!(content.poolId && content.rewardMint && content.rewardAmount);
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            const content = message.content as any;
            const { poolId, rewardMint, rewardAmount } = content;

            // Initialize Raydium SDK
            const { initSdk } = await import("@raydium-io/raydium-sdk-v2");
            const raydium = await initSdk();

            // Setup connection
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || DEFAULT_RPC
            );

            // Fetch pool info
            const poolInfo = (
                await raydium.api.fetchPoolById({ ids: poolId })
            )[0];
            if (!poolInfo) throw new Error("Pool not found");

            // Get reward token info
            const rewardTokenInfo =
                await raydium.token.getTokenInfo(rewardMint);
            const currentChainTime = await raydium.currentBlockChainTime();
            const openTime = Math.floor(currentChainTime / 1000); // in seconds
            const endTime = openTime + 60 * 60 * 24 * 7; // 7 days

            // Create reward info
            const rewardInfos: FarmRewardInfo[] = [
                {
                    mint: new PublicKey(rewardTokenInfo.address),
                    perSecond: rewardAmount,
                    openTime,
                    endTime,
                    rewardType: "Standard SPL",
                },
            ];

            // Create farm
            const { execute, extInfo } = await raydium.farm.create({
                poolInfo,
                rewardInfos,
                txVersion: 0, // Use latest version
            });

            // Execute transaction
            const { txId } = await execute({ sendAndConfirm: true });

            return {
                success: true,
                farmId: extInfo.farmId.toBase58(),
                txId,
            };
        } catch (error) {
            console.error("Error creating Raydium farm:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a Raydium farm",
                    poolId: "pool123",
                    rewardMint: "mint456",
                    rewardAmount: "1000000",
                    action: "CREATE_RAYDIUM_FARM",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Farm created successfully",
                    farmId: "farm789",
                    txId: "tx123",
                },
            },
        ],
    ],
};
