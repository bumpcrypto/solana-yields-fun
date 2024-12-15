import { Connection } from "@solana/web3.js";
import axios from "axios";
import crypto from "crypto";

export interface OxConfig {
    apiKey: string;
    apiSecret: string;
    isTestnet?: boolean;
}

export class OxProvider {
    private baseUrl: string;
    private apiKey: string;
    private apiSecret: string;

    constructor(config: OxConfig) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.baseUrl = config.isTestnet
            ? "https://stgapi.ox.fun"
            : "https://api.ox.fun";
    }

    private generateSignature(
        timestamp: string,
        nonce: string,
        verb: string,
        path: string,
        body: string = ""
    ): string {
        const message = `${timestamp}\n${nonce}\n${verb}\n${this.baseUrl.replace("https://", "")}\n${path}\n${body}`;
        return crypto
            .createHmac("sha256", this.apiSecret)
            .update(message)
            .digest("base64");
    }

    private async makeRequest(method: string, endpoint: string, data?: any) {
        const timestamp = new Date().toISOString();
        const nonce = Date.now().toString();
        const signature = this.generateSignature(
            timestamp,
            nonce,
            method,
            endpoint,
            data ? JSON.stringify(data) : ""
        );

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${endpoint}`,
                data,
                headers: {
                    "Content-Type": "application/json",
                    AccessKey: this.apiKey,
                    Timestamp: timestamp,
                    Signature: signature,
                    Nonce: nonce,
                },
            });

            return response.data;
        } catch (error) {
            console.error("OX API request failed:", error);
            throw error;
        }
    }

    // Market Data Methods
    async getMarketInfo(marketCode: string) {
        return this.makeRequest("GET", `/v3/markets?marketCode=${marketCode}`);
    }

    async getTicker(marketCode: string) {
        return this.makeRequest("GET", `/v3/tickers?marketCode=${marketCode}`);
    }

    async getLeverageTiers(marketCode: string) {
        return this.makeRequest(
            "GET",
            `/v3/leverage/tiers?marketCode=${marketCode}`
        );
    }

    // Account Methods
    async getAccountInfo() {
        return this.makeRequest("GET", "/v3/account");
    }

    async getPositions(marketCode?: string) {
        const endpoint = marketCode
            ? `/v3/positions?marketCode=${marketCode}`
            : "/v3/positions";
        return this.makeRequest("GET", endpoint);
    }

    async getFundingRates(marketCode: string) {
        return this.makeRequest(
            "GET",
            `/v3/funding/rates?marketCode=${marketCode}`
        );
    }

    // Risk Management Methods
    async getMaxLeverage(
        marketCode: string,
        positionSize: string
    ): Promise<number> {
        const tiers = await this.getLeverageTiers(marketCode);
        // Default to conservative leverage if tiers not found
        if (!tiers?.data?.[0]?.tiers) return 3;

        const positionSizeNum = parseFloat(positionSize);
        const applicableTier = tiers.data[0].tiers.find(
            (tier: any) =>
                positionSizeNum >= parseFloat(tier.positionFloor) &&
                positionSizeNum <= parseFloat(tier.positionCap)
        );

        return applicableTier ? parseFloat(applicableTier.leverage) : 3;
    }

    async validatePosition(
        marketCode: string,
        size: string,
        leverage: number
    ): Promise<boolean> {
        const accountInfo = await this.getAccountInfo();
        const positions = await this.getPositions(marketCode);

        // Basic position validation
        if (!accountInfo?.data?.[0]?.collateral) return false;

        const collateral = parseFloat(accountInfo.data[0].collateral);
        const positionSize = parseFloat(size);
        const maxLeverage = await this.getMaxLeverage(marketCode, size);

        return (
            leverage <= maxLeverage &&
            positionSize * leverage <= collateral * maxLeverage
        );
    }
}
