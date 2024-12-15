export const BIRDEYE_API_BASE_URL = "https://public-api.birdeye.so";
export const BIRDEYE_API_V1 = `${BIRDEYE_API_BASE_URL}/v1`;
export const BIRDEYE_API_V3 = `${BIRDEYE_API_BASE_URL}/defi/v3`;

// Token endpoints
export const TOKEN_SECURITY = (tokenAddress: string) =>
    `/defi/token_security?address=${tokenAddress}`;
export const TOKEN_METADATA = (tokenAddress: string) =>
    `/token/metadata/${tokenAddress}`;
export const TOKEN_HOLDER = (tokenAddress: string) =>
    `/token/holder/${tokenAddress}`;
export const TOKEN_MINT_BURN = (tokenAddress: string) =>
    `/token/mint-burn/${tokenAddress}`;

// Price and volume endpoints
export const PRICE_VOLUME_SINGLE = (tokenAddress: string) =>
    `/token/price-volume/${tokenAddress}`;
export const OHLCV = (tokenAddress: string) => `/token/ohlcv/${tokenAddress}`;

// Trading endpoints
export const TRADES_PAIR = "/trades/pair";
export const TRADES_TOKEN = (tokenAddress: string) =>
    `/trades/token/${tokenAddress}`;

// Market data endpoints
export const MARKET_DATA = (tokenAddress: string) =>
    `${BIRDEYE_API_V3}/token/market-data?address=${tokenAddress}`;
export const PAIR_OVERVIEW = (pairAddress: string) =>
    `${BIRDEYE_API_V3}/pair/overview/single?address=${pairAddress}`;

// Wallet endpoints
export const WALLET_TOKEN_LIST = (walletAddress: string) =>
    `${BIRDEYE_API_V1}/wallet/token_list?wallet=${walletAddress}`;
export const WALLET_TX_LIST = (walletAddress: string, limit: number = 100) =>
    `${BIRDEYE_API_V1}/wallet/tx_list?wallet=${walletAddress}&limit=${limit}`;

// Historical price endpoint
export const HISTORY_PRICE = "/defi/history_price";

export type TimeScope =
    | "1m"
    | "3m"
    | "5m"
    | "15m"
    | "30m"
    | "1H"
    | "2H"
    | "4H"
    | "6H"
    | "8H"
    | "12H"
    | "1D"
    | "3D"
    | "1W"
    | "1M";

export interface HistoricalPriceParams {
    address: string;
    address_type?: "token" | "pair";
    type?: TimeScope;
    time_from?: number;
    time_to?: number;
}

export interface HistoricalPriceDataPoint {
    unixTime: number;
    value: number;
}

export interface HistoricalPriceResponse {
    data: HistoricalPriceDataPoint[];
    address: string;
    timeType: TimeScope;
}

// Helper to construct comma-separated address list
export const buildAddressList = (addresses: string[]): string =>
    addresses.join(",");

// Types for API responses
export interface TokenSecurityResponse {
    isHoneypot: boolean;
    hasBlacklist: boolean;
    hasMintFunction: boolean;
    hasRenounced: boolean;
    top10HolderPercent: number;
}

export interface PriceVolumeResponse {
    price: number;
    priceChange24h: number;
    volume24h: number;
    volumeChange24h: number;
    liquidity: number;
    mcap: number;
    feeAPY?: number;
}

export interface TradeResponse {
    side: "buy" | "sell";
    volume: number;
    price: number;
    timestamp: number;
}

export interface OHLCVResponse {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface TokenHolderResponse {
    totalHolders: number;
    holdings: {
        address: string;
        balance: number;
        percentage: number;
    }[];
}

export interface TokenMetadataResponse {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    owner: string;
    isVerified: boolean;
}

export interface MarketDataResponse {
    price: number;
    volume24h: number;
    liquidity: number;
    marketCap: number;
    fdv: number;
    priceChange: {
        "1h": number;
        "24h": number;
        "7d": number;
        "30d": number;
    };
}

export interface PairOverviewResponse {
    address: string;
    baseToken: string;
    quoteToken: string;
    liquidity: number;
    volume24h: number;
    fee24h: number;
    apr: number;
    priceChange24h: number;
}

// Updated and new response types
export interface TokenMarketDataResponse {
    data: {
        address: string;
        liquidity: number;
        price: number;
        supply: number;
        marketcap: number;
        circulating_supply: number;
        circulating_marketcap: number;
    };
    success: boolean;
}

export interface PairToken {
    address: string;
    decimals: number;
    icon: string;
    symbol: string;
}

export interface PairOverviewResponse {
    data: {
        address: string;
        base: PairToken;
        quote: PairToken;
        created_at: string;
        name: string;
        source: string;
        liquidity: number;
        price: number;
        trade_24h: number;
        unique_wallet_24h: number;
        volume_24h: number;
        liquidity_change_percentage_24h: number | null;
        trade_24h_change_percent: number;
        unique_wallet_24h_change_percent: number | null;
        volume_24h_change_percentage_24h: number | null;
        // Additional time-based metrics
        trade_1h: number;
        trade_30m: number;
        trade_12h: number;
        trade_2h: number;
        trade_4h: number;
        trade_8h: number;
        volume_1h: number;
        volume_30m: number;
        volume_12h: number;
        volume_2h: number;
        volume_4h: number;
        volume_8h: number;
        // Base and quote specific volumes
        volume_12h_base: number;
        volume_1h_base: number;
        volume_2h_base: number;
        volume_30m_base: number;
        volume_4h_base: number;
        volume_8h_base: number;
        volume_12h_quote: number;
        volume_1h_quote: number;
        volume_2h_quote: number;
        volume_30m_quote: number;
        volume_4h_quote: number;
        volume_8h_quote: number;
    };
    success: boolean;
}

export interface WalletTokenListResponse {
    data: Array<{
        address: string;
        symbol: string;
        balance: number;
        price: number;
        value: number;
    }>;
    success: boolean;
}

export interface WalletTransactionListResponse {
    data: Array<{
        signature: string;
        timestamp: number;
        type: string;
        status: string;
        amount: number;
        token: {
            address: string;
            symbol: string;
            decimals: number;
        };
        price: number;
        value: number;
    }>;
    success: boolean;
}

// Chain configuration type
export interface ChainConfig {
    chain: string;
    version: string;
}

// Helper to get chain configuration from environment
export const getChainConfig = (): ChainConfig => ({
    chain: process.env.AGENT_CHAIN || "solana",
    version: "v3",
});

// Helper to construct API headers
export const getApiHeaders = (apiKey: string) => ({
    accept: "application/json",
    "x-chain": getChainConfig().chain,
    "X-API-KEY": apiKey,
});
