import { IAgentRuntime } from "@ai16z/eliza";
import { z } from "zod";

export const yieldsFunEnvSchema = z
    .object({
        WALLET_SECRET_SALT: z.string().optional(),
    })
    .and(
        z.union([
            z.object({
                WALLET_SECRET_KEY: z
                    .string()
                    .min(1, "Wallet secret key is required"),
                WALLET_PUBLIC_KEY: z
                    .string()
                    .min(1, "Wallet public key is required"),
            }),
            z.object({
                WALLET_SECRET_SALT: z
                    .string()
                    .min(1, "Wallet secret salt is required"),
            }),
        ])
    )
    .and(
        z.object({
            RPC_URL: z.string().min(1, "RPC URL is required"),
            // Add other required environment variables here
        })
    );

export type YieldsFunConfig = z.infer<typeof yieldsFunEnvSchema>;

export async function validateYieldsFunConfig(
    runtime: IAgentRuntime
): Promise<YieldsFunConfig> {
    try {
        const config = {
            WALLET_SECRET_SALT:
                runtime.getSetting("WALLET_SECRET_SALT") ||
                process.env.WALLET_SECRET_SALT,
            WALLET_SECRET_KEY:
                runtime.getSetting("WALLET_SECRET_KEY") ||
                process.env.WALLET_SECRET_KEY,
            WALLET_PUBLIC_KEY:
                runtime.getSetting("WALLET_PUBLIC_KEY") ||
                process.env.WALLET_PUBLIC_KEY,
            RPC_URL: runtime.getSetting("RPC_URL") || process.env.RPC_URL,
            // Add other environment variables here
        };

        return yieldsFunEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Yields Fun configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
