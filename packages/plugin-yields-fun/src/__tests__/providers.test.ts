import { describe, expect, test, vi, beforeEach } from "vitest";
import { raydiumProvider } from "../providers/raydiumProvider";
import { meteoraProvider } from "../providers/meteoraProvider";

// Mock Raydium SDK
vi.mock("@raydium-io/raydium-sdk-v2", () => ({
    initSdk: () => ({
        api: {
            fetchAllPools: () => [
                {
                    id: "pool123",
                    mintA: { symbol: "SOL" },
                    mintB: { symbol: "USDC" },
                    tvl: 1000000,
                    volume24h: 100000,
                    fee: 0.003,
                },
            ],
        },
    }),
}));

// Mock Meteora API responses
vi.mock("axios", () => ({
    default: {
        get: vi.fn().mockImplementation((url) => {
            if (url.includes("/pools")) {
                return Promise.resolve({
                    data: {
                        pools: [
                            {
                                address: "pool1",
                                tokenA: { symbol: "SOL", decimals: 9 },
                                tokenB: { symbol: "USDC", decimals: 6 },
                                tvl: 2000000,
                                apr: 25.5,
                                volume24h: 150000,
                                fee: 0.25,
                            },
                            {
                                address: "pool2",
                                tokenA: { symbol: "RAY", decimals: 6 },
                                tokenB: { symbol: "USDC", decimals: 6 },
                                tvl: 1500000,
                                apr: 32.1,
                                volume24h: 120000,
                                fee: 0.25,
                            },
                        ],
                    },
                });
            }
            if (url.includes("/positions")) {
                return Promise.resolve({
                    data: {
                        positions: [
                            {
                                poolAddress: "pool1",
                                tokenAAmount: "1000000000",
                                tokenBAmount: "1000000",
                                share: 0.05,
                            },
                        ],
                    },
                });
            }
            return Promise.reject(new Error("Not found"));
        }),
    },
}));

// Mock path module
vi.mock("path", () => {
    return {
        join: (...args: string[]) => args.join("/"),
    };
});

// Mock runtime
const mockRuntime = {
    getSetting: (key: string) => {
        switch (key) {
            case "RPC_URL":
                return "https://api.mainnet-beta.solana.com";
            case "METEORA_API_KEY":
                return "test-api-key";
            default:
                return null;
        }
    },
    cacheManager: {
        get: vi.fn(),
        set: vi.fn(),
    },
};

describe("Yield Providers", () => {
    describe("Raydium Provider", () => {
        test("should fetch yield opportunities", async () => {
            const result = await raydiumProvider.get(mockRuntime, {}, {});
            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result).toContain("Raydium LP Opportunities");
            expect(result).toContain("SOL/USDC");
        });
    });

    describe("Meteora Provider", () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockRuntime.cacheManager.get.mockReset();
            mockRuntime.cacheManager.set.mockReset();
        });

        test("should fetch all pools successfully", async () => {
            const result = await meteoraProvider.get(mockRuntime, {}, {});
            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result).toContain("Meteora LP Opportunities");
            expect(result).toContain("SOL/USDC");
            expect(result).toContain("RAY/USDC");
            expect(result).toContain("25.5%"); // APR
            expect(result).toContain("$2,000,000"); // TVL
        });

        test("should handle pool discovery with caching", async () => {
            // First call - no cache
            mockRuntime.cacheManager.get.mockResolvedValueOnce(null);
            await meteoraProvider.get(mockRuntime, {}, {});

            // Verify cache was set
            expect(mockRuntime.cacheManager.set).toHaveBeenCalled();

            // Second call - with cache
            mockRuntime.cacheManager.get.mockResolvedValueOnce({
                pools: [
                    {
                        address: "pool1",
                        tokenA: { symbol: "SOL", decimals: 9 },
                        tokenB: { symbol: "USDC", decimals: 6 },
                        tvl: 2000000,
                        apr: 25.5,
                    },
                ],
            });

            const cachedResult = await meteoraProvider.get(mockRuntime, {}, {});
            expect(cachedResult).toContain("SOL/USDC");
        });

        test("should calculate yields correctly", async () => {
            const result = await meteoraProvider.get(mockRuntime, {}, {});

            // Check APR formatting
            expect(result).toContain("25.5%"); // SOL/USDC pool APR
            expect(result).toContain("32.1%"); // RAY/USDC pool APR

            // Check TVL formatting
            expect(result).toContain("$2,000,000"); // SOL/USDC pool TVL
            expect(result).toContain("$1,500,000"); // RAY/USDC pool TVL
        });

        test("should track user positions", async () => {
            const result = await meteoraProvider.get(
                mockRuntime,
                {
                    walletAddress: "test-wallet",
                },
                {}
            );

            expect(result).toContain("Your Positions");
            expect(result).toContain("pool1"); // Position pool address
            expect(result).toContain("5%"); // Position share
        });

        test("should handle API errors gracefully", async () => {
            // Mock API error
            vi.mocked(axios.get).mockRejectedValueOnce(new Error("API Error"));

            const result = await meteoraProvider.get(mockRuntime, {}, {});
            expect(result).toContain("Error fetching Meteora opportunities");
        });
    });
});
