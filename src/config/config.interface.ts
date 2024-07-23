export interface databaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

export interface MarketConfig {
  name: string;
  wsUrl: string;
  baseUrl: string;
  apiKey: string;
  secretKey: string;
}

export type IConfig = {
  database: databaseConfig;
  exchanges: MarketConfiglist;
};

export type MarketConfiglist = MarketConfig[];
