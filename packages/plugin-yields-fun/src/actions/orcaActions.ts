import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    openPositionInstructions,
    openFullRangePositionInstructions,
    increaseLiquidityInstructions,
    decreaseLiquidityInstructions,
    harvestPositionInstructions,
    closePositionInstructions,
    setWhirlpoolsConfig,
} from "@orca-so/whirlpools";
import { IAgentRuntime, Memory, State } from "@ai16z/eliza";

export interface OrcaLiquidityParam {
    tokenA?: bigint;
    tokenB?: bigint;
    liquidity?: bigint;
}

export interface PriceRange {
    lowerPrice: number;
    upperPrice: number;
}

export class OrcaActions {
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
        setWhirlpoolsConfig("mainnet");
    }

    async openPosition(
        whirlpoolAddress: PublicKey,
        liquidityParam: OrcaLiquidityParam,
        priceRange: PriceRange,
        slippageTolerance: number,
        wallet: Keypair
    ) {
        try {
            const { quote, instructions, initializationCost, positionMint } =
                await openPositionInstructions(
                    this.connection,
                    whirlpoolAddress,
                    liquidityParam,
                    priceRange.lowerPrice,
                    priceRange.upperPrice,
                    slippageTolerance,
                    wallet
                );

            return {
                quote,
                instructions,
                initializationCost,
                positionMint,
            };
        } catch (error) {
            console.error("Error opening position:", error);
            throw error;
        }
    }

    async openFullRangePosition(
        whirlpoolAddress: PublicKey,
        liquidityParam: OrcaLiquidityParam,
        slippageTolerance: number,
        wallet: Keypair
    ) {
        try {
            const { quote, instructions, initializationCost, positionMint } =
                await openFullRangePositionInstructions(
                    this.connection,
                    whirlpoolAddress,
                    liquidityParam,
                    slippageTolerance,
                    wallet
                );

            return {
                quote,
                instructions,
                initializationCost,
                positionMint,
            };
        } catch (error) {
            console.error("Error opening full range position:", error);
            throw error;
        }
    }

    async increaseLiquidity(
        positionMint: PublicKey,
        liquidityParam: OrcaLiquidityParam,
        slippageTolerance: number,
        wallet: Keypair
    ) {
        try {
            const { quote, instructions } = await increaseLiquidityInstructions(
                this.connection,
                positionMint,
                liquidityParam,
                slippageTolerance,
                wallet
            );

            return { quote, instructions };
        } catch (error) {
            console.error("Error increasing liquidity:", error);
            throw error;
        }
    }

    async decreaseLiquidity(
        positionMint: PublicKey,
        liquidityParam: OrcaLiquidityParam,
        slippageTolerance: number,
        wallet: Keypair
    ) {
        try {
            const { quote, instructions } = await decreaseLiquidityInstructions(
                this.connection,
                positionMint,
                liquidityParam,
                slippageTolerance,
                wallet
            );

            return { quote, instructions };
        } catch (error) {
            console.error("Error decreasing liquidity:", error);
            throw error;
        }
    }

    async harvestPosition(positionMint: PublicKey, wallet: Keypair) {
        try {
            const { feesQuote, rewardsQuote, instructions } =
                await harvestPositionInstructions(
                    this.connection,
                    positionMint,
                    wallet
                );

            return { feesQuote, rewardsQuote, instructions };
        } catch (error) {
            console.error("Error harvesting position:", error);
            throw error;
        }
    }

    async closePosition(
        positionMint: PublicKey,
        slippageTolerance: number,
        wallet: Keypair
    ) {
        try {
            const { instructions, quote, feesQuote, rewardsQuote } =
                await closePositionInstructions(
                    this.connection,
                    positionMint,
                    slippageTolerance,
                    wallet
                );

            return { instructions, quote, feesQuote, rewardsQuote };
        } catch (error) {
            console.error("Error closing position:", error);
            throw error;
        }
    }
}

export const orcaActions = {
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
            const actions = new OrcaActions(connection);
            const command = message.get("command");
            const wallet = state?.get("agentWallet");

            if (!command || !wallet) {
                return "Missing required parameters";
            }

            switch (command) {
                case "openPosition": {
                    const whirlpoolAddress = message.get("whirlpoolAddress");
                    const liquidityParam = message.get("liquidityParam");
                    const priceRange = message.get("priceRange");
                    const slippageTolerance =
                        message.get("slippageTolerance") || 100;

                    if (!whirlpoolAddress || !liquidityParam || !priceRange) {
                        return "Missing parameters for openPosition";
                    }

                    return JSON.stringify(
                        await actions.openPosition(
                            new PublicKey(whirlpoolAddress),
                            liquidityParam,
                            priceRange,
                            slippageTolerance,
                            wallet
                        )
                    );
                }

                case "openFullRangePosition": {
                    const whirlpoolAddress = message.get("whirlpoolAddress");
                    const liquidityParam = message.get("liquidityParam");
                    const slippageTolerance =
                        message.get("slippageTolerance") || 100;

                    if (!whirlpoolAddress || !liquidityParam) {
                        return "Missing parameters for openFullRangePosition";
                    }

                    return JSON.stringify(
                        await actions.openFullRangePosition(
                            new PublicKey(whirlpoolAddress),
                            liquidityParam,
                            slippageTolerance,
                            wallet
                        )
                    );
                }

                case "increaseLiquidity": {
                    const positionMint = message.get("positionMint");
                    const liquidityParam = message.get("liquidityParam");
                    const slippageTolerance =
                        message.get("slippageTolerance") || 100;

                    if (!positionMint || !liquidityParam) {
                        return "Missing parameters for increaseLiquidity";
                    }

                    return JSON.stringify(
                        await actions.increaseLiquidity(
                            new PublicKey(positionMint),
                            liquidityParam,
                            slippageTolerance,
                            wallet
                        )
                    );
                }

                case "decreaseLiquidity": {
                    const positionMint = message.get("positionMint");
                    const liquidityParam = message.get("liquidityParam");
                    const slippageTolerance =
                        message.get("slippageTolerance") || 100;

                    if (!positionMint || !liquidityParam) {
                        return "Missing parameters for decreaseLiquidity";
                    }

                    return JSON.stringify(
                        await actions.decreaseLiquidity(
                            new PublicKey(positionMint),
                            liquidityParam,
                            slippageTolerance,
                            wallet
                        )
                    );
                }

                case "harvestPosition": {
                    const positionMint = message.get("positionMint");

                    if (!positionMint) {
                        return "Missing parameters for harvestPosition";
                    }

                    return JSON.stringify(
                        await actions.harvestPosition(
                            new PublicKey(positionMint),
                            wallet
                        )
                    );
                }

                case "closePosition": {
                    const positionMint = message.get("positionMint");
                    const slippageTolerance =
                        message.get("slippageTolerance") || 100;

                    if (!positionMint) {
                        return "Missing parameters for closePosition";
                    }

                    return JSON.stringify(
                        await actions.closePosition(
                            new PublicKey(positionMint),
                            slippageTolerance,
                            wallet
                        )
                    );
                }

                default:
                    return "Unknown command";
            }
        } catch (error) {
            console.error("Error executing Orca action:", error);
            return JSON.stringify({
                success: false,
                error: error.message,
            });
        }
    },
};
