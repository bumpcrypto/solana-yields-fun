import {
    composeContext,
    IAgentRuntime,
    Memory,
    ModelClass,
    Evaluator,
    State,
    generateTrueOrFalse,
    MemoryManager,
    generateObjectArray,
    Content,
} from "@ai16z/eliza";
import { TrustScoreDatabase } from "@ai16z/plugin-trustdb";
import { Connection } from "@solana/web3.js";
import { BirdeyeProvider } from "../providers/birdeyeProvider";
import { RaydiumProvider } from "../providers/raydiumProvider";
import {
    YieldOpportunityMetrics,
    YieldRecommendation,
    YieldIntent,
} from "../types/yield";
import { booleanFooter } from "../utils/templates";
import { getWalletKey } from "../keypairUtils";
import { TokenProvider } from "../providers/token";
import { TokenPairTrustManager } from "../providers/tokenPairTrustManager";
import { DexScreenerProvider } from "../providers/dexScreenerProvider";
import { OxProvider } from "../providers/oxProvider";

const shouldProcessTemplate = `# Task: Decide if the recent messages should be processed for yield opportunity evaluation.

Look for messages that contain keywords related to:

1. Staking Opportunities:
- Liquid staking (mSOL, stSOL, jitoSOL)
- Native SOL staking
- Governance token staking
- Protocol staking rewards
- Validator staking
- Restaking protocols

2. Liquidity Providing (LP):
- Concentrated liquidity positions
- Traditional liquidity pools
- Single-sided liquidity
- Stable pools
- Volatile pairs
- Range orders
- Active LP management
- Automated market making

3. Yield Farming:
- Incentivized pools
- Dual rewards
- Emission rewards
- Trading fee sharing
- Protocol revenue sharing
- Yield aggregation
- Auto-compounding
- Leveraged farming

4. DeFi Lending:
- Supply/lending yields
- Borrowing rates
- Collateral optimization
- Interest rate markets
- Money markets
- Lending protocols

5. Protocol Rewards:
- Governance rewards
- Trading fee rebates
- Referral rewards
- Protocol revenue distribution
- Loyalty programs
- Airdrop farming

Based on the following conversation, should the messages be processed for yield evaluation? YES or NO

{{recentMessages}}

Should the messages be processed for yield evaluation? ${booleanFooter}`;

export const formatRecommendations = (recommendations: Memory[]) => {
    const messageStrings = recommendations
        .reverse()
        .map((rec: Memory) => `${(rec.content as Content)?.content}`);
    const finalMessageStrings = messageStrings.join("\n");
    return finalMessageStrings;
};
const recommendationTemplate = `# Task: Evaluate yield and trading opportunities based on the conversation and market data.

# Context
Recent market data and metrics are provided below:
{{marketMetrics}}

Previous recommendations:
{{previousRecommendations}}

User's stated intent: {{intent}}

# Opportunity Categories to Consider

1. Concentrated Liquidity Opportunities:
- High volatility pairs for maximum fee generation
- Wide price ranges for volatile assets
- Active range management for optimal positioning
- Multiple positions across different ranges
- Leverage volatility for higher returns

2. Liquidity Providing Strategies:
- Focus on high volume/volatile pairs
- Aggressive range setting for max fee capture
- Dynamic rebalancing for volatile markets
- Capitalize on price swings
- Stack yields with farming rewards

3. Yield Farming Opportunities:
- High APY farming with active management
- Leveraged farming positions
- Stack multiple reward tokens
- Capitalize on new pool incentives
- Early pool entry for max rewards

4. Delta Neutral Strategies:
- Use volatility for both sides of trade
- Funding rate arbitrage
- Perpetual-spot basis trading
- Options-based neutral strategies
- Cross-protocol arbitrage

5. Market Making Opportunities:
- Wide spreads in volatile markets
- Active order management
- Cross-venue arbitrage
- Stack LP fees with MM profits
- Capitalize on inefficient markets

# Response Format
Response should be a JSON object array inside a JSON markdown block. Correct response format:
\`\`\`json
[
    {
        "intent": "farm" | "provide_liquidity" | "monitor" | "perp_trade" | "spot_trade",
        "strategy": "concentrated" | "full-range" | "observe" | "delta-neutral" | "long" | "short" | "basis",
        "recommender": string,
        "ticker": string | null,
        "contractAddress": string | null,
        "type": "buy" | "dont_buy" | "sell" | "dont_sell",
        "conviction": "none" | "low" | "medium" | "high",
        "alreadyKnown": boolean,
        "ammRouting": string[],
        "maxExposure": number,
        "riskLevel": "low" | "medium" | "high" | "extreme",
        "reasoning": string[],
        "leverage": number,
        "fundingRate": number,
        "basisSpread": number,
        "hedgeRatio": number,
    },
    ...
]
\`\`\``;

export const yieldOpportunityEvaluator: Evaluator = {
    name: "YIELD_OPPORTUNITY_EVALUATOR",
    similes: ["YIELD_EVAL", "OPPORTUNITY_EVAL"],
    description:
        "Evaluates DeFi yield opportunities based on market data and user intent",
    alwaysRun: false,

    async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
        // Ignore short messages and bot's own messages
        if (
            message.content.text.length < 5 ||
            message.userId === message.agentId
        ) {
            return false;
        }

        // Check for yield-related keywords
        const yieldKeywords = [
            "yield",
            "apy",
            "apr",
            "farm",
            "stake",
            "liquidity",
            "pool",
            "vault",
            "lp",
            "staking",
            "rewards",
        ];

        const text = message.content.text.toLowerCase();
        return yieldKeywords.some((keyword) => text.includes(keyword));
    },

    async handler(runtime: IAgentRuntime, message: Memory): Promise<any> {
        try {
            const state = await runtime.composeState(message);

            const { agentId, roomId } = state;

            // Check if we should process the messages
            const shouldProcessContext = composeContext({
                state,
                template: shouldProcessTemplate,
            });

            const shouldProcess = await generateTrueOrFalse({
                context: shouldProcessContext,
                modelClass: ModelClass.SMALL,
                runtime,
            });

            if (!shouldProcess) {
                console.log("Skipping process");
                return [];
            }

            const recommendationsManager = new MemoryManager({
                runtime,
                tableName: "recommendations",
            });

            const recentRecommendations =
                await recommendationsManager.getMemories({
                    roomId,
                    count: 20,
                });

            const context = composeContext({
                state: {
                    ...state,
                    recentRecommendations: formatRecommendations(
                        recentRecommendations
                    ),
                },
                template: recommendationTemplate,
            });

            const recommendations = await generateObjectArray({
                runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            console.log("recommendations", recommendations);

            if (!recommendations) {
                return [];
            }

            const filteredRecommendations = recommendations.filter((rec) => {
                return (
                    !rec.alreadyKnown &&
                    rec.intent &&
                    rec.strategy &&
                    rec.recommender &&
                    rec.type &&
                    rec.conviction &&
                    rec.ammRouting &&
                    rec.maxExposure &&
                    rec.riskLevel &&
                    rec.reasoning &&
                    rec.leverage &&
                    rec.fundingRate &&
                    rec.basisSpread &&
                    rec.hedgeRatio &&
                    rec.ticker &&
                    rec.contractAddress &&
                    rec.recommender.trim() !== ""
                );
            });

            const { publicKey } = await getWalletKey(runtime, false);

            // TODO: Everything else - market data gathering, metrics calculation, etc.
            // This is where we'll add:
            // 1. Market data gathering from Birdeye/Raydium
            // 2. Metrics calculation
            // 3. Recommendation generation
            // 4. Storing evaluation

            // 7. Process each filtered recommendation
            for (const rec of filteredRecommendations) {
                // Create connection and wallet provider
                const walletProvider = new WalletProvider(
                    new Connection(
                        runtime.getSetting("RPC_URL") ||
                            "https://api.mainnet-beta.solana.com"
                    ),
                    publicKey
                );

                // Handle different intents
                switch (rec.intent) {
                    case "provide_liquidity": {
                        // 1. First use DexScreener to find the best pool/pair for our tokens
                        const dexScreener = new DexScreenerProvider();

                        // 2. Get the quote token (usually SOL/USDC) from the recommendation
                        const quoteToken =
                            "So11111111111111111111111111111111111111112"; // Always use SOL as quote

                        // 3. Find the best DEX and pool for this pair
                        const bestDex = await dexScreener.getBestDexForPair(
                            rec.contractAddress,
                            quoteToken
                        );

                        if (bestDex.dexId === "none") {
                            console.warn("No liquid pools found for this pair");
                            continue;
                        }

                        // 4. Get all pairs data to analyze market depth
                        const allPairs =
                            await dexScreener.getPairsByTokenAddress(
                                rec.contractAddress
                            );
                        const solPairs = allPairs.filter(
                            (pair) => pair.quoteToken.symbol === "SOL"
                        );

                        // 5. Now evaluate trust for the token pair
                        const tokenPairTrustManager = new TokenPairTrustManager(
                            runtime
                        );
                        const trustState =
                            await tokenPairTrustManager.getTrustState(
                                rec.contractAddress,
                                quoteToken
                            );

                        // 6. If the pair isn't trustworthy, skip it
                        if (!trustState.recommendations.shouldProvide) {
                            console.warn(
                                `Pair not recommended for LP: ${trustState.recommendations.warning.join(", ")}`
                            );
                            continue;
                        }

                        // 7. Store trust score in database for future reference
                        const trustScoreDb = new TrustScoreDatabase(
                            runtime.databaseAdapter.db
                        );

                        await trustScoreDb.createOrUpdateScore({
                            address: bestDex.pairAddress,
                            protocol: bestDex.dexId,
                            tokenAddress: rec.contractAddress,
                            poolMetrics: {
                                volume24h: bestDex.volumeUsd24h,
                                liquidity: bestDex.liquidityUsd,
                                pairAddress: bestDex.pairAddress,
                            },
                            trustMetrics: trustState.metrics,
                            lastUpdated: Date.now(),
                        });

                        // 8. Create memory entry with all the analyzed data
                        const recMemory = {
                            userId: message.userId,
                            agentId,
                            content: {
                                text: JSON.stringify({
                                    type: "lp_recommendation",
                                    data: {
                                        ...rec,
                                        bestDex: {
                                            dexId: bestDex.dexId,
                                            pairAddress: bestDex.pairAddress,
                                            volumeUsd24h: bestDex.volumeUsd24h,
                                            liquidityUsd: bestDex.liquidityUsd,
                                        },
                                        allPairs: solPairs,
                                        trustState,
                                        maxExposure: Math.min(
                                            trustState.recommendations
                                                .maxExposure,
                                            bestDex.liquidityUsd * 0.01 // Cap at 1% of pool liquidity
                                        ),
                                        riskLevel:
                                            trustState.recommendations
                                                .riskLevel,
                                        warnings:
                                            trustState.recommendations.warning,
                                    },
                                }),
                                type: "lp_recommendation",
                                source: "yield_evaluator",
                            },
                            roomId,
                            createdAt: Date.now(),
                        };

                        await recommendationsManager.createMemory(
                            recMemory,
                            true
                        );
                        break;
                    }

                    case "perp_trade": {
                        // 1. First use Birdeye to analyze the token and market
                        const birdeyeProvider = new BirdeyeProvider();

                        // 2. Get market data and evaluation from Birdeye
                        const [tokenMarketData, pairEvaluation] =
                            await Promise.all([
                                birdeyeProvider.getMarketData(
                                    rec.contractAddress
                                ),
                                birdeyeProvider.evaluatePair(
                                    rec.contractAddress,
                                    rec.quoteToken ||
                                        "So11111111111111111111111111111111111111112" // Default to SOL
                                ),
                            ]);

                        // 3. If market conditions aren't favorable, skip it
                        if (pairEvaluation.recommendation === "avoid") {
                            console.warn(
                                `Market conditions unfavorable for perp trading: ${pairEvaluation.riskLevel} risk`
                            );
                            continue;
                        }

                        // 4. Get OX provider for perp-specific data
                        const oxProvider = new OxProvider({
                            apiKey: runtime.getSetting("OX_API_KEY"),
                            apiSecret: runtime.getSetting("OX_API_SECRET"),
                        });

                        // 5. Get perp market data from OX
                        const marketInfo = await oxProvider.getMarketInfo(
                            rec.marketCode
                        );
                        const fundingRates = await oxProvider.getFundingRates(
                            rec.marketCode
                        );

                        // 6. Validate position parameters
                        const isValidPosition =
                            await oxProvider.validatePosition(
                                rec.marketCode,
                                rec.size.toString(),
                                rec.leverage
                            );

                        if (!isValidPosition) {
                            console.warn(
                                "Position parameters invalid or exceed limits"
                            );
                            continue;
                        }

                        // 7. Store trust score and market evaluation
                        const trustScoreDb = new TrustScoreDatabase(
                            runtime.databaseAdapter.db
                        );
                        await trustScoreDb.createOrUpdateScore({
                            address: rec.contractAddress,
                            protocol: "ox",
                            tokenAddress: rec.contractAddress,
                            marketMetrics: {
                                volume24h: tokenMarketData.volume24h,
                                liquidity: tokenMarketData.liquidity,
                                volatility:
                                    pairEvaluation.volatilityMetrics
                                        .pairVolatility,
                                fundingRate: fundingRates.current,
                            },
                            trustMetrics: {
                                riskLevel: pairEvaluation.riskLevel,
                                marketHealth: pairEvaluation.marketHealth,
                                confidenceScore: pairEvaluation.confidenceScore,
                            },
                            lastUpdated: Date.now(),
                        });

                        // Analyze volatility context for the perp trade
                        const volatilityContext = {
                            isHighVol:
                                pairEvaluation.volatilityMetrics
                                    .pairVolatility > 50,
                            isLong: rec.direction === "long",
                            fundingDirection: Math.sign(fundingRates.current),
                            warnings: [],
                        };

                        // High volatility warnings based on position
                        if (volatilityContext.isHighVol) {
                            if (volatilityContext.isLong) {
                                volatilityContext.warnings.push(
                                    "High volatility - Consider tighter stops for long position"
                                );
                            } else {
                                volatilityContext.warnings.push(
                                    "High volatility - Consider lower size for short position"
                                );
                            }
                        }

                        // Funding rate warnings based on position
                        if (Math.abs(fundingRates.current) > 0.01) {
                            if (
                                (volatilityContext.isLong &&
                                    fundingRates.current > 0) ||
                                (!volatilityContext.isLong &&
                                    fundingRates.current < 0)
                            ) {
                                volatilityContext.warnings.push(
                                    `You're paying ${Math.abs(fundingRates.current * 100).toFixed(2)}% funding rate`
                                );
                            } else {
                                volatilityContext.warnings.push(
                                    `You're earning ${Math.abs(fundingRates.current * 100).toFixed(2)}% funding rate`
                                );
                            }
                        }

                        // 8. Create memory entry with all the analyzed data
                        const recMemory = {
                            userId: message.userId,
                            agentId,
                            content: {
                                text: JSON.stringify({
                                    type: "perp_recommendation",
                                    data: {
                                        ...rec,
                                        marketInfo: {
                                            marketCode: rec.marketCode,
                                            fundingRate: fundingRates.current,
                                            openInterest:
                                                marketInfo.openInterest,
                                            volume24h: marketInfo.volume24h,
                                        },
                                        evaluation: pairEvaluation,
                                        tokenMarketData,
                                        maxLeverage:
                                            await oxProvider.getMaxLeverage(
                                                rec.marketCode,
                                                rec.size.toString()
                                            ),
                                        recommendedSize: Math.min(
                                            rec.size,
                                            tokenMarketData.volume24h * 0.01 // Cap at 1% of daily volume
                                        ),
                                        volatilityContext,
                                        warnings: volatilityContext.warnings,
                                    },
                                }),
                                type: "perp_recommendation",
                                source: "yield_evaluator",
                            },
                            roomId,
                            createdAt: Date.now(),
                        };

                        await recommendationsManager.createMemory(
                            recMemory,
                            true
                        );
                        break;
                    }
                }
            }

            return filteredRecommendations;
        } catch (error) {
            console.error("Error in yield opportunity evaluator:", error);
            return "Failed to evaluate yield opportunity.";
        }
    },

    examples: [],
};

// // Helper functions moved outside the evaluator
// async function calculateMetrics(
//     priceData: any,
//     securityData: any,
//     holderData: any,
//     historicalPrices: any
// ): Promise<YieldOpportunityMetrics> {
//     const volatility = calculateVolatility(historicalPrices);
//     const volumeToTVL = priceData.volume24h / priceData.tvl;

//     return {
//         price: priceData.price,
//         priceChange24h: priceData.priceChange24h,
//         volume24h: priceData.volume24h,
//         tvl: priceData.tvl,
//         volumeToTVLRatio: volumeToTVL,
//         estimatedAPR: calculateEstimatedAPR(priceData, volumeToTVL),
//         feeAPR: calculateFeeAPR(priceData),
//         rewardAPR: calculateRewardAPR(priceData),
//         impermanentLossRisk: calculateILRisk(volatility),
//         securityScore: securityData.score,
//         priceVolatility: volatility,
//         volatilityOpportunity: Math.min(100, volatility * 2),
//         liquidityConcentration: calculateLiquidityConcentration(priceData),
//         holderDistribution: calculateHolderDistribution(holderData),
//         hedgingCost: priceData.hedgingCost,
//         fundingRate: priceData.fundingRate,
//         basisSpread: priceData.basisSpread,
//     };
// }

// function calculateVolatility(prices: number[]): number {
//     if (prices.length < 2) return 0;
//     const returns = prices
//         .slice(1)
//         .map((price, i) => Math.log(price / prices[i]));
//     const mean = returns.reduce((a, b) => a + b) / returns.length;
//     const variance =
//         returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
//     return Math.sqrt(variance);
// }

// function calculateEstimatedAPR(priceData: any, volumeToTVL: number): number {
//     return volumeToTVL * 365 * 0.003 * 100; // Assuming 0.3% fee tier
// }

// function calculateFeeAPR(priceData: any): number {
//     return ((priceData.volume24h * 0.003 * 365) / priceData.tvl) * 100;
// }

// function calculateRewardAPR(priceData: any): number {
//     return priceData.rewardAPR || 0;
// }

// function calculateILRisk(volatility: number): number {
//     return volatility * 200; // Raw IL calculation
// }

// function calculateLiquidityConcentration(priceData: any): number {
//     return priceData.liquidityConcentration || 50;
// }

// function calculateHolderDistribution(holderData: any): number {
//     return holderData.distribution || 50;
// }

// async function getPreviousRecommendations(
//     runtime: IAgentRuntime,
//     roomId: string
// ): Promise<string> {
//     const recommendations = await runtime.memoryManager.getMemories({
//         roomId,
//         count: 5,
//         type: "yield_recommendation",
//     });

//     return recommendations.map((r) => JSON.stringify(r.content)).join("\n");
// }

// async function storeEvaluation(
//     runtime: IAgentRuntime,
//     message: Memory,
//     evaluation: any
// ) {
//     await runtime.memoryManager.createMemory({
//         userId: message.userId,
//         agentId: runtime.agentId,
//         content: evaluation,
//         roomId: message.roomId,
//         type: "yield_recommendation",
//         createdAt: Date.now(),
//     });
// }
