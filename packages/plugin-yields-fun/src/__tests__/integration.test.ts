import { Connection, PublicKey } from "@solana/web3.js";
import { describe, it, expect, beforeEach } from "vitest";
import { raydiumProvider } from "../providers/raydiumProvider";
import { marinadeProvider } from "../providers/marinadeProvider";
import { lidoProvider } from "../providers/lidoProvider";
import { jpoolProvider } from "../providers/jpoolProvider";
import { meteoraProvider } from "../providers/meteoraProvider";

// Real runtime with actual RPC
const runtime = {
    getSetting: (key: string) => {
        switch (key) {
            case "RPC_URL":
                return (
                    process.env.RPC_URL || "https://api.mainnet-beta.solana.com"
                );
            case "WALLET_PUBLIC_KEY":
                return process.env.WALLET_PUBLIC_KEY;
            default:
                return undefined;
        }
    },
    cacheManager: {
        get: async () => null,
        set: async () => {},
    },
};

describe("Protocol Integration", () => {
    describe("Meteora Integration", () => {
        it("should fetch real Meteora pools", async () => {
            const result = await meteoraProvider.get(runtime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Meteora LP Opportunities");
            // Verify actual data structure
            expect(result).toMatch(/APY: \d+\.\d+%/);
            expect(result).toMatch(/TVL: \$[\d,]+/);
        });
    });

    describe("Raydium Integration", () => {
        it("should fetch real Raydium pools", async () => {
            const result = await raydiumProvider.get(runtime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Raydium LP Opportunities");
            expect(result).toMatch(/APY: \d+\.\d+%/);
            expect(result).toMatch(/TVL: \$[\d,]+/);
        });
    });

    describe("Liquid Staking Integration", () => {
        it("should fetch real Marinade staking data", async () => {
            const result = await marinadeProvider.get(runtime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Marinade Staking Opportunities");
            expect(result).toMatch(/APY: \d+\.\d+%/);
        });

        it("should fetch real Lido staking data", async () => {
            const result = await lidoProvider.get(runtime, {});
            expect(result).toBeDefined();
            expect(result).toContain("Lido Staking Opportunities");
            expect(result).toMatch(/APY: \d+\.\d+%/);
        });

        it("should fetch real JPool staking data", async () => {
            const result = await jpoolProvider.get(runtime, {});
            expect(result).toBeDefined();
            expect(result).toContain("JPool Staking Opportunities");
            expect(result).toMatch(/APY: \d+\.\d+%/);
        });
    });
});
