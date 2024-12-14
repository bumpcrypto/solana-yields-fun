Components needed to make an agent: 1. The Model
Your agent is an LLM model (for e.g; chatgpt ), you provide a text, and based on its context, it gives you an outcome, based on patterns it was trained on. Choosing the model is the most important choice you have to make, as it will decide how your agent behaves, thinks, responds and takes actions. You can also chose multiple models for different part of your agent.Here are few points which may help you
GPT model - gpt models by openai are good at reasoning, they are extremely good at that, but that’s all. They are not good with anything tech, you may have noticed this while using chatgpt vs claude.
Anthropic - anthropic models are best when you need to perform technical actions, there technical thinking ability is good
LLAMA - it’s an open source model, which powers majority of models out there --- gpt and claude are good at reasoning but because they are censored models, you can’t customize them a lot which can result in bot’sh behavior. For cheap inference, do check Inference by Kuzco.
BYOM - you can choose to bring your own model and train on cluster providers like ionet which provides gpu’s for training.
2.Giving agent a wallet :
Wallets are the first thing, any agent will need to interact with things on-chain. There are a couple type of wallet to choose from, depending on use-case :
Embedded Wallet - this would be better than an EOA, if your agent needs to perform action across chains, so with help of embedded wallet, you can essentially deposit funds from any supported chain and the agent can then swap to the desired chain it wants.
You can use Crossmint Custodial Wallet which supports Solana and 20+ evm chains.
PKP Wallets - these are multisig wallets, which enable you to create non-custodial wallets for your agent, and are suitable for applications revolving around fund management. Lit Protocol provides an easy way to create/manage them.
EOA Wallets - these are just normal wallets, for which you’ll need to generate the private keys and keep them securely stored in your environment, this is not recommended as it’s least secure.
Multichain Wallets - these are non-custodial wallets for agents to interact on Solana, Ethereum, and Bitcoin (with more chains coming). EmblemAI enables a percentage of every transaction to be routed to agent platforms or creators, creating a built-in revenue model for human developers.

3. Making the agent trade
   Crypto is best at easing flow of value. Once an agent has a wallet, it makes sense to give them trading capabilities, which includes
   Swapping / DCA Tokens - swapping = jupiter. you can use the jupiter apis, to make your agent swap tokens at best market rate. you can also place a DCA or limit order with help of jupiter api, meteora and EmblemAI can also be used to swap tokens
   Creating LP pool - Whenever a new token is created, and the agent thinks that it can go higher, the agent can choose to create an LP position on Meteora which would help the agent earn fees and sustain its economy longer. Orca is another protocol, which an agent can choose to create an LP position. Depending upon the best market rates, agents can choose the preferred protocol.
   Staking - staking is another way to earn rewards, agents can choose to liquid stake sol with help of jupiter/meteora/orca which will help them earn block rewards.
   Airdropping tokens - agent can use airship by Helius, which provides a cheap way to airdrop tokens to masses powered by zkcompression on solana
4. Transaction Landing and anything onchain
   Landing a transaction on the Solana network is a pain, and your agent should not cry because of this.
   Jito Bundles - if you want your transaction to land, then Jito bundles are the best way, you can bundle upto 5 transactions and send them, they’ll be executed atomically for a small tip.
   Priority Fees - you can use Helius rpc to get the most accurate priority fee data for your transaction and use that while sending transactions via RPC increasing your landing chance by 95%. Solana Congestion: How to Best Send Solana Transactions

You need RPC to get anything on-chain, every provider you use would require a RPC to work, Helius is the best rpc you can work with, which also provides geyser plugin and enhanced websockets. 5. Agent Economics
Agents utilize LLM tokens, they are like food for them, for them to sustain they need to earn more than they can spend, and hence require to maintain an economy similar to humans. We saw in the earlier part, on how there are some ways to earn rewards.
Paying for inference on-chain - Agents can use Kuzco, for all inference on solana and pay for usage per token with help of their wallet, agents can also run it’s own node and support the Kuzco network to earn rewards.
Social Value - like humans, social value for agents also matters, if a token is linked to an agent, then token price is the function of the cult/community. Frameworks like ai16z/eliza and GOAT by Crossmint ( integrates eliza + langchain + ai sdk ) make it a lot easier to build custom agents with help of community plugins ( for example, twitter, discord, telegram) or if you are looking for a no-code tool
Assister provides a unique SML model where you can train agents on specific data sets without ever touching the code.
Market Analysis - agent can make market analysis using trusted oracles like switchboard which can provide agent the latest on chain data, and help agent to make informed trades.
Human Creator Royalties - EmblemAI empowers innovative human/agent collaboration by enabling a percentage of an agent’s wallet transactions to be directed back to the agent’s platform and its human creator.

6. Interfaces and Channels
   Agents need an interface to make it convenient for users to interact with it. Interface can be chat / 2d video / 3d video / audio and there should be a channel to find / discover / interact with these agents, like twitter / telegram / discord / slack / zoom call etc
   Interfaces - 3d models would be the most interactive interface, as you can control every aspect of them and essentially create a metaverse of agents. Hologram provides an easy to use extension where anyone can upload their own models, and enable them on platforms like zoom calls/google meets, request for model here. You can also use Hologram to enable custom voices for the agents. For chat interfaces, ai16z/eliza is the best framework out there, enabling you to set up an agent in less than 15 minutes. EmblemAI builds LLM wallets and tooling that is platform agnostic.

Channels - channels are platforms, where users would interact with you agent, it can be twitter / telegram / discord or any app that you can think of. eliza provides community-powered plugins which support twitter / telegram / discord as channels, you can also build your own plugins and use it, so you can integrate hologram and eliza in 1 app, and make a metaverse. Crossmint’s GOAT framework makes it more simpler and is built upon eliza / langchain and ai-sdk, you can build an agent you can speak to to get your wallet address, balance, and have him roast you for not holding enough coins
