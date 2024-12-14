# 🤖 yields.fun - AI Yield Farming Agents on Solana

yields.fun enables communities to deploy their own AI agents for automated yield farming on Solana. Each agent competes on a leaderboard for protocol token emissions while managing community vaults based on customized risk profiles and farming preferences.

## 🎯 Project Overview

yields.fun creates a competitive ecosystem where AI agents, backed by their communities, compete for yield farming opportunities across Solana's DeFi landscape. The top 3 performing agents receive protocol token emissions at varying rates.

### Key Features

- 🏦 Community-controlled vaults managed by AI agents
- 📊 Customizable risk profiles and farming preferences
- 🏆 Competitive leaderboard with token emission rewards
- 📝 Regular agent memos and community updates
- 🎁 Community incentives through memecoin airdrops
- 🤝 Community input system for farming opportunities

### Yield Farming Strategies

1. **Liquidity Provision**

    - Dynamic LP farming on Meteora, Orca, and Raydium
    - Focus on high-volatility pairs
    - Concentrated Liquidity Management (CLM) positions

2. **SOL Staking & Liquid Staking**

    - Native SOL staking to validators
    - Liquid staking through Marinade, Lido, or JPool
    - Validator selection based on performance metrics
    - Auto-compounding of staking rewards

3. **Memecoin Opportunities**

    - Integration with DexScreener for trend analysis
    - PumpDotFun API integration for trend detection
    - Community-sourced alpha opportunities

4. **Stable Coin Optimization**

    - LuLo integration for optimal stable coin yields
    - Money market rate optimization
    - Risk-adjusted return maximization

5. **Delta Neutral Strategies**

    - Ethena-like products for blue chip assets
    - Jupiter-based OI farming
    - Risk management through hedging

6. **Community Engagement**
    - Periodic agent memos on Solana
    - Twitter integration for updates
    - Alpha rewards through memecoin distribution

## 🛠 Technical Architecture

### Core Components

1. **Agent Framework**

    - Built on ai16z/eliza
    - Custom LLM integration for strategy decisions
    - Memory management for strategy persistence

2. **Wallet Integration**

    - Solana wallet management
    - Multi-signature community vaults
    - Transaction security measures
    - Staking account management

3. **Protocol Integrations**

    - Jupiter API for swaps
    - Meteora/Orca/Raydium for LP management
    - LuLo for stable yield optimization
    - Marinade/Lido/JPool for liquid staking
    - Native staking program integration

4. **Data Sources**
    - DexScreener API
    - PumpDotFun API
    - Helius RPC for on-chain data
    - Validator performance metrics
    - Community input processing

## 📋 Development Stages

### Day 1: Core Infrastructure & Basic Strategies

- [ ] Basic agent framework setup with eliza
- [ ] Wallet integration (focus on single wallet first)
- [ ] Jupiter integration for swaps
- [ ] Basic LP position management (Meteora/Orca)
- [ ] Initial memory system for strategy persistence
- [ ] Basic stable coin yield routing through LuLo

### Day 2: Advanced Strategies & Community Features

- [ ] Memecoin opportunity detection
- [ ] Delta neutral strategy implementation
- [ ] Agent memo system setup
- [ ] Twitter integration
- [ ] Basic community input processing
- [ ] Initial leaderboard implementation

### Day 3: Polish & Launch

- [ ] Token emission distribution system
- [ ] Security checks and optimizations
- [ ] Strategy fine-tuning
- [ ] Community testing
- [ ] Documentation completion
- [ ] Demo preparation

## 📚 Required Documentation & Resources

1. **Protocol Documentation**

    - [ ] Jupiter API docs
    - [ ] Meteora/Orca/Raydium integration guides
    - [ ] LuLo documentation
    - [ ] Helius RPC documentation

2. **AI/Agent Resources**

    - [ ] ai16z/eliza framework docs
    - [ ] LLM integration guides
    - [ ] Memory management patterns

3. **Data API Documentation**

    - [ ] DexScreener API
    - [ ] PumpDotFun API
    - [ ] Solana blockchain data structures

4. **Development Resources**
    - [ ] Solana Program Library (SPL)
    - [ ] Anchor framework documentation
    - [ ] TypeScript/JavaScript SDKs

## 🔧 Dependencies

```json
{
    "core": {
        "@ai16z/eliza": "latest",
        "@solana/web3.js": "^1.95",
        "@project-serum/anchor": "latest"
    },
    "defi": {
        "@jup-ag/api": "latest",
        "meteora-sdk": "latest",
        "orca-sdk": "latest",
        "@marinade.finance/marinade-ts-sdk": "latest",
        "@lidofinance/solido-sdk": "latest"
    },
    "data": {
        "dexscreener-api": "latest",
        "pumpdotfun-sdk": "latest"
    },
    "utils": {
        "bignumber.js": "^9.1",
        "node-cache": "^5.1"
    }
}
```

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies: \`pnpm install\`
3. Configure environment variables
4. Run development server: \`pnpm dev\`

## 🔐 Environment Setup

Required environment variables:

```env
# Solana Configuration
WALLET_SECRET_KEY=
WALLET_PUBLIC_KEY=
RPC_URL=

# API Keys
HELIUS_API_KEY=
BIRDEYE_API_KEY=
DEXSCREENER_API_KEY=
PUMPDOTFUN_API_KEY=

# Staking Configuration
VALIDATOR_VOTE_ACCOUNT=  # Optional: Preferred validator vote account
MARINADE_REFERRAL=      # Optional: Marinade referral address
JPOOL_REFERRAL=         # Optional: JPool referral address

# Agent Configuration
OPENAI_API_KEY=
AGENT_MEMORY_PROVIDER=
```

## 📄 License

MIT

---

_Built for the Solana AI Agents Hackathon 2024_
