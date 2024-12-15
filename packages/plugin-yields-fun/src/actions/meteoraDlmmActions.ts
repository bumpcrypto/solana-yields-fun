import { IAgentRuntime, Memory, State } from "@ai16z/eliza";
import {
    Connection,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import { BN } from "@coral-xyz/anchor";

export enum StrategyType {
    SpotBalanced = "SpotBalanced",
    Curve = "Curve",
    BidAsk = "BidAsk",
}

export interface DlmmStrategy {
    maxBinId: number;
    minBinId: number;
    strategyType: StrategyType;
}

export class MeteoraDlmmActions {
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    async createPosition(
        poolAddress: string,
        strategy: DlmmStrategy,
        amountX: number,
        amountY: number,
        state?: State
    ) {
        try {
            const dlmmPool = await DLMM.create(
                this.connection,
                new PublicKey(poolAddress)
            );
            const owner = state?.get("agentWallet");
            if (!owner) throw new Error("Agent wallet not found in state");

            // Create new position keypair
            const newPosition = new Keypair();

            const createPositionTx =
                await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                    positionPubKey: newPosition.publicKey,
                    user: owner.publicKey,
                    totalXAmount: new BN(amountX),
                    totalYAmount: new BN(amountY),
                    strategy: {
                        maxBinId: strategy.maxBinId,
                        minBinId: strategy.minBinId,
                        strategyType: strategy.strategyType,
                    },
                });

            const txHash = await sendAndConfirmTransaction(
                this.connection,
                Array.isArray(createPositionTx)
                    ? createPositionTx[0]
                    : createPositionTx,
                [owner, newPosition]
            );

            return {
                success: true,
                positionId: newPosition.publicKey.toBase58(),
                txHash,
            };
        } catch (error) {
            console.error("Error creating DLMM position:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async addLiquidity(
        poolAddress: string,
        positionAddress: string,
        strategy: DlmmStrategy,
        amountX: number,
        amountY: number,
        state?: State
    ) {
        try {
            const dlmmPool = await DLMM.create(
                this.connection,
                new PublicKey(poolAddress)
            );
            const owner = state?.get("agentWallet");
            if (!owner) throw new Error("Agent wallet not found in state");

            const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
                positionPubKey: new PublicKey(positionAddress),
                user: owner.publicKey,
                totalXAmount: new BN(amountX),
                totalYAmount: new BN(amountY),
                strategy: {
                    maxBinId: strategy.maxBinId,
                    minBinId: strategy.minBinId,
                    strategyType: strategy.strategyType,
                },
            });

            const txHash = await sendAndConfirmTransaction(
                this.connection,
                Array.isArray(addLiquidityTx)
                    ? addLiquidityTx[0]
                    : addLiquidityTx,
                [owner]
            );

            return {
                success: true,
                txHash,
            };
        } catch (error) {
            console.error("Error adding liquidity to DLMM position:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async removeLiquidity(
        poolAddress: string,
        positionAddress: string,
        percentageToRemove: number,
        shouldClaimAndClose: boolean = false,
        state?: State
    ) {
        try {
            const dlmmPool = await DLMM.create(
                this.connection,
                new PublicKey(poolAddress)
            );
            const owner = state?.get("agentWallet");
            if (!owner) throw new Error("Agent wallet not found in state");

            // Get position data
            const { userPositions } =
                await dlmmPool.getPositionsByUserAndLbPair(owner.publicKey);
            const position = userPositions.find(
                (p) => p.publicKey.toBase58() === positionAddress
            );
            if (!position) throw new Error("Position not found");

            const binIdsToRemove = position.positionData.positionBinData.map(
                (bin) => bin.binId
            );
            const liquiditiesBpsToRemove = new Array(
                binIdsToRemove.length
            ).fill(new BN(percentageToRemove * 100));

            const removeLiquidityTx = await dlmmPool.removeLiquidity({
                position: new PublicKey(positionAddress),
                user: owner.publicKey,
                binIds: binIdsToRemove,
                liquiditiesBpsToRemove,
                shouldClaimAndClose,
            });

            // Handle multiple transactions if needed
            for (let tx of Array.isArray(removeLiquidityTx)
                ? removeLiquidityTx
                : [removeLiquidityTx]) {
                await sendAndConfirmTransaction(this.connection, tx, [owner]);
            }

            return {
                success: true,
                message: `Liquidity removed successfully${shouldClaimAndClose ? " and position closed" : ""}`,
            };
        } catch (error) {
            console.error(
                "Error removing liquidity from DLMM position:",
                error
            );
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async claimRewards(
        poolAddress: string,
        positionAddress: string,
        state?: State
    ) {
        try {
            const dlmmPool = await DLMM.create(
                this.connection,
                new PublicKey(poolAddress)
            );
            const owner = state?.get("agentWallet");
            if (!owner) throw new Error("Agent wallet not found in state");

            // Claim both swap fees and LM rewards
            const claimTxs = await dlmmPool.claimAllRewards(owner.publicKey, [
                new PublicKey(positionAddress),
            ]);

            for (const tx of claimTxs) {
                await sendAndConfirmTransaction(this.connection, tx, [owner]);
            }

            return {
                success: true,
                message: "Rewards claimed successfully",
            };
        } catch (error) {
            console.error("Error claiming DLMM rewards:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

export const meteoraDlmmActions = {
    execute: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") ||
                    "https://api.mainnet-beta.solana.com"
            );
            const actions = new MeteoraDlmmActions(connection);
            const command = message.get("command");
            const poolAddress = message.get("poolAddress");

            if (!command || !poolAddress) {
                return "Missing required parameters";
            }

            switch (command) {
                case "createPosition": {
                    const strategy = message.get("strategy");
                    const amountX = message.get("amountX");
                    const amountY = message.get("amountY");

                    if (!strategy || !amountX || !amountY) {
                        return "Missing parameters for createPosition";
                    }

                    return JSON.stringify(
                        await actions.createPosition(
                            poolAddress,
                            strategy,
                            amountX,
                            amountY,
                            state
                        )
                    );
                }

                case "addLiquidity": {
                    const positionAddress = message.get("positionAddress");
                    const strategy = message.get("strategy");
                    const amountX = message.get("amountX");
                    const amountY = message.get("amountY");

                    if (!positionAddress || !strategy || !amountX || !amountY) {
                        return "Missing parameters for addLiquidity";
                    }

                    return JSON.stringify(
                        await actions.addLiquidity(
                            poolAddress,
                            positionAddress,
                            strategy,
                            amountX,
                            amountY,
                            state
                        )
                    );
                }

                case "removeLiquidity": {
                    const positionAddress = message.get("positionAddress");
                    const percentage = message.get("percentage") || 100;
                    const shouldClose = message.get("shouldClose") || false;

                    if (!positionAddress) {
                        return "Missing parameters for removeLiquidity";
                    }

                    return JSON.stringify(
                        await actions.removeLiquidity(
                            poolAddress,
                            positionAddress,
                            percentage,
                            shouldClose,
                            state
                        )
                    );
                }

                case "claimRewards": {
                    const positionAddress = message.get("positionAddress");

                    if (!positionAddress) {
                        return "Missing parameters for claimRewards";
                    }

                    return JSON.stringify(
                        await actions.claimRewards(
                            poolAddress,
                            positionAddress,
                            state
                        )
                    );
                }

                default:
                    return "Unknown command";
            }
        } catch (error) {
            console.error("Error executing Meteora DLMM action:", error);
            return JSON.stringify({
                success: false,
                error: error.message,
            });
        }
    },
};
