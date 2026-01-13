import { registerAs } from "@nestjs/config";
export interface IExchangeConfig {
    name: string;
    wsUrl: string;
    baseUrl: string;
    apiKey?: string;
    secretKey?: string;
}

export type ExchangeConfigList = IExchangeConfig[];

export default registerAs<IExchangeConfig>('exchange', () => ({
    name: 'binance',
    wsUrl: 'wss://stream.binance.com:9443/ws',
    baseUrl: 'https://api.binance.com',
    apiKey: process.env.BINANCE_API_KEY,
    secretKey: process.env.BINANCE_SECRET_KEY,
}));