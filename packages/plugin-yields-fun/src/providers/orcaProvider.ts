import { Connection, PublicKey } from "@solana/web3.js";
import {
    fetchConcentratedLiquidityPool,
    fetchPositionsForOwner,
    fetchPositionsInWhirlpool,
    fetchSplashPool,
    fetchWhirlpoolsByTokenPair,
    setWhirlpoolsConfig,
} from "@orca-so/whirlpools";

export class OrcaProvider {
    private connection: Connection;

    constructor(connection: Connection) {
        this.connection = connection;
        setWhirlpoolsConfig("mainnet");
    }

    async fetchSplashPool(tokenMintA: PublicKey, tokenMintB: PublicKey) {
        try {
            const poolInfo = await fetchSplashPool(
                this.connection,
                tokenMintA,
                tokenMintB
            );
            return poolInfo;
        } catch (error) {
            console.error("Error fetching splash pool:", error);
            throw error;
        }
    }

    async fetchConcentratedPool(
        tokenMintA: PublicKey,
        tokenMintB: PublicKey,
        tickSpacing: number
    ) {
        try {
            const poolInfo = await fetchConcentratedLiquidityPool(
                this.connection,
                tokenMintA,
                tokenMintB,
                tickSpacing
            );
            return poolInfo;
        } catch (error) {
            console.error("Error fetching concentrated pool:", error);
            throw error;
        }
    }

    async fetchAllPoolsByTokenPair(
        tokenMintA: PublicKey,
        tokenMintB: PublicKey
    ) {
        try {
            const pools = await fetchWhirlpoolsByTokenPair(
                this.connection,
                tokenMintA,
                tokenMintB
            );
            return pools;
        } catch (error) {
            console.error("Error fetching pools by token pair:", error);
            throw error;
        }
    }

    async fetchPositionsForOwner(owner: PublicKey) {
        try {
            const positions = await fetchPositionsForOwner(
                this.connection,
                owner
            );
            return positions;
        } catch (error) {
            console.error("Error fetching positions for owner:", error);
            throw error;
        }
    }

    async fetchPositionsInWhirlpool(whirlpoolAddress: PublicKey) {
        try {
            const positions = await fetchPositionsInWhirlpool(
                this.connection,
                whirlpoolAddress
            );
            return positions;
        } catch (error) {
            console.error("Error fetching positions in whirlpool:", error);
            throw error;
        }
    }
}
