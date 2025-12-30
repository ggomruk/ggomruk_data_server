export default () => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    port: parseInt(process.env.DB_PORT, 10) ?? 27017,
    name: process.env.DB_NAME ?? 'ggomruk',
  },
  exchanges: [
    {
      name: 'binance',
      wsUrl: 'wss://stream.binance.com:9443/ws',
      baseUrl: 'https://api.binance.com',
      apiKey: process.env.BINANCE_API_KEY,
      secretKey: process.env.BINANCE_SECRET_KEY,
    },
  ],
});
