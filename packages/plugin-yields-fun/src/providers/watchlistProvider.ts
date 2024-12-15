import { IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { TrustScoreManager } from "./trustScoreProvider";
import { TokenProvider } from "./tokenProvider";
import { ProcessedTokenData } from "../types/trustDB";

export interface WatchlistEntry {
    tokenAddress: string;
    addedAt: Date;
    lastChecked: Date;
    alertThresholds: {
        priceChangePercent: number;
        volumeChangePercent: number;
        liquidityChangePercent: number;
    };
    isActive: boolean;
}

export class WatchlistProvider implements Provider {
    private runtime: IAgentRuntime;
    private trustScoreManager: TrustScoreManager;
    private tokenProvider: TokenProvider;
    private tableName = "watchlist_memories";

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.trustScoreManager = new TrustScoreManager(runtime);
        this.tokenProvider = new TokenProvider(runtime);
    }

    async initialize(): Promise<void> {
        // Register memory manager for watchlist
        const memoryManager = this.runtime.getMemoryManager(this.tableName);
        if (!memoryManager) {
            await this.runtime.registerMemoryManager({
                runtime: this.runtime,
                tableName: this.tableName,
            });
        }
    }

    async addToWatchlist(
        tokenAddress: string,
        alertThresholds?: Partial<WatchlistEntry["alertThresholds"]>
    ): Promise<void> {
        const entry: WatchlistEntry = {
            tokenAddress,
            addedAt: new Date(),
            lastChecked: new Date(),
            alertThresholds: {
                priceChangePercent: alertThresholds?.priceChangePercent || 5,
                volumeChangePercent: alertThresholds?.volumeChangePercent || 20,
                liquidityChangePercent:
                    alertThresholds?.liquidityChangePercent || 10,
            },
            isActive: true,
        };

        const memory: Memory = {
            id: `${tokenAddress}-${Date.now()}`,
            content: { text: JSON.stringify(entry) },
            roomId: this.runtime.roomId,
            userId: this.runtime.userId,
            agentId: this.runtime.agentId,
            createdAt: Date.now(),
        };

        const memoryManager = this.runtime.getMemoryManager(this.tableName);
        await memoryManager.createMemory(memory, true);
    }

    async removeFromWatchlist(tokenAddress: string): Promise<void> {
        const memoryManager = this.runtime.getMemoryManager(this.tableName);
        const memories = await memoryManager.getMemories({
            roomId: this.runtime.roomId,
        });

        for (const memory of memories) {
            const entry: WatchlistEntry = JSON.parse(memory.content.text);
            if (entry.tokenAddress === tokenAddress) {
                await memoryManager.removeMemory(memory.id);
            }
        }
    }

    async getWatchlist(): Promise<WatchlistEntry[]> {
        const memoryManager = this.runtime.getMemoryManager(this.tableName);
        const memories = await memoryManager.getMemories({
            roomId: this.runtime.roomId,
        });

        return memories.map((memory) => JSON.parse(memory.content.text));
    }

    async checkWatchlistAlerts(): Promise<
        {
            tokenAddress: string;
            alerts: string[];
        }[]
    > {
        const watchlist = await this.getWatchlist();
        const alerts: { tokenAddress: string; alerts: string[] }[] = [];

        for (const entry of watchlist) {
            if (!entry.isActive) continue;

            const tokenData = await this.tokenProvider.getProcessedTokenData();
            const alerts: string[] = [];

            // Check price changes
            if (
                Math.abs(tokenData.tradeData.price_change_24h_percent) >
                entry.alertThresholds.priceChangePercent
            ) {
                alerts.push(
                    `Price change of ${tokenData.tradeData.price_change_24h_percent}% exceeded threshold`
                );
            }

            // Check volume changes
            if (
                Math.abs(tokenData.tradeData.volume_24h_change_percent) >
                entry.alertThresholds.volumeChangePercent
            ) {
                alerts.push(
                    `Volume change of ${tokenData.tradeData.volume_24h_change_percent}% exceeded threshold`
                );
            }

            // Check liquidity changes
            const liquidityChange =
                tokenData.dexScreenerData.pairs[0]?.liquidity.usd || 0;
            if (
                Math.abs(liquidityChange) >
                entry.alertThresholds.liquidityChangePercent
            ) {
                alerts.push(
                    `Liquidity change of ${liquidityChange}% exceeded threshold`
                );
            }

            if (alerts.length > 0) {
                alerts.push({
                    tokenAddress: entry.tokenAddress,
                    alerts,
                });
            }

            // Update last checked timestamp
            await this.updateLastChecked(entry.tokenAddress);
        }

        return alerts;
    }

    private async updateLastChecked(tokenAddress: string): Promise<void> {
        const memoryManager = this.runtime.getMemoryManager(this.tableName);
        const memories = await memoryManager.getMemories({
            roomId: this.runtime.roomId,
        });

        for (const memory of memories) {
            const entry: WatchlistEntry = JSON.parse(memory.content.text);
            if (entry.tokenAddress === tokenAddress) {
                entry.lastChecked = new Date();
                const updatedMemory: Memory = {
                    ...memory,
                    content: { text: JSON.stringify(entry) },
                };
                await memoryManager.createMemory(updatedMemory, true);
            }
        }
    }
}
