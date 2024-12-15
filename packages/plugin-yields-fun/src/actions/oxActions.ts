import { IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { OxProvider } from "../providers/oxProvider";

export interface OxPositionParams {
    marketCode: string;
    side: "BUY" | "SELL";
    quantity: string;
    leverage: number;
    price?: string; // Optional for market orders
    stopPrice?: string; // For stop orders
    orderType?: "MARKET" | "LIMIT" | "STOP_LIMIT" | "STOP_MARKET";
    timeInForce?: "GTC" | "IOC" | "FOK" | "MAKER_ONLY";
}

export class OxActions {
    private provider: OxProvider;
    private readonly MAX_LEVERAGE = 10;
    private readonly DEFAULT_LEVERAGE = 3;

    constructor(provider: OxProvider) {
        this.provider = provider;
    }

    async openPosition(params: OxPositionParams) {
        // Validate leverage
        const maxAllowedLeverage = await this.provider.getMaxLeverage(
            params.marketCode,
            params.quantity
        );
        const leverage = Math.min(
            params.leverage || this.DEFAULT_LEVERAGE,
            maxAllowedLeverage,
            this.MAX_LEVERAGE
        );

        // Validate position
        const isValid = await this.provider.validatePosition(
            params.marketCode,
            params.quantity,
            leverage
        );
        if (!isValid) {
            throw new Error(
                "Invalid position parameters - check size and leverage"
            );
        }

        // Prepare order
        const order = {
            clientOrderId: Date.now().toString(),
            marketCode: params.marketCode,
            side: params.side,
            quantity: params.quantity,
            orderType: params.orderType || "MARKET",
            timeInForce: params.timeInForce || "GTC",
            price: params.price,
            stopPrice: params.stopPrice,
        };

        // Place order
        return this.provider.makeRequest("POST", "/v3/orders/place", {
            recvWindow: 20000,
            timestamp: Date.now(),
            responseType: "FULL",
            orders: [order],
        });
    }

    async closePosition(marketCode: string) {
        // Get current position
        const positions = await this.provider.getPositions(marketCode);
        const position = positions?.data?.[0]?.positions?.find(
            (p: any) => p.marketCode === marketCode
        );

        if (!position || parseFloat(position.position) === 0) {
            throw new Error("No open position found");
        }

        // Place closing order
        const order = {
            clientOrderId: Date.now().toString(),
            marketCode: marketCode,
            side: parseFloat(position.position) > 0 ? "SELL" : "BUY",
            quantity: Math.abs(parseFloat(position.position)).toString(),
            orderType: "MARKET",
            timeInForce: "IOC",
        };

        return this.provider.makeRequest("POST", "/v3/orders/place", {
            recvWindow: 20000,
            timestamp: Date.now(),
            responseType: "FULL",
            orders: [order],
        });
    }

    async modifyPosition(marketCode: string, newQuantity: string) {
        const positions = await this.provider.getPositions(marketCode);
        const position = positions?.data?.[0]?.positions?.find(
            (p: any) => p.marketCode === marketCode
        );

        if (!position) {
            throw new Error("No position found to modify");
        }

        const currentSize = parseFloat(position.position);
        const targetSize = parseFloat(newQuantity);
        const sizeDiff = targetSize - currentSize;

        if (sizeDiff === 0) return null;

        const order = {
            clientOrderId: Date.now().toString(),
            marketCode: marketCode,
            side: sizeDiff > 0 ? "BUY" : "SELL",
            quantity: Math.abs(sizeDiff).toString(),
            orderType: "MARKET",
            timeInForce: "IOC",
        };

        return this.provider.makeRequest("POST", "/v3/orders/place", {
            recvWindow: 20000,
            timestamp: Date.now(),
            responseType: "FULL",
            orders: [order],
        });
    }
}

export const oxActions = {
    execute: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const config = {
                apiKey: runtime.getSetting("OX_API_KEY"),
                apiSecret: runtime.getSetting("OX_API_SECRET"),
                isTestnet: runtime.getSetting("OX_TESTNET") === "true",
            };

            const provider = new OxProvider(config);
            const actions = new OxActions(provider);
            const command = message.get("command");

            switch (command) {
                case "openPosition": {
                    const params = message.get("params") as OxPositionParams;
                    return JSON.stringify(await actions.openPosition(params));
                }

                case "closePosition": {
                    const marketCode = message.get("marketCode");
                    return JSON.stringify(
                        await actions.closePosition(marketCode)
                    );
                }

                case "modifyPosition": {
                    const marketCode = message.get("marketCode");
                    const newQuantity = message.get("newQuantity");
                    return JSON.stringify(
                        await actions.modifyPosition(marketCode, newQuantity)
                    );
                }

                default:
                    return "Unknown command";
            }
        } catch (error) {
            console.error("Error executing Ox action:", error);
            return JSON.stringify({
                success: false,
                error: error.message,
            });
        }
    },
};
