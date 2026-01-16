import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * ₿ Blockchair Service
 *
 * @description Fetches Bitcoin wallet and transaction data from Blockchair API.
 *
 * @api https://blockchair.com/api/docs
 * @rateLimit Free tier: 1440 requests/day (1 per minute avg)
 * @features
 * - BTC balance lookup
 * - Transaction history
 * - Address statistics
 * - Multi-address batch queries
 */

export interface BlockchairAddress {
  address: {
    type: string;
    script_hex: string;
    balance: number;
    balance_usd: number;
    received: number;
    received_usd: number;
    spent: number;
    spent_usd: number;
    output_count: number;
    unspent_output_count: number;
    first_seen_receiving: string;
    last_seen_receiving: string;
    first_seen_spending: string;
    last_seen_spending: string;
    scripthash_type: string | null;
    transaction_count: number;
  };
  transactions: string[];
  utxo: {
    block_id: number;
    transaction_hash: string;
    index: number;
    value: number;
  }[];
}

export interface BlockchairTransaction {
  block_id: number;
  id: number;
  hash: string;
  date: string;
  time: string;
  size: number;
  weight: number;
  version: number;
  lock_time: number;
  is_coinbase: boolean;
  has_witness: boolean;
  input_count: number;
  output_count: number;
  input_total: number;
  input_total_usd: number;
  output_total: number;
  output_total_usd: number;
  fee: number;
  fee_usd: number;
  fee_per_kb: number;
  fee_per_kb_usd: number;
  fee_per_kwu: number;
  fee_per_kwu_usd: number;
  cdd_total: number;
}

@Injectable()
export class BlockchairService implements OnModuleInit {
  private readonly logger = new Logger(BlockchairService.name);
  private client: AxiosInstance | null = null;
  private apiKey: string | undefined;
  private lastCallTime = 0;
  private callCount = 0;
  private callCountResetTime = 0;
  private readonly MAX_DAILY_CALLS = 1440;
  private readonly MIN_INTERVAL_MS = 60000; // 1 call per minute to stay safe
  private readonly BASE_URL = 'https://api.blockchair.com/bitcoin';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.apiKey = this.configService.get<string>('BLOCKCHAIR_API_KEY');
    this.callCountResetTime = Date.now() + 24 * 60 * 60 * 1000;

    // API key is optional for Blockchair (just higher limits)
    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
    });

    if (this.apiKey) {
      this.logger.log('₿ Blockchair service initialized with API key');
    } else {
      this.logger.warn(
        '⚠️ BLOCKCHAIR_API_KEY not configured - using free tier limits',
      );
    }
  }

  /**
   * Check if service is configured
   */
  isEnabled(): boolean {
    return !!this.client;
  }

  /**
   * Rate limit enforcement with daily quota tracking
   */
  private async enforceRateLimit(): Promise<boolean> {
    const now = Date.now();

    // Reset daily counter if needed
    if (now > this.callCountResetTime) {
      this.callCount = 0;
      this.callCountResetTime = now + 24 * 60 * 60 * 1000;
    }

    // Check daily limit
    if (this.callCount >= this.MAX_DAILY_CALLS) {
      this.logger.warn('Blockchair daily limit reached');
      return false;
    }

    // Enforce minimum interval
    const timeSinceLast = now - this.lastCallTime;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await this.sleep(this.MIN_INTERVAL_MS - timeSinceLast);
    }

    this.lastCallTime = Date.now();
    this.callCount++;
    return true;
  }

  /**
   * Get BTC address data
   *
   * @param address Bitcoin address
   * @returns Address data with balance and transaction info
   */
  async getAddressData(address: string): Promise<BlockchairAddress | null> {
    if (!this.client) return null;

    const canProceed = await this.enforceRateLimit();
    if (!canProceed) return null;

    try {
      const url = `/dashboards/address/${address}`;
      const params: Record<string, string> = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await this.client.get(url, { params });

      if (response.data.data?.[address]) {
        return response.data.data[address];
      }

      this.logger.warn(`Blockchair address not found: ${address}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.logger.warn('Rate limited by Blockchair API');
        } else {
          this.logger.error(
            `Blockchair API error: ${error.response?.status} - ${error.message}`,
          );
        }
      } else {
        this.logger.error(`Blockchair request failed: ${error}`);
      }
      return null;
    }
  }

  /**
   * Get multiple BTC addresses in one call (saves quota)
   *
   * @param addresses Array of Bitcoin addresses
   * @returns Map of address -> data
   */
  async getMultiAddressData(
    addresses: string[],
  ): Promise<Record<string, BlockchairAddress> | null> {
    if (!this.client) return null;
    if (addresses.length === 0) return {};

    const canProceed = await this.enforceRateLimit();
    if (!canProceed) return null;

    try {
      // Blockchair supports comma-separated addresses
      const addressList = addresses.slice(0, 10).join(','); // Max 10 per request
      const url = `/dashboards/addresses/${addressList}`;
      const params: Record<string, string> = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await this.client.get(url, { params });

      if (response.data.data?.addresses) {
        return response.data.data.addresses;
      }

      return null;
    } catch (error) {
      this.logger.error(`Blockchair multi-address request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get transaction details
   *
   * @param txHash Transaction hash
   */
  async getTransaction(
    txHash: string,
  ): Promise<BlockchairTransaction | null> {
    if (!this.client) return null;

    const canProceed = await this.enforceRateLimit();
    if (!canProceed) return null;

    try {
      const url = `/dashboards/transaction/${txHash}`;
      const params: Record<string, string> = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await this.client.get(url, { params });

      if (response.data.data?.[txHash]?.transaction) {
        return response.data.data[txHash].transaction;
      }

      return null;
    } catch (error) {
      this.logger.error(`Blockchair transaction request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get current BTC price in USD
   */
  async getBtcPrice(): Promise<number | null> {
    if (!this.client) return null;

    const canProceed = await this.enforceRateLimit();
    if (!canProceed) return null;

    try {
      const params: Record<string, string> = {};
      if (this.apiKey) {
        params.key = this.apiKey;
      }

      const response = await this.client.get('/stats', { params });

      if (response.data.data?.market_price_usd) {
        return response.data.data.market_price_usd;
      }

      return null;
    } catch (error) {
      this.logger.error(`Blockchair stats request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get remaining API calls for today
   */
  getRemainingCalls(): number {
    return Math.max(0, this.MAX_DAILY_CALLS - this.callCount);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
