import { Connection, PublicKey } from "@solana/web3.js";
import { describe, it, expect, beforeEach } from "vitest";
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
            case "METEORA_API_KEY":
                return process.env.METEORA_API_KEY;
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
        let connection: Connection;

        beforeEach(() => {
            connection = new Connection(
                runtime.getSetting("RPC_URL") ||
                    "https://api.mainnet-beta.solana.com"
            );
        });

        it("should fetch real Meteora pools with valid data", async () => {
            const result = await meteoraProvider.get(runtime, {});

            // Basic response structure
            expect(result).toBeDefined();
            expect(result).toContain("Meteora LP Opportunities");

            // Data validation
            expect(result).toMatch(/TVL: \$[\d,]+/);
            expect(result).toMatch(/APR: \d+\.\d+%/);

            // Pool information
            expect(result).toMatch(/[A-Z]+\/[A-Z]+/); // Token pair format
        });

        it("should validate pool TVL and volume data", async () => {
            const result = await meteoraProvider.get(runtime, {});

            // TVL validation
            const tvlMatch = result.match(/TVL: \$([\d,]+)/);
            expect(tvlMatch).toBeTruthy();
            if (tvlMatch) {
                const tvl = parseFloat(tvlMatch[1].replace(/,/g, ""));
                expect(tvl).toBeGreaterThan(0);
            }

            // Volume validation
            expect(result).toMatch(/24h Volume: \$[\d,]+/);
        });

        it("should track yield rates accurately", async () => {
            const result = await meteoraProvider.get(runtime, {});

            // APR validation
            const aprMatches = result.match(/APR: (\d+\.\d+)%/g);
            expect(aprMatches).toBeTruthy();
            if (aprMatches) {
                aprMatches.forEach((match) => {
                    const apr = parseFloat(
                        match.replace("APR: ", "").replace("%", "")
                    );
                    expect(apr).toBeGreaterThanOrEqual(0);
                    expect(apr).toBeLessThan(1000); // Sanity check for unrealistic APRs
                });
            }
        });

        it("should handle user positions when wallet is provided", async () => {
            const walletPublicKey = runtime.getSetting("WALLET_PUBLIC_KEY");
            if (!walletPublicKey) {
                console.log(
                    "Skipping wallet position test - no wallet provided"
                );
                return;
            }

            const result = await meteoraProvider.get(runtime, {
                walletAddress: walletPublicKey,
            });

            if (result.includes("Your Positions")) {
                // If positions exist, validate their data
                expect(result).toMatch(/Position Value: \$[\d,]+/);
                expect(result).toMatch(/Share: \d+\.\d+%/);
            } else {
                // If no positions, should indicate that
                expect(result).toContain("No active positions found");
            }
        });

        it("should handle API errors gracefully", async () => {
            // Test with invalid API key
            const badRuntime = {
                ...runtime,
                getSetting: (key: string) => {
                    if (key === "METEORA_API_KEY") return "invalid-key";
                    return runtime.getSetting(key);
                },
            };

            const result = await meteoraProvider.get(badRuntime, {});
            expect(result).toContain("Error fetching Meteora opportunities");
        });

        it("should validate pool addresses", async () => {
            const result = await meteoraProvider.get(runtime, {});

            // Extract pool addresses from the result
            const addressMatches = result.match(/Pool: ([A-Za-z0-9]{32,})/g);
            if (addressMatches) {
                for (const match of addressMatches) {
                    const address = match.replace("Pool: ", "");
                    expect(() => new PublicKey(address)).not.toThrow();
                }
            }
        });
    });
});
