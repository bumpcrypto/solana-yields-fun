export interface YieldOpportunity {
    protocol: string;
    type: "LP" | "STAKING" | "LENDING" | "DELTA_NEUTRAL";
    apy: number;
    tvl: number;
    risk: number;
    tokens: string[];
    address: string;
    description: string;
}

export interface PoolData {
    address: string;
    token0: string;
    token1: string;
    fee: number;
    liquidity: number;
    sqrtPrice: number;
    tick: number;
    token0Price: number;
    token1Price: number;
    token0Volume24h: number;
    token1Volume24h: number;
    volumeUSD24h: number;
    feesUSD24h: number;
    tvlUSD: number;
}

export interface StableYieldData {
    protocol: string;
    apy: number;
    tvl: number;
    token: string;
    utilization: number;
    borrowApy: number;
    totalBorrowed: number;
}

export interface TokenPrice {
    address: string;
    symbol: string;
    price: number;
    volume24h: number;
    priceChange24h: number;
    liquidity: number;
}

export interface YieldStats {
    timestamp: number;
    totalValueLocked: number;
    totalYieldGenerated: number;
    averageApy: number;
    numberOfPositions: number;
    profitLoss: number;
}

export interface RiskMetrics {
    volatility: number;
    impermanentLoss: number;
    liquidityDepth: number;
    counterpartyRisk: number;
    protocolRisk: number;
    score: number;
}
