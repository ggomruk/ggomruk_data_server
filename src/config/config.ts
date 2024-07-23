export default () => ({
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    username: process.env.DB_USERNAME ?? '',
    passwrod: process.env.DB_PASSWORD ?? '',
    port: process.env.DB_PORT ?? 27017,
    name: process.env.DB_NAME,
  },
  exchanges: [
    {
      name: 'binance',
      wsUrl: 'wss://stream.binance.com:9443/ws/btcusdt',
      baseUrl: 'https://api.binance.com',
      apiKey: process.env.BINANCE_API_KEY,
      secretKey: process.env.BINANCE_SECRET_KEY,
    },
  ],
});
