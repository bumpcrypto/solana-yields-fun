import { TokenPerformance } from "@ai16z/plugin-trustdb";

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

export interface WatchlistAlert {
    tokenAddress: string;
    timestamp: Date;
    alertType: "PRICE" | "VOLUME" | "LIQUIDITY" | "SECURITY";
    message: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    metrics: Partial<TokenPerformance>;
}

export interface WatchlistStats {
    totalTokens: number;
    activeAlerts: number;
    lastUpdateTime: Date;
    topPerformers: Array<{
        tokenAddress: string;
        performance: number;
    }>;
    riskFlags: Array<{
        tokenAddress: string;
        flags: string[];
    }>;
}
