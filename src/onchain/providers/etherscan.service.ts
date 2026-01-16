import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * 🔷 Etherscan Service
 *
 * @description Fetches Ethereum wallet and transaction data from Etherscan API.
 *
 * @api https://etherscan.io/apis
 * @rateLimit Free tier: 5 calls/second
 * @features
 * - ETH balance lookup
 * - ERC-20 token transfers
 * - Transaction history
 * - Internal transactions
 */

export interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  contractAddress: string;
}

export interface EtherscanBalance {
  account: string;
  balance: string;
}

@Injectable()
export class EtherscanService implements OnModuleInit {
  private readonly logger = new Logger(EtherscanService.name);
  private client: AxiosInstance | null = null;
  private apiKey: string | undefined;
  private lastCallTime = 0;
  private readonly MIN_INTERVAL_MS = 200; // 5 calls/sec = 200ms between calls
  private readonly BASE_URL = 'https://api.etherscan.io/api';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.apiKey = this.configService.get<string>('ETHERSCAN_API_KEY');

    if (!this.apiKey) {
      this.logger.warn(
        '⚠️ ETHERSCAN_API_KEY not configured - ETH wallet tracking limited',
      );
      return;
    }

    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
    });

    this.logger.log('🔷 Etherscan service initialized');
  }

  /**
   * Check if service is configured
   */
  isEnabled(): boolean {
    return !!this.client;
  }

  /**
   * Rate limit enforcement
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastCallTime;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await this.sleep(this.MIN_INTERVAL_MS - timeSinceLast);
    }
    this.lastCallTime = Date.now();
  }

  /**
   * Get ETH balance for an address
   *
   * @param address Ethereum address
   * @returns Balance in ETH
   */
  async getBalance(address: string): Promise<number | null> {
    if (!this.client) return null;

    await this.enforceRateLimit();

    try {
      const response = await this.client.get('', {
        params: {
          module: 'account',
          action: 'balance',
          address,
          tag: 'latest',
          apikey: this.apiKey,
        },
      });

      if (response.data.status === '1') {
        // Convert from Wei to ETH
        return parseFloat(response.data.result) / 1e18;
      }

      this.logger.warn(`Etherscan balance error: ${response.data.message}`);
      return null;
    } catch (error) {
      this.logger.error(`Etherscan balance request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get multiple ETH balances in one call
   *
   * @param addresses Array of Ethereum addresses (max 20)
   * @returns Array of balances
   */
  async getMultiBalance(
    addresses: string[],
  ): Promise<EtherscanBalance[] | null> {
    if (!this.client) return null;
    if (addresses.length > 20) {
      this.logger.warn('Etherscan multi-balance limited to 20 addresses');
      addresses = addresses.slice(0, 20);
    }

    await this.enforceRateLimit();

    try {
      const response = await this.client.get('', {
        params: {
          module: 'account',
          action: 'balancemulti',
          address: addresses.join(','),
          tag: 'latest',
          apikey: this.apiKey,
        },
      });

      if (response.data.status === '1') {
        return response.data.result.map((item: any) => ({
          account: item.account,
          balance: parseFloat(item.balance) / 1e18,
        }));
      }

      return null;
    } catch (error) {
      this.logger.error(`Etherscan multi-balance request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get normal transactions for an address
   *
   * @param address Ethereum address
   * @param startBlock Starting block number
   * @param endBlock Ending block number
   * @param page Page number
   * @param offset Results per page (max 10000)
   */
  async getTransactions(
    address: string,
    startBlock = 0,
    endBlock = 99999999,
    page = 1,
    offset = 100,
  ): Promise<EtherscanTransaction[] | null> {
    if (!this.client) return null;

    await this.enforceRateLimit();

    try {
      const response = await this.client.get('', {
        params: {
          module: 'account',
          action: 'txlist',
          address,
          startblock: startBlock,
          endblock: endBlock,
          page,
          offset,
          sort: 'desc',
          apikey: this.apiKey,
        },
      });

      if (response.data.status === '1') {
        return response.data.result;
      }

      // "No transactions found" is not an error
      if (response.data.message === 'No transactions found') {
        return [];
      }

      this.logger.warn(`Etherscan txlist error: ${response.data.message}`);
      return null;
    } catch (error) {
      this.logger.error(`Etherscan txlist request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get internal transactions (contract calls with ETH transfers)
   */
  async getInternalTransactions(
    address: string,
    startBlock = 0,
    endBlock = 99999999,
    page = 1,
    offset = 100,
  ): Promise<any[] | null> {
    if (!this.client) return null;

    await this.enforceRateLimit();

    try {
      const response = await this.client.get('', {
        params: {
          module: 'account',
          action: 'txlistinternal',
          address,
          startblock: startBlock,
          endblock: endBlock,
          page,
          offset,
          sort: 'desc',
          apikey: this.apiKey,
        },
      });

      if (response.data.status === '1') {
        return response.data.result;
      }

      if (response.data.message === 'No transactions found') {
        return [];
      }

      return null;
    } catch (error) {
      this.logger.error(`Etherscan internal txlist request failed: ${error}`);
      return null;
    }
  }

  /**
   * Get current ETH price in USD
   */
  async getEthPrice(): Promise<number | null> {
    if (!this.client) return null;

    await this.enforceRateLimit();

    try {
      const response = await this.client.get('', {
        params: {
          module: 'stats',
          action: 'ethprice',
          apikey: this.apiKey,
        },
      });

      if (response.data.status === '1') {
        return parseFloat(response.data.result.ethusd);
      }

      return null;
    } catch (error) {
      this.logger.error(`Etherscan ethprice request failed: ${error}`);
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
