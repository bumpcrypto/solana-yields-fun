import { describe, expect, test, vi } from "vitest";
import { raydiumProvider } from "../providers/raydiumProvider";

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
});
