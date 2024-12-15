import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { ICacheManager } from "@ai16z/eliza";
import { ApiV3PoolInfoStandardItem } from "@raydium-io/raydium-sdk-v2";
import NodeCache from "node-cache";
import { YieldOpportunity } from "../types/yield";
import axios from "axios";
import { initSdk } from "../config";

const PROVIDER_CONFIG = {
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    CACHE_TTL: 300, // 5 minutes
};

export class RaydiumProvider {
    private cache: NodeCache;
    private connection: Connection;
    private raydiumSDK: any;

    constructor(
        connection: Connection,
        private cacheManager: ICacheManager
    ) {
        this.cache = new NodeCache({ stdTTL: PROVIDER_CONFIG.CACHE_TTL });
        this.connection = connection;
    }

    private async ensureSDKInitialized() {
        if (!this.raydiumSDK) {
            const dummyKeypair = Keypair.generate();
            this.raydiumSDK = await initSdk({
                owner: dummyKeypair,
                connection: this.connection,
                cluster: "mainnet",
                loadToken: false,
            });
        }
        return this.raydiumSDK;
    }

    async getPoolState(poolId: string) {
        const cacheKey = `pool_state_${poolId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const sdk = await this.ensureSDKInitialized();
            const poolState = await sdk.api.getPoolState(poolId);
            this.cache.set(cacheKey, poolState);
            return poolState;
        } catch (error) {
            console.error("Error fetching pool state:", error);
            throw error;
        }
    }

    async getPoolPositions(poolId: string) {
        const cacheKey = `pool_positions_${poolId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const sdk = await this.ensureSDKInitialized();
            const positions = await sdk.api.getPositions(poolId);
            this.cache.set(cacheKey, positions);
            return positions;
        } catch (error) {
            console.error("Error fetching pool positions:", error);
            throw error;
        }
    }

    async getTickArrays(poolId: string) {
        try {
            const sdk = await this.ensureSDKInitialized();
            return await sdk.api.getTickArrays(poolId);
        } catch (error) {
            console.error("Error fetching tick arrays:", error);
            throw error;
        }
    }

    async getCurrentTick(poolId: string) {
        try {
            const poolState = await this.getPoolState(poolId);
            return poolState.currentTick;
        } catch (error) {
            console.error("Error getting current tick:", error);
            throw error;
        }
    }

    async getTickSpacing(poolId: string) {
        try {
            const poolState = await this.getPoolState(poolId);
            return poolState.tickSpacing;
        } catch (error) {
            console.error("Error getting tick spacing:", error);
            throw error;
        }
    }

    async calculateOptimalRange(poolId: string, rangeWidth: number = 10) {
        try {
            const currentTick = await this.getCurrentTick(poolId);
            const tickSpacing = await this.getTickSpacing(poolId);

            const lowerTick = currentTick - rangeWidth * tickSpacing;
            const upperTick = currentTick + rangeWidth * tickSpacing;

            return {
                lowerTick,
                upperTick,
                currentTick,
                tickSpacing,
            };
        } catch (error) {
            console.error("Error calculating optimal range:", error);
            throw error;
        }
    }

    async getPoolLiquidity(poolId: string) {
        try {
            const poolState = await this.getPoolState(poolId);
            return poolState.liquidity;
        } catch (error) {
            console.error("Error getting pool liquidity:", error);
            throw error;
        }
    }
}

// Create the provider instance for the Eliza framework
export const raydiumProvider = {
    get: async (runtime: any, _message: any, _state?: any): Promise<string> => {
        try {
            const connection = new Connection(
                runtime.getSetting("RPC_URL") || PROVIDER_CONFIG.DEFAULT_RPC
            );

            const provider = new RaydiumProvider(
                connection,
                runtime.cacheManager
            );

            return "Raydium CLM provider initialized successfully.";
        } catch (error) {
            console.error("Error in Raydium provider:", error);
            return "Unable to initialize Raydium provider. Please try again later.";
        }
    },
};
