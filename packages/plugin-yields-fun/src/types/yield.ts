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

// New types for the evaluator
export interface YieldOpportunityMetrics {
    // Price and Volume
    price: number;
    priceChange24h: number;
    volume24h: number;
    tvl: number;
    volumeToTVLRatio: number;

    // Yield Components
    estimatedAPR: number;
    feeAPR: number;
    rewardAPR: number;

    // Risk Metrics
    impermanentLossRisk: number;
    securityScore: number;
    priceVolatility: number;
    volatilityOpportunity: number;
    liquidityConcentration: number;
    holderDistribution: number;

    // Delta Neutral Metrics
    hedgingCost?: number;
    fundingRate?: number;
    basisSpread?: number;
}

export interface YieldRecommendation {
    intent: YieldIntent;
    strategy: "concentrated" | "full-range" | "observe" | "delta-neutral";
    ammRouting?: string[];
    maxExposure: number;
    riskLevel: "low" | "medium" | "high" | "extreme";
    reasoning: string[];
    confidence: number;
    hedgingCost?: number;
    fundingRate?: number;
    basisSpread?: number;
    leverageRange?: {
        min: number;
        max: number;
        recommended: number;
    };
    timeHorizon?: "short" | "medium" | "long";
    entryTiming?: "immediate" | "wait_for_dip" | "dollar_cost_average";
    stopLoss?: number;
    takeProfit?: number;
    rebalanceThreshold?: number;
}

export type YieldIntent = "farm" | "provide_liquidity" | "monitor";
