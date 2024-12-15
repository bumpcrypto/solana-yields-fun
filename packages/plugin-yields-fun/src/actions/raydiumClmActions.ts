import { IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
    AmmConfig,
    ApiClmmPoolInfo,
    ClmmPoolInfo,
    Clmm,
    ClmmPoolRewardInfo,
    ClmmPoolRewardLayoutInfo,
} from "@raydium-io/raydium-sdk";
import { initSdk } from "../config";

export class RaydiumClmActions {
    private clmm: Clmm;

    constructor() {
        const { sdk } = initSdk();
        this.clmm = sdk.clmm;
    }

    async addLiquidity(
        baseAddress: string,
        quoteAddress: string,
        lowerTick: number,
        upperTick: number,
        amountUsd: number,
        state?: State
    ) {
        try {
            const poolInfo = await this.getPoolInfo(baseAddress, quoteAddress);
            if (!poolInfo) throw new Error("Pool not found");

            // Convert USD amount to token amounts based on current price
            const { baseAmount, quoteAmount } = this.calculateTokenAmounts(
                poolInfo,
                amountUsd,
                lowerTick,
                upperTick
            );

            const owner = state?.get("agentWallet");
            if (!owner) throw new Error("Agent wallet not found in state");

            const transaction = await this.clmm.createOpenPositionTransaction({
                poolInfo,
                ownerInfo: {
                    feePayer: owner.publicKey,
                    wallet: owner.publicKey,
                    tokenAccounts: [], // Will be filled by SDK
                },
                tickLower: lowerTick,
                tickUpper: upperTick,
                baseAmount,
                quoteAmount,
                otherAmountThreshold: 0,
            });

            // Sign and send transaction
            await transaction.confirm();

            return {
                success: true,
                message: "Liquidity position opened successfully",
            };
        } catch (error) {
            console.error("Error adding liquidity:", error);
            return {
                success: false,
                message: error.message,
            };
        }
    }

    async removeLiquidity(
        baseAddress: string,
        quoteAddress: string,
        percentageToRemove: number,
        state?: State
    ) {
        try {
            const poolInfo = await this.getPoolInfo(baseAddress, quoteAddress);
            if (!poolInfo) throw new Error("Pool not found");

            const owner = state?.get("agentWallet");
            if (!owner) throw new Error("Agent wallet not found in state");

            // Get positions for this pool
            const positions = await this.clmm.getPositionsByOwner(
                owner.publicKey
            );
            const poolPositions = positions.filter((pos) =>
                pos.poolId.equals(poolInfo.id)
            );

            for (const position of poolPositions) {
                const transaction =
                    await this.clmm.createDecreaseLiquidityTransaction({
                        poolInfo,
                        ownerInfo: {
                            feePayer: owner.publicKey,
                            wallet: owner.publicKey,
                            tokenAccounts: [], // Will be filled by SDK
                        },
                        positionId: position.nftMint,
                        liquidity: position.liquidity
                            .mul(percentageToRemove)
                            .div(100),
                        amountMinA: 0,
                        amountMinB: 0,
                    });

                // Sign and send transaction
                await transaction.confirm();
            }

            return {
                success: true,
                message: "Liquidity removed successfully",
            };
        } catch (error) {
            console.error("Error removing liquidity:", error);
            return {
                success: false,
                message: error.message,
            };
        }
    }

    async adjustPosition(
        baseAddress: string,
        quoteAddress: string,
        newLowerTick: number,
        newUpperTick: number,
        targetAmountUsd: number,
        state?: State
    ) {
        try {
            // First remove existing liquidity
            await this.removeLiquidity(baseAddress, quoteAddress, 100, state);

            // Then add new position with updated parameters
            await this.addLiquidity(
                baseAddress,
                quoteAddress,
                newLowerTick,
                newUpperTick,
                targetAmountUsd,
                state
            );

            return {
                success: true,
                message: "Position adjusted successfully",
            };
        } catch (error) {
            console.error("Error adjusting position:", error);
            return {
                success: false,
                message: error.message,
            };
        }
    }

    private async getPoolInfo(
        baseAddress: string,
        quoteAddress: string
    ): Promise<ClmmPoolInfo | null> {
        const pools = await this.clmm.getPools();
        return (
            pools.find(
                (pool) =>
                    pool.mintA.toBase58() === baseAddress &&
                    pool.mintB.toBase58() === quoteAddress
            ) || null
        );
    }

    private calculateTokenAmounts(
        poolInfo: ClmmPoolInfo,
        amountUsd: number,
        lowerTick: number,
        upperTick: number
    ) {
        // Get current price from pool
        const currentPrice = poolInfo.currentPrice;

        // Calculate price range
        const lowerPrice = this.tickToPrice(lowerTick);
        const upperPrice = this.tickToPrice(upperTick);

        // Split USD amount between tokens based on price range
        const priceRatio = upperPrice.div(lowerPrice);
        const baseRatio = priceRatio.sqrt();

        const baseAmount = amountUsd / (2 * currentPrice.toNumber());
        const quoteAmount = amountUsd / 2;

        return {
            baseAmount,
            quoteAmount,
        };
    }

    private tickToPrice(tick: number): number {
        return Math.pow(1.0001, tick);
    }
}

export const raydiumClmActions = {
    execute: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const actions = new RaydiumClmActions();
            const command = message.get("command");
            const baseAddress = message.get("baseTokenAddress");
            const quoteAddress = message.get("quoteTokenAddress");

            if (!command || !baseAddress || !quoteAddress) {
                return "Missing required parameters";
            }

            switch (command) {
                case "addLiquidity": {
                    const lowerTick = message.get("lowerTick");
                    const upperTick = message.get("upperTick");
                    const amountUsd = message.get("amountUsd");

                    if (!lowerTick || !upperTick || !amountUsd) {
                        return "Missing parameters for addLiquidity";
                    }

                    return JSON.stringify(
                        await actions.addLiquidity(
                            baseAddress,
                            quoteAddress,
                            lowerTick,
                            upperTick,
                            amountUsd,
                            state
                        )
                    );
                }

                case "removeLiquidity": {
                    const percentage = message.get("percentage") || 100;
                    return JSON.stringify(
                        await actions.removeLiquidity(
                            baseAddress,
                            quoteAddress,
                            percentage,
                            state
                        )
                    );
                }

                case "adjustPosition": {
                    const lowerTick = message.get("lowerTick");
                    const upperTick = message.get("upperTick");
                    const amountUsd = message.get("amountUsd");

                    if (!lowerTick || !upperTick || !amountUsd) {
                        return "Missing parameters for adjustPosition";
                    }

                    return JSON.stringify(
                        await actions.adjustPosition(
                            baseAddress,
                            quoteAddress,
                            lowerTick,
                            upperTick,
                            amountUsd,
                            state
                        )
                    );
                }

                default:
                    return "Unknown command";
            }
        } catch (error) {
            console.error("Error in Raydium CLM actions:", error);
            return "Failed to execute CLM action";
        }
    },
};
