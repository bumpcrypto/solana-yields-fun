import { Action, IAgentRuntime, Memory } from "@ai16z/eliza";
import {
    Connection,
    PublicKey,
    Transaction,
    VersionedTransaction,
    TransactionMessage,
} from "@solana/web3.js";

interface LuloDepositParams {
    owner: string;
    mintAddress: string;
    depositAmount: string;
    allowedProtocols?: string;
}

interface LuloWithdrawParams {
    owner: string;
    mintAddress: string;
    withdrawAmount: string;
    withdrawAll?: boolean;
}

interface LuloTransactionMeta {
    transaction: string; // base64 serialized transaction
    protocol: string;
    totalDeposit: number;
}

const LULO_CONFIG = {
    API_URL: "https://api.flexlend.fi",
    DEFAULT_PRIORITY_FEE: 50000,
};

export class LuloActions {
    private connection: Connection;
    private apiKey: string;

    constructor(connection: Connection, apiKey: string) {
        this.connection = connection;
        this.apiKey = apiKey;
    }

    async generateDepositTransaction(
        params: LuloDepositParams
    ): Promise<LuloTransactionMeta[]> {
        try {
            const response = await fetch(
                `${LULO_CONFIG.API_URL}/generate/account/deposit?priorityFee=${LULO_CONFIG.DEFAULT_PRIORITY_FEE}`,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-wallet-pubkey": params.owner,
                        "x-api-key": this.apiKey,
                    },
                    body: JSON.stringify({
                        owner: params.owner,
                        mintAddress: params.mintAddress,
                        depositAmount: params.depositAmount,
                        allowedProtocols: params.allowedProtocols,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const {
                data: { transactionMeta },
            } = await response.json();
            return transactionMeta;
        } catch (error) {
            console.error("Error generating deposit transaction:", error);
            throw error;
        }
    }

    async generateWithdrawTransaction(
        params: LuloWithdrawParams
    ): Promise<LuloTransactionMeta[]> {
        try {
            const response = await fetch(
                `${LULO_CONFIG.API_URL}/generate/account/withdraw?priorityFee=${LULO_CONFIG.DEFAULT_PRIORITY_FEE}`,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-wallet-pubkey": params.owner,
                        "x-api-key": this.apiKey,
                    },
                    body: JSON.stringify({
                        owner: params.owner,
                        mintAddress: params.mintAddress,
                        withdrawAmount: params.withdrawAmount,
                        withdrawAll: params.withdrawAll,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const {
                data: { transactionMeta },
            } = await response.json();
            return transactionMeta;
        } catch (error) {
            console.error("Error generating withdraw transaction:", error);
            throw error;
        }
    }

    private async deserializeAndSignTransaction(
        base64Transaction: string
    ): Promise<Transaction> {
        const buffer = Buffer.from(base64Transaction, "base64");
        const transaction = Transaction.from(buffer);
        return transaction;
    }
}

// Create deposit action for the Eliza framework
export const depositAction: Action = {
    name: "lulo-deposit",
    description: "Deposit funds into LuLo for yield farming",
    parameters: {
        type: "object",
        properties: {
            amount: { type: "string", description: "Amount to deposit" },
            token: {
                type: "string",
                description: "Token mint address to deposit",
            },
            protocols: {
                type: "string",
                description:
                    "Comma-separated list of allowed protocols (optional)",
            },
        },
        required: ["amount", "token"],
    },
    execute: async (runtime: IAgentRuntime, params: any, _message: Memory) => {
        try {
            const connection = new Connection(runtime.getSetting("RPC_URL"));
            const apiKey = runtime.getSetting("FLEXLEND_API_KEY");
            const walletAddress = runtime.getSetting("WALLET_PUBLIC_KEY");

            if (!apiKey) {
                return "LuLo API key not configured";
            }

            const luloActions = new LuloActions(connection, apiKey);
            const transactionMeta =
                await luloActions.generateDepositTransaction({
                    owner: walletAddress,
                    mintAddress: params.token,
                    depositAmount: params.amount,
                    allowedProtocols: params.protocols,
                });

            return `Generated deposit transactions for ${params.amount} to LuLo:\n${transactionMeta
                .map(
                    (meta) =>
                        `- ${meta.protocol}: $${meta.totalDeposit.toLocaleString()}`
                )
                .join("\n")}`;
        } catch (error) {
            console.error("Error in LuLo deposit action:", error);
            return "Failed to generate deposit transaction";
        }
    },
};

// Create withdraw action for the Eliza framework
export const withdrawAction: Action = {
    name: "lulo-withdraw",
    description: "Withdraw funds from LuLo yield farming",
    parameters: {
        type: "object",
        properties: {
            amount: {
                type: "string",
                description:
                    "Amount to withdraw (or 'all' for full withdrawal)",
            },
            token: {
                type: "string",
                description: "Token mint address to withdraw",
            },
        },
        required: ["amount", "token"],
    },
    execute: async (runtime: IAgentRuntime, params: any, _message: Memory) => {
        try {
            const connection = new Connection(runtime.getSetting("RPC_URL"));
            const apiKey = runtime.getSetting("FLEXLEND_API_KEY");
            const walletAddress = runtime.getSetting("WALLET_PUBLIC_KEY");

            if (!apiKey) {
                return "LuLo API key not configured";
            }

            const luloActions = new LuloActions(connection, apiKey);
            const transactionMeta =
                await luloActions.generateWithdrawTransaction({
                    owner: walletAddress,
                    mintAddress: params.token,
                    withdrawAmount:
                        params.amount === "all" ? "0" : params.amount,
                    withdrawAll: params.amount === "all",
                });

            return `Generated withdraw transactions from LuLo:\n${transactionMeta
                .map(
                    (meta) =>
                        `- ${meta.protocol}: $${meta.totalDeposit.toLocaleString()}`
                )
                .join("\n")}`;
        } catch (error) {
            console.error("Error in LuLo withdraw action:", error);
            return "Failed to generate withdraw transaction";
        }
    },
};
