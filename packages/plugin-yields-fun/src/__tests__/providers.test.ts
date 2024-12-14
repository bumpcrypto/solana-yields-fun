import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Connection } from "@solana/web3.js";
import { raydiumProvider } from "../providers/raydiumProvider";
import { marinadeProvider } from "../providers/marinadeProvider";
import { lidoProvider } from "../providers/lidoProvider";
import { jpoolProvider } from "../providers/jpoolProvider";
import { yieldProvider } from "../providers/yieldProvider";
import { agentWalletProvider } from "../providers/agentWalletProvider";
import { meteoraProvider } from "../providers/meteoraProvider";

// Mock NodeCache
vi.mock("node-cache", () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            set: vi.fn(),
            get: vi.fn().mockReturnValue(null),
        })),
    };
});

// Mock path module
vi.mock("path", async () => {
    const actual = await vi.importActual("path");
    return {
        ...(actual as any),
        join: vi.fn().mockImplementation((...args) => args.join("/")),
    };
});

// Mock the ICacheManager
const mockCacheManager = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
};

// Mock runtime
const mockRuntime = {
    getSetting: vi.fn((key: string) => {
        switch (key) {
            case "RPC_URL":
                return "https://api.mainnet-beta.solana.com";
            case "WALLET_PUBLIC_KEY":
                return "test-wallet-address";
            default:
                return undefined;
        }
    }),
    cacheManager: mockCacheManager,
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Yield Providers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCacheManager.get.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe("Base Yield Provider", () => {
        it("should fetch yield opportunities", async () => {
            const result = await yieldProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
        });
    });

    describe("Agent Wallet Provider", () => {
        it("should fetch wallet information", async () => {
            const result = await agentWalletProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
        });
    });

    describe("Raydium Provider", () => {
        it("should fetch Raydium opportunities", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: {
                            pools: [],
                        },
                    }),
            });

            const result = await raydiumProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Raydium LP Opportunities");
        });

        it("should handle API errors gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API Error"));
            const result = await raydiumProvider.get(mockRuntime, {});
            expect(result).toContain("Unable to fetch Raydium opportunities");
        });
    });

    describe("Marinade Provider", () => {
        it("should fetch Marinade opportunities", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: {
                            totalStaked: 1000000,
                            apy: 6.5,
                        },
                    }),
            });

            const result = await marinadeProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Marinade Staking Opportunities");
        });

        it("should handle API errors gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API Error"));
            const result = await marinadeProvider.get(mockRuntime, {});
            expect(result).toContain("Unable to fetch Marinade opportunities");
        });
    });

    describe("Lido Provider", () => {
        it("should fetch Lido opportunities", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: {
                            totalStaked: 1000000,
                            apy: 7.2,
                        },
                    }),
            });

            const result = await lidoProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Lido Staking Opportunities");
        });

        it("should handle API errors gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API Error"));
            const result = await lidoProvider.get(mockRuntime, {});
            expect(result).toContain("Unable to fetch Lido opportunities");
        });
    });

    describe("JPool Provider", () => {
        it("should fetch JPool opportunities", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: {
                            totalStaked: 800000,
                            apy: 7.8,
                        },
                    }),
            });

            const result = await jpoolProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
            expect(result).toContain("JPool Staking Opportunities");
        });

        it("should handle API errors gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API Error"));
            const result = await jpoolProvider.get(mockRuntime, {});
            expect(result).toContain("Unable to fetch JPool opportunities");
        });
    });

    describe("Meteora Provider", () => {
        it("should fetch Meteora opportunities", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: [
                            {
                                address: "pool1",
                                token0Address: "token0",
                                token0Symbol: "SOL",
                                token0Decimals: 9,
                                token1Address: "token1",
                                token1Symbol: "USDC",
                                token1Decimals: 6,
                                fee: 0.3,
                                tvlUSD: 1000000,
                                volumeUSD24h: 500000,
                                feesUSD24h: 1500,
                            },
                        ],
                    }),
            });

            const result = await meteoraProvider.get(mockRuntime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Meteora LP Opportunities");
        });

        it("should handle API errors gracefully", async () => {
            mockFetch.mockRejectedValueOnce(new Error("API Error"));
            const result = await meteoraProvider.get(mockRuntime, {});
            expect(result).toContain("Unable to fetch Meteora opportunities");
        });
    });
});
