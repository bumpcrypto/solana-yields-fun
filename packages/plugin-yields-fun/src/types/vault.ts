import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export interface VaultAccount {
    agentId: string;
    authority: PublicKey;
    totalShares: BN;
    totalAssets: BN;
    allowedTokens: PublicKey[];
    strategies: PublicKey[];
    performanceFee: number;
    managementFee: number;
    lastHarvestTime: BN;
}

export interface UserPosition {
    owner: PublicKey;
    vault: PublicKey;
    shares: BN;
    depositedAmount: BN;
    lastDepositTime: BN;
}

export interface VaultStats {
    tvl: number;
    apy: number;
    totalShares: number;
    totalUsers: number;
    performanceFee: number;
    managementFee: number;
    allowedTokens: string[];
    activeStrategies: string[];
}

export interface VaultAction {
    type: "DEPOSIT" | "WITHDRAW" | "HARVEST";
    amount: number;
    token: string;
    timestamp: number;
    txHash: string;
    status: "PENDING" | "COMPLETED" | "FAILED";
}

export interface VaultConfig {
    minDepositAmount: BN;
    maxTvl: BN;
    cooldownPeriod: number;
    performanceFee: number;
    managementFee: number;
    allowedTokens: PublicKey[];
    allowedStrategies: PublicKey[];
}
