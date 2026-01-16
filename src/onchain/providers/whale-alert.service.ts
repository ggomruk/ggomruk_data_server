import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * 🐋 Whale Alert Service
 *
 * @description Fetches large cryptocurrency transactions from Whale Alert API.
 *
 * @api https://whale-alert.io/
 * @rateLimit Free tier: 10 requests/min
 * @features
 * - Real-time whale transaction monitoring
 * - Exchange deposit/withdrawal detection
 * - Multi-blockchain support (BTC, ETH)
 *
 * @usage
 * Free API provides delayed data (10 min delay).
 * For real-time, websocket upgrade needed (paid tier).
 */
export interface WhaleAlertTransaction {
  blockchain: string;
  symbol: string;
  id: string;
  transaction_type: string;
  hash: string;
  from: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  to: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  timestamp: number;
  amount: number;
  amount_usd: number;
  transaction_count?: number;
}

export interface WhaleAlertResponse {
  result: string;
  cursor?: string;
  count: number;
  transactions: WhaleAlertTransaction[];
}

@Injectable()
export class WhaleAlertService implements OnModuleInit {
  private readonly logger = new Logger(WhaleAlertService.name);
  private client: AxiosInstance | null = null;
  private apiKey: string | undefined;
  private lastFetchTime = 0;
  private readonly MIN_INTERVAL_MS = 6000; // 10 req/min = 1 req per 6 seconds
  private readonly BASE_URL = 'https://api.whale-alert.io/v1';

  // Minimum USD threshold for tracking (to stay within rate limits)
  private readonly MIN_USD_THRESHOLD = 500000; 

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.apiKey = this.configService.get<string>('WHALE_ALERT_API_KEY');

    if (!this.apiKey) {
      this.logger.warn(
        '⚠️ WHALE_ALERT_API_KEY not configured - whale tracking disabled',
      );
      return;
    }

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'X-WA-API-KEY': this.apiKey,
      },
    });

    this.logger.log('🐋 Whale Alert service initialized');
  }

  /**
   * Check if service is configured
   */
  isEnabled(): boolean {
    return !!this.client;
  }

  /**
   * Fetch recent whale transactions
   *
   * @param startTime Unix timestamp to start from
   * @param endTime Unix timestamp to end at (optional)
   * @param minValue Minimum USD value threshold
   * @param cursor Pagination cursor from previous response
   */
  async getTransactions(
    startTime: number,
    endTime?: number,
    minValue: number = this.MIN_USD_THRESHOLD,
    cursor?: string,
  ): Promise<WhaleAlertResponse | null> {
    if (!this.client) {
      this.logger.warn('Whale Alert service not configured');
      return null;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLast = now - this.lastFetchTime;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      const waitTime = this.MIN_INTERVAL_MS - timeSinceLast;
      await this.sleep(waitTime);
    }

    try {
      const params: Record<string, any> = {
        start: startTime,
        min_value: minValue,
      };

      if (endTime) {
        params.end = endTime;
      }

      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.client.get<WhaleAlertResponse>(
        '/transactions',
        { params },
      );

      this.lastFetchTime = Date.now();

      if (response.data.result === 'success') {
        this.logger.debug(
          `📡 Fetched ${response.data.count} whale transactions`,
        );
        return response.data;
      }

      this.logger.warn(`Whale Alert API error: ${response.data.result}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.logger.warn('Rate limited by Whale Alert API, backing off...');
          await this.sleep(60000); // Wait 1 minute on rate limit
        } else {
          this.logger.error(
            `Whale Alert API error: ${error.response?.status} - ${error.message}`,
          );
        }
      } else {
        this.logger.error(`Whale Alert request failed: ${error}`);
      }
      return null;
    }
  }

  /**
   * Fetch transactions for Binance exchange only
   *
   * @description Filters transactions involving Binance wallets
   * Uses owner field from Whale Alert which has exchange labels
   */
  async getBinanceTransactions(
    startTime: number,
    endTime?: number,
    minValue: number = this.MIN_USD_THRESHOLD,
  ): Promise<WhaleAlertTransaction[]> {
    const response = await this.getTransactions(startTime, endTime, minValue);

    if (!response?.transactions) {
      return [];
    }

    // Filter for Binance-related transactions
    return response.transactions.filter(
      (tx) =>
        tx.from.owner?.toLowerCase().includes('binance') ||
        tx.to.owner?.toLowerCase().includes('binance'),
    );
  }

  /**
   * Get transaction status check (for API health check)
   */
  async getStatus(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Fetch last 10 minutes of data as a health check
      const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
      const response = await this.getTransactions(tenMinutesAgo);
      return response?.result === 'success';
    } catch {
      return false;
    }
  }

  /**
   * Parse transaction direction relative to exchange
   */
  parseDirection(tx: WhaleAlertTransaction): {
    direction: 'to_exchange' | 'from_exchange' | 'between_exchanges' | 'unknown';
    exchangeName?: string;
  } {
    const fromIsExchange = tx.from.owner_type === 'exchange';
    const toIsExchange = tx.to.owner_type === 'exchange';

    if (fromIsExchange && toIsExchange) {
      return {
        direction: 'between_exchanges',
        exchangeName: tx.to.owner,
      };
    }

    if (toIsExchange) {
      return {
        direction: 'to_exchange',
        exchangeName: tx.to.owner,
      };
    }

    if (fromIsExchange) {
      return {
        direction: 'from_exchange',
        exchangeName: tx.from.owner,
      };
    }

    return { direction: 'unknown' };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
