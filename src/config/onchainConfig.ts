import { registerAs } from '@nestjs/config';

/**
 * 🐋 On-Chain API Configuration
 *
 * @description Configuration for external on-chain data APIs.
 * All API keys are optional - services degrade gracefully without them.
 *
 * @env
 * - WHALE_ALERT_API_KEY: Free tier: 10 req/min, $9/mo for basic
 * - ETHERSCAN_API_KEY: Free tier: 5 calls/sec
 * - BLOCKCHAIR_API_KEY: Free tier: 1440 req/day (optional, works without key)
 */
export default registerAs('onchain', () => ({
  // Whale Alert - Real-time large transaction monitoring
  // https://whale-alert.io/
  whaleAlertApiKey: process.env.WHALE_ALERT_API_KEY || '',

  // Etherscan - Ethereum blockchain explorer
  // https://etherscan.io/apis
  etherscanApiKey: process.env.ETHERSCAN_API_KEY || '',

  // Blockchair - Bitcoin blockchain explorer
  // https://blockchair.com/api
  blockchairApiKey: process.env.BLOCKCHAIR_API_KEY || '',

  // Minimum USD threshold for tracking transactions
  // Higher threshold = fewer transactions = stays within rate limits
  minTransactionUsd: parseInt(process.env.MIN_TRANSACTION_USD || '500000', 10),

  // Data retention periods (in days)
  freeRetentionDays: parseInt(process.env.FREE_RETENTION_DAYS || '7', 10),
  premiumRetentionDays: parseInt(process.env.PREMIUM_RETENTION_DAYS || '90', 10),
}));
