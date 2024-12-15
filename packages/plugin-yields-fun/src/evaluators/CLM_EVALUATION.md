# CLM Opportunity Evaluation Framework

## Overview

This framework provides a systematic approach to evaluating Concentrated Liquidity Market Making (CLM) opportunities on Solana, with the goal of maximizing weekly returns while managing risks.

## Core Evaluation Components

### 1. Market Dynamics (Primary Filter)

#### Required Birdeye Data Points

1. **Price & Volume Analysis** (`PRICE_VOLUME_SINGLE` endpoint)

    - Current price and 24h change
    - Volume metrics: `volume24h`, `volumeChange24h`
    - Liquidity depth: `liquidity`
    - Fee APY potential: `feeAPY`

    Minimum requirements:

    - 24h volume > $100k
    - Liquidity > $250k
    - Fee APY > 20%
    - Volume stability (change within ±50%)

2. **Historical Price Data** (`OHLCV` endpoint)

    - Price volatility patterns
    - Support/resistance levels
    - Volume consistency

    Analysis requirements:

    - Minimum 7 days of data
    - Clear support/resistance zones
    - No extreme volatility (>50% in 24h)
    - Healthy volume distribution

3. **Market Data Monitoring** (`MARKET_DATA` endpoint)

    - Real-time price tracking
    - Volume trends across timeframes
    - Market cap validation
    - Price changes across intervals

    Thresholds:

    - Market cap > $1M
    - Consistent trading activity
    - Price changes within normal range:
        - 1h: ±10%
        - 24h: ±25%
        - 7d: ±50%

4. **Liquidity Analysis** (`PAIR_OVERVIEW` endpoint)

    - Total liquidity
    - Fee generation
    - Volume/liquidity ratio
    - APR calculations

    Requirements:

    - Minimum $250k TVL
    - Fee generation > $1k daily
    - Healthy volume/TVL ratio (>0.2)
    - Sustainable APR projections

### 2. Security Assessment (Secondary Filter)

1. **Token Security** (`TOKEN_SECURITY` endpoint)

    - Honeypot detection: `isHoneypot`
    - Blacklist presence: `hasBlacklist`
    - Mint function risks: `hasMintFunction`
    - Ownership status: `hasRenounced`
    - Holder concentration: `top10HolderPercent`

    Fail criteria:

    - Any honeypot detection
    - Active blacklist
    - Unrenounced mint function
    - Top 10 holders > 80%

2. **Token Metadata** (`TOKEN_METADATA` endpoint)

    - Verification status
    - Supply metrics
    - Ownership details

    Requirements:

    - Must be verified
    - Owner should be renounced or multi-sig

3. **Holder Analysis** (`TOKEN_HOLDER` endpoint)

    - Distribution metrics
    - Wallet patterns
    - Concentration risks

    Minimum requirements:

    - > 500 unique holders
    - No single holder >25%
    - Healthy distribution curve

#### Continuous Monitoring Flow

1. **Real-time Price & Volume**

    ```
    PRICE_VOLUME_SINGLE (1min intervals)
    MARKET_DATA (5min intervals)
    ```

2. **Liquidity & Trading**

    ```
    PAIR_OVERVIEW (5min intervals)
    TRADES_TOKEN (real-time)
    ```

3. **Risk Monitoring**
    ```
    TOKEN_HOLDER (hourly)
    TOKEN_SECURITY (daily)
    ```

### 3. Position Management

#### Entry Criteria

- Price within 20% of established support
- Volume trending upward or stable
- Liquidity depth increasing/stable
- Fee APR above minimum threshold
- All security checks passed

#### Exit Triggers

- Volume drop >50% from entry
- Liquidity reduction >40%
- Security status change
- Fee APR below threshold
- Abnormal price movement

### 4. DEX Evaluation (Platform Risk)

- **DEX Scoring Criteria**

    - Protocol security history
    - TVL stability
    - Fee tier efficiency
    - Integration reliability
    - Smart contract audits

- **DEX Priority Ranking**
    1. Raydium (Most established, highest volume)
    2. Orca (Strong security, good liquidity)
    3. Meteora (Newer but growing)

### 5. CLM Position Optimization

#### Range Setting Strategy

Based on memecoin-lp.md insights:

- **Entry Criteria**

    - Current price within 20-25% of local support
    - Volume > $100k daily average
    - Minimum 50% fee APR potential

- **Range Parameters**

    - Lower bound: 20-30% below current price
    - Upper bound: Based on token type:
        - Memecoins: 2-3x current price
        - Stable pairs: ±1% from peg
        - Blue chips: 50-100% above current price

- **Duration Guidelines**
    - Short-term (1-3 days): High volatility pairs
    - Medium-term (3-5 days): Trending tokens
    - Long-term (5-7 days): Stable pairs

### 6. Risk Management

#### Position Sizing

- Maximum 20% of portfolio per position
- Risk-adjusted sizing based on:
    - Token security score
    - Volume consistency
    - Price stability metrics
    - DEX reliability

#### Exit Strategies

1. **Profit Taking**

    - Take 25% profits when fees exceed 5% of position
    - Rebalance ranges after 50% price movement
    - Full exit when target return achieved (varies by pair)

2. **Risk Management**
    - Immediate exit if:
        - Volume drops >70% from entry
        - Suspicious mint/burn activity
        - Large holder concentration changes
        - DEX technical issues

## Implementation Priority

1. **High Priority Pairs**

    - SOL/USDC (Base liquidity)
    - Top 10 volume tokens/USDC
    - Trending memecoins with >$1M daily volume

2. **Medium Priority**

    - Cross-token opportunities (non-USDC pairs)
    - New listings with strong fundamentals
    - Recovery plays post-dips

3. **Monitoring Requirements**
    - 5-minute interval price checks
    - Hourly volume analysis
    - Daily range optimization
    - Real-time wallet tracking

## Performance Metrics

### Weekly Targets

- Minimum 5% base return from fees
- 10-20% additional return from range optimization
- Maximum 2% impermanent loss tolerance

### Risk Metrics

- Sharpe Ratio > 2
- Maximum drawdown < 15%
- Position correlation < 0.5

## Technical Integration

### API Endpoints Priority

1. **Essential**

    - Token-Overview
    - Price Volume-Single
    - OHLCV
    - Token-Security
    - Trades-Pair

2. **Supporting**
    - Token-Holder
    - Token-Mint/Burn
    - Trades-Token
    - Market Data

### Automation Requirements

- Position monitoring system
- Range adjustment triggers
- Risk management alerts
- Performance tracking dashboard

## References

- Birdeye API Documentation
- Memecoin LP Strategy Guide
- Historical CLM Performance Data
- DEX Security Audits
