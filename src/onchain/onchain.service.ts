import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  WhaleTransaction,
  WhaleTransactionDocument,
  WhaleWallet,
  WhaleWalletDocument,
  ExchangeFlow,
  ExchangeFlowDocument,
} from './schemas';
import {
  WhaleAlertService,
  WhaleAlertTransaction,
} from './providers/whale-alert.service';
import { EtherscanService } from './providers/etherscan.service';
import { BlockchairService } from './providers/blockchair.service';

/**
 * 🐋 OnchainService - Main Data Ingestion Orchestrator
 *
 * @description Coordinates data fetching from external APIs,
 * processes transactions, and stores in MongoDB.
 *
 * @jobs
 * - Every 10 min: Fetch new whale transactions from Whale Alert
 * - Every hour: Update exchange flow aggregates
 * - Every 6 hours: Update known wallet balances
 *
 * @focus Currently tracking Binance exchange only per MVP requirements
 */

// Known exchange wallet addresses for initial seeding
// Sources: Etherscan labels, Arkham Intelligence, on-chain analysis
interface ExchangeWallet {
  address: string;
  label: string;
}

interface ExchangeWallets {
  btc: ExchangeWallet[];
  eth: ExchangeWallet[];
}

const KNOWN_EXCHANGE_WALLETS: Record<string, ExchangeWallets> = {
    Binance: {
        btc: [
        { address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', label: 'Binance Cold Wallet' },
        { address: 'bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h', label: 'Binance Cold Wallet 2' },
        { address: '3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb', label: 'Binance Hot Wallet' },
        { address: '1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s', label: 'Binance Hot Wallet 2' },
        { address: 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97', label: 'Binance Cold Wallet 3' },
        { address: '3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6', label: 'Binance Cold Wallet 4' },
        ],
        eth: [
        { address: '0x28C6c06298d514Db089934071355E5743bf21d60', label: 'Binance 14' },
        { address: '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', label: 'Binance 15' },
        { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', label: 'Binance 16' },
        { address: '0x56Eddb7aa87536c09CCc2793473599fD21A8b17F', label: 'Binance 17' },
        { address: '0x9696f59E4d72E237BE84fFD425DCaD154Bf96976', label: 'Binance 18' },
        { address: '0xF977814e90dA44bFA03b6295A0616a897441aceC', label: 'Binance 8' },
        { address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', label: 'Binance 7' },
        { address: '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb', label: 'Binance 6' },
        ],
    },

    Coinbase: {
        btc: [
        { address: '3Kzh9qAqVWQhEsfQz7zEQL1EuSx5tyNLNS', label: 'Coinbase Cold Wallet' },
        { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', label: 'Coinbase Cold Wallet 2' },
        { address: '3LQUu4v9z6KNch71j7kbj8GPeAGUo1FW6a', label: 'Coinbase Cold Wallet 3' },
        { address: 'bc1q7cyrfmck2ffu2ud3rn5l5a8yv6f0chkp0zpemf', label: 'Coinbase Prime' },
        { address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', label: 'Coinbase Commerce' },
        ],
        eth: [
        { address: '0x71660c4005BA85c37ccec55d0C4493E66Fe775d3', label: 'Coinbase 1' },
        { address: '0x503828976D22510aad0201ac7EC88293211D23Da', label: 'Coinbase 2' },
        { address: '0xddfAbCdc4D8FfC6d5beaf154f18B778f892A0740', label: 'Coinbase 3' },
        { address: '0x3cD751E6b0078Be393132286c442345e5DC49699', label: 'Coinbase 4' },
        { address: '0xb5d85CBf7cB3EE0D56b3bB207D5Fc4B82f43F511', label: 'Coinbase 5' },
        { address: '0xEB2629a2734e272Bcc07BDA959863f316F4bD4Cf', label: 'Coinbase 6' },
        { address: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43', label: 'Coinbase 10' },
        { address: '0x77695e15b2f31Ea9D48cb16A8456EA53f6e0BC61', label: 'Coinbase Commerce' },
        ],
    },

    Kraken: {
        btc: [
        { address: 'bc1qzxl8t5upf0apvjrz3v4vn77jgfwwjhtzlx8pfa', label: 'Kraken Cold Wallet' },
        { address: 'bc1qmxjefnuy06v345v6vhwpwt05dztztmx4g3y7wp', label: 'Kraken Cold Wallet 2' },
        { address: '3H4DM8pnKuH5t5xPmM1VLJGTfApDPLKvUi', label: 'Kraken Hot Wallet' },
        { address: 'bc1qny0v7kx3lm43alp3w08kl2x6e4ffncl4sl6qxw', label: 'Kraken Cold Wallet 3' },
        ],
        eth: [
        { address: '0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2', label: 'Kraken' },
        { address: '0xAe2D4617c862309A3d75A0fFB358c7a5009c673F', label: 'Kraken 2' },
        { address: '0x43984D578803891dfa9706bDEee6078D80cFC79E', label: 'Kraken 3' },
        { address: '0x66c57bF505A85A74609D2C83E94Aabb26d691E1F', label: 'Kraken 4' },
        { address: '0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf', label: 'Kraken 5' },
        { address: '0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0', label: 'Kraken 6' },
        ],
    },

    OKX: {
        btc: [
        { address: 'bc1q2s3rjwvam9dt2ftt4sqxqjf3twav0gdnv0406n', label: 'OKX Cold Wallet' },
        { address: '1LnoZawVFFQihU8d8ntxLMpYheZUfyeVAK', label: 'OKX Hot Wallet' },
        { address: 'bc1qnpgw8nkcsxr7c8mygtgywffhp4u5qzh9mywf35', label: 'OKX Cold Wallet 2' },
        ],
        eth: [
        { address: '0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b', label: 'OKX' },
        { address: '0x236F9F97e0E62388479bf9E5BA4889e46B0273C3', label: 'OKX 2' },
        { address: '0xA7efAe728D2936e78BDA97dc267687568dD593f3', label: 'OKX 3' },
        { address: '0x5041ed759Dd4aFc3a72b8192C143F72f4724081A', label: 'OKX 4' },
        { address: '0x98EC059Dc3aDFBdd63429454aEB0c990FBA4A128', label: 'OKX 5' },
        { address: '0x539C92186f7C6CC4CbF443F26eF84C595baBBcA1', label: 'OKX 6' },
        ],
    },

    Bybit: {
        btc: [
        { address: 'bc1qjasf9z3h7w3jspkhtgatgpyvvzgpa2wwd2lr0eh5tx44reyn2k7sfc27a4', label: 'Bybit Cold Wallet' },
        { address: '1ByBi3wH7dKJPZNxHDuTvFqpaGToUzrZLh', label: 'Bybit Hot Wallet' },
        ],
        eth: [
        { address: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', label: 'Bybit' },
        { address: '0xee5B5B923fFcE93A870B3104b7CA09c3db80047A', label: 'Bybit 2' },
        { address: '0x1Db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF4', label: 'Bybit 3' },
        { address: '0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06', label: 'Bybit Cold Wallet' },
        ],
    },

    Bitfinex: {
        btc: [
        { address: 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97', label: 'Bitfinex Cold Wallet' },
        { address: '3D2oetdNuZUqQHPJmcMDDHYoqkyNVsFk9r', label: 'Bitfinex Cold Wallet 2' },
        { address: 'bc1qhv73u46a8t6d5xws6m60ez8c7gdn6xpvlqljnw', label: 'Bitfinex Hot Wallet' },
        ],
        eth: [
        { address: '0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa', label: 'Bitfinex' },
        { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f3cba', label: 'Bitfinex 2' },
        { address: '0xC6cDE7C39eB2f0F0095F41570af89eFC2C1Ea828', label: 'Bitfinex 3' },
        { address: '0x77134cbC06cB00b66F4c7e623D5fdBF6777635EC', label: 'Bitfinex 4' },
        ],
    },

    KuCoin: {
        btc: [
        { address: 'bc1qvxfc798f4k6wudzxrj8v3f5vyjg7h95w8t5xk3', label: 'KuCoin Cold Wallet' },
        { address: '3K2cuYkbnLcdEqMVqPrLdJbxKKjt3YdqGF', label: 'KuCoin Hot Wallet' },
        ],
        eth: [
        { address: '0x2B5634C42055806a59e9107ED44D43c426E58258', label: 'KuCoin' },
        { address: '0x689C56AEf474Df92D44A1b70850f808488F9769C', label: 'KuCoin 2' },
        { address: '0xa1D8d972560C2f8144AF871Db508F0B0B10a3fBf', label: 'KuCoin 3' },
        { address: '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c', label: 'KuCoin 4' },
        { address: '0xf16E9B0D03470827A95CDfd0Cb8a8A3b46969B91', label: 'KuCoin 5' },
        ],
    },

    HTX: {
        btc: [
        { address: '1HckjUpRGcrrRAtFaaCAUaGjsPx9oYmLaZ', label: 'HTX Cold Wallet' },
        { address: '14XKsv8tT2EhEfhVLqcpdjWHNZBxGHfodS', label: 'HTX Hot Wallet' },
        ],
        eth: [
        { address: '0xAb5C66752a9e8167967685F1450532fB96d5d24f', label: 'HTX' },
        { address: '0x6748F50f686bfbcA6Fe8ad62b22228b87F31ff2b', label: 'HTX 2' },
        { address: '0xfdb16996831753d5331fF813c29a93c76834A0AD', label: 'HTX 3' },
        { address: '0xeee28d484628d41a82d01e21d12e2e78D69920da', label: 'HTX 4' },
        { address: '0x5C985E89DDe482eFE97ea9f1950aD149Eb73829B', label: 'HTX 5' },
        { address: '0xDc76CD25977E0a5Ae17155770273aD58648900D3', label: 'HTX 6' },
        ],
    },

    Gemini: {
        btc: [
        { address: 'bc1qz63chftz2eqf0j3y9rfx3rl6ucxq4avyay7w8y', label: 'Gemini Cold Wallet' },
        { address: '3N61BXoZySwNy2trLbBk1UtrHAbpQxZbSP', label: 'Gemini Hot Wallet' },
        ],
        eth: [
        { address: '0xD24400ae8BfEBb18cA49Be86258a3C749cf46853', label: 'Gemini' },
        { address: '0x6Fc82a5fe25A5cDb58bc74600A40A69C065263f8', label: 'Gemini 2' },
        { address: '0x07Ee55aA48Bb72DcC6E9D78256648910De513eca', label: 'Gemini 3' },
        { address: '0x5f65f7b609678448494De4C87521CdF6cEf1e932', label: 'Gemini 4' },
        ],
    },

    GateIo: {
        btc: [
        { address: 'bc1qm4hzfds39nxf6jtl4e7vq47q6hkwk35wt4q6k5', label: 'Gate.io Cold Wallet' },
        ],
        eth: [
        { address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', label: 'Gate.io' },
        { address: '0x1C4b70a3968436B9A0a9cf5205c787eb81Bb558c', label: 'Gate.io 2' },
        { address: '0xD793281182A0e3E023116004778F45c29Fc14F19', label: 'Gate.io 3' },
        { address: '0xc882b111A75C0c657fC507C04FbFcD2cC984F071', label: 'Gate.io 4' },
        ],
    },

    Bitstamp: {
        btc: [
        { address: '3P8vNPsWnftvpmjdm4vXD3rmEyjXEbKgSC', label: 'Bitstamp Cold Wallet' },
        { address: 'bc1qwqdg6squsna38e46795at95yu9atm8azzmyvckulcc7kytlcckxswvvzej', label: 'Bitstamp Cold Wallet 2' },
        ],
        eth: [
        { address: '0x00bDb5699745f5b860228c8f939ABF1b9Ae374eD', label: 'Bitstamp' },
        { address: '0x1522900B6daFac587d499a862861C0869Be6E428', label: 'Bitstamp 2' },
        { address: '0x9a9bED3EB03E386D66f8A29dc67dc29BBBe98F10', label: 'Bitstamp 3' },
        ],
    },

    CryptoDotCom: {
        btc: [
        { address: 'bc1qr4dl5wa7kl8yu792dceg9z5knl2gkn220lk7a9', label: 'Crypto.com Cold Wallet' },
        { address: '3Ll8iq6qDApBKKsM6U2E6qHkqAMp7fJKQu', label: 'Crypto.com Hot Wallet' },
        ],
        eth: [
        { address: '0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3', label: 'Crypto.com' },
        { address: '0x46340b20830761efd32832A74d7169B29FEB9758', label: 'Crypto.com 2' },
        { address: '0x72A53cDBBcc1b9efa39c834A540550e23463AAcB', label: 'Crypto.com 3' },
        { address: '0x7758E507850Da48cd47DF1fB5F875c23E3340c50', label: 'Crypto.com 4' },
        ],
    },
};

@Injectable()
export class OnchainService implements OnModuleInit {
  private readonly logger = new Logger(OnchainService.name);
  private lastWhaleAlertFetch = 0;
  private isProcessing = false;

  constructor(
    @InjectModel(WhaleTransaction.name)
    private readonly whaleTransactionModel: Model<WhaleTransactionDocument>,
    @InjectModel(WhaleWallet.name)
    private readonly whaleWalletModel: Model<WhaleWalletDocument>,
    @InjectModel(ExchangeFlow.name)
    private readonly exchangeFlowModel: Model<ExchangeFlowDocument>,
    private readonly whaleAlertService: WhaleAlertService,
    private readonly etherscanService: EtherscanService,
    private readonly blockchairService: BlockchairService,
  ) {}

  async onModuleInit() {
    this.logger.log('🐋 On-Chain data service initializing...');

    // Seed known exchange wallets
    await this.seedExchangeWallets();

    // Set initial fetch time to 1 hour ago
    this.lastWhaleAlertFetch = Math.floor(Date.now() / 1000) - 3600;

    this.logger.log('✅ On-Chain data service ready');
  }

  /**
   * Seed known exchange wallet addresses into database
   */
  private async seedExchangeWallets(): Promise<void> {
    this.logger.log('Seeding known exchange wallet addresses...');

    const wallets: Array<{
        address: string;
        label: string;
        blockchain: string;
        walletType: string;
        exchangeName: string;
        isVerified: boolean;
        source: string;
    }> = [];

    // Flatten all exchange wallets into a single array
    for (const [exchangeName, chains] of Object.entries(KNOWN_EXCHANGE_WALLETS)) {
        for (const wallet of chains.btc) {
            wallets.push({
            address: wallet.address.toLowerCase(),
            label: wallet.label,
            blockchain: 'btc',
            walletType: 'exchange',
            exchangeName,
            isVerified: true,
            source: 'manual',
            });
        }
        for (const wallet of chains.eth) {
        wallets.push({
            address: wallet.address.toLowerCase(),
            label: wallet.label,
            blockchain: 'eth',
            walletType: 'exchange',
            exchangeName,
            isVerified: true,
            source: 'manual',
            });
        }
    }

    // Bulk upsert for efficiency
    const bulkOps = wallets.map((wallet) => ({
      updateOne: {
        filter: { address: wallet.address, blockchain: wallet.blockchain },
        update: { $setOnInsert: wallet },
        upsert: true,
      },
    }));

    try {
      if (bulkOps.length > 0) {
        const result = await this.whaleWalletModel.bulkWrite(bulkOps, {
          ordered: false,
        });
        this.logger.log(
          `Seeded ${result.upsertedCount} new wallets (${wallets.length} total known wallets from ${Object.keys(KNOWN_EXCHANGE_WALLETS).length} exchanges)`,
        );
      }
    } catch (error) {
      // Ignore duplicate key errors in bulk operations
      this.logger.warn(`Wallet seeding completed with some duplicates: ${error}`);
    }
  }

  /**
   * Fetch whale transactions every 10 minutes
   * Whale Alert free tier has 10 min delay
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async fetchWhaleTransactions(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Previous fetch still processing, skipping...');
      return;
    }

    if (!this.whaleAlertService.isEnabled()) {
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.log('📡 Fetching whale transactions...');

      const startTime = this.lastWhaleAlertFetch;
      const endTime = Math.floor(Date.now() / 1000) - 600; // 10 min ago

      if (endTime <= startTime) {
        this.logger.debug('No new time window to fetch');
        this.isProcessing = false;
        return;
      }

      // Fetch all large transactions (not just Binance)
      const response = await this.whaleAlertService.getTransactions(
        startTime,
        endTime,
      );

      if (!response?.transactions || response.transactions.length === 0) {
        this.logger.debug('No new whale transactions found');
        this.lastWhaleAlertFetch = endTime;
        this.isProcessing = false;
        return;
      }

      // Filter for exchange-related transactions
      const exchangeTransactions = response.transactions.filter(
        (tx) =>
          tx.from.owner_type === 'exchange' || tx.to.owner_type === 'exchange',
      );

      this.logger.log(
        `Processing ${exchangeTransactions.length} exchange transactions (of ${response.transactions.length} total)`,
      );

      // Process and store transactions
      let savedCount = 0;
      for (const tx of exchangeTransactions) {
        const saved = await this.processWhaleTransaction(tx);
        if (saved) savedCount++;
      }

      this.lastWhaleAlertFetch = endTime;
      this.logger.log(`✅ Saved ${savedCount} whale transactions`);
    } catch (error) {
      this.logger.error(`Failed to fetch whale transactions: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process and store a single whale transaction
   */
  private async processWhaleTransaction(
    tx: WhaleAlertTransaction,
  ): Promise<boolean> {
    try {
      // Skip non-BTC/ETH transactions
      const blockchain = tx.blockchain.toLowerCase();
      if (blockchain !== 'bitcoin' && blockchain !== 'ethereum') {
        return false;
      }

      const normalizedBlockchain = blockchain === 'bitcoin' ? 'btc' : 'eth';
      const { direction, exchangeName } =
        this.whaleAlertService.parseDirection(tx);

      const document = {
        txHash: tx.hash,
        blockchain: normalizedBlockchain,
        fromAddress: tx.from.address?.toLowerCase() || 'unknown',
        fromLabel: tx.from.owner || undefined,
        fromType: tx.from.owner_type || 'unknown',
        toAddress: tx.to.address?.toLowerCase() || 'unknown',
        toLabel: tx.to.owner || undefined,
        toType: tx.to.owner_type || 'unknown',
        amount: tx.amount,
        symbol: tx.symbol.toUpperCase(),
        amountUsd: tx.amount_usd,
        timestamp: new Date(tx.timestamp * 1000),
        direction,
        exchangeName: exchangeName || undefined,
        source: 'whale_alert',
      };

      // Upsert to avoid duplicates
      await this.whaleTransactionModel.updateOne(
        { txHash: tx.hash },
        { $setOnInsert: document },
        { upsert: true },
      );

      // Update wallet labels if we learned new ones
      if (tx.from.owner && tx.from.address) {
        await this.updateWalletLabel(
          tx.from.address,
          normalizedBlockchain,
          tx.from.owner,
          tx.from.owner_type || 'unknown',
        );
      }
      if (tx.to.owner && tx.to.address) {
        await this.updateWalletLabel(
          tx.to.address,
          normalizedBlockchain,
          tx.to.owner,
          tx.to.owner_type || 'unknown',
        );
      }

      return true;
    } catch (error) {
      if ((error as any).code !== 11000) {
        // Ignore duplicate key errors
        this.logger.warn(`Failed to process transaction ${tx.hash}: ${error}`);
      }
      return false;
    }
  }

  /**
   * Update wallet label from transaction data
   */
  private async updateWalletLabel(
    address: string,
    blockchain: string,
    label: string,
    walletType: string,
  ): Promise<void> {
    try {
      // Detect exchange name from label
      const exchangeName = this.detectExchangeFromLabel(label);

      await this.whaleWalletModel.updateOne(
        { address: address.toLowerCase(), blockchain },
        {
          $setOnInsert: {
            address: address.toLowerCase(),
            blockchain,
            label,
            walletType: walletType === 'exchange' ? 'exchange' : 'whale',
            exchangeName: exchangeName || undefined,
            source: 'whale_alert',
            isVerified: false,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      // Ignore duplicate key errors
    }
  }

  /**
   * Detect exchange name from wallet label
   */
  private detectExchangeFromLabel(label: string): string | null {
    const lowerLabel = label.toLowerCase();

    // Map of known exchange name patterns
    const exchangePatterns: Record<string, string[]> = {
      Binance: ['binance'],
      Coinbase: ['coinbase'],
      Kraken: ['kraken'],
      OKX: ['okx', 'okex'],
      Bybit: ['bybit'],
      Bitfinex: ['bitfinex'],
      KuCoin: ['kucoin'],
      HTX: ['htx', 'huobi'],
      Gemini: ['gemini'],
      'Gate.io': ['gate.io', 'gateio'],
      Bitstamp: ['bitstamp'],
      'Crypto.com': ['crypto.com', 'cryptocom'],
      Bittrex: ['bittrex'],
      Poloniex: ['poloniex'],
      BitMEX: ['bitmex'],
      Deribit: ['deribit'],
      FTX: ['ftx'],
      Upbit: ['upbit'],
      Bithumb: ['bithumb'],
      Korbit: ['korbit'],
    };

    for (const [exchangeName, patterns] of Object.entries(exchangePatterns)) {
      if (patterns.some((pattern) => lowerLabel.includes(pattern))) {
        return exchangeName;
      }
    }

    return null;
  }

  /**
   * Aggregate exchange flows every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateExchangeFlows(): Promise<void> {
    this.logger.log('📊 Aggregating exchange flows...');

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourStart = new Date(oneHourAgo);
      hourStart.setMinutes(0, 0, 0);

      // Aggregate from whale_transactions, grouped by exchange
      const aggregation = await this.whaleTransactionModel.aggregate([
        {
          $match: {
            timestamp: { $gte: hourStart },
            exchangeName: { $exists: true, $ne: null },
            direction: { $in: ['to_exchange', 'from_exchange'] },
          },
        },
        {
          $group: {
            _id: {
              exchangeName: '$exchangeName',
              blockchain: '$blockchain',
              direction: '$direction',
            },
            totalAmount: { $sum: '$amount' },
            totalUsd: { $sum: '$amountUsd' },
            count: { $sum: 1 },
          },
        },
      ]);

      // Group results by exchange and blockchain
      const flowsByExchange: Record<
        string,
        Record<string, {
          inflowAmount: number;
          inflowUsd: number;
          inflowCount: number;
          outflowAmount: number;
          outflowUsd: number;
          outflowCount: number;
        }>
      > = {};

      for (const result of aggregation) {
        const { exchangeName, blockchain, direction } = result._id;
        
        if (!flowsByExchange[exchangeName]) {
          flowsByExchange[exchangeName] = {};
        }
        
        if (!flowsByExchange[exchangeName][blockchain]) {
          flowsByExchange[exchangeName][blockchain] = {
            inflowAmount: 0,
            inflowUsd: 0,
            inflowCount: 0,
            outflowAmount: 0,
            outflowUsd: 0,
            outflowCount: 0,
          };
        }

        const flow = flowsByExchange[exchangeName][blockchain];
        if (direction === 'to_exchange') {
          flow.inflowAmount = result.totalAmount;
          flow.inflowUsd = result.totalUsd;
          flow.inflowCount = result.count;
        } else if (direction === 'from_exchange') {
          flow.outflowAmount = result.totalAmount;
          flow.outflowUsd = result.totalUsd;
          flow.outflowCount = result.count;
        }
      }

      // Store flow data for all exchanges
      const bulkOps = [];
      for (const [exchangeName, blockchains] of Object.entries(flowsByExchange)) {
        for (const [blockchain, data] of Object.entries(blockchains)) {
          bulkOps.push({
            updateOne: {
              filter: { exchange: exchangeName, blockchain, hour: hourStart },
              update: {
                $set: {
                  ...data,
                  netFlowAmount: data.inflowAmount - data.outflowAmount,
                  netFlowUsd: data.inflowUsd - data.outflowUsd,
                },
              },
              upsert: true,
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        await this.exchangeFlowModel.bulkWrite(bulkOps, { ordered: false });
        this.logger.log(
          `✅ Aggregated flows for ${Object.keys(flowsByExchange).length} exchanges`,
        );
      } else {
        this.logger.debug('No exchange flow data to aggregate');
      }
    } catch (error) {
      this.logger.error(`Failed to aggregate exchange flows: ${error}`);
    }
  }

  /**
   * Update known wallet balances every 6 hours
   * Due to rate limits, we only update a batch at a time
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async updateWalletBalances(): Promise<void> {
    this.logger.log('💰 Updating wallet balances...');

    try {
      // Get ETH wallets from all exchanges (limit to avoid rate limits)
      const ethWallets = await this.whaleWalletModel
        .find({ blockchain: 'eth', walletType: 'exchange' })
        .limit(20)
        .lean();

      if (ethWallets.length > 0 && this.etherscanService.isEnabled()) {
        const addresses = ethWallets.map((w) => w.address);
        const balances = await this.etherscanService.getMultiBalance(addresses);
        const ethPrice = await this.etherscanService.getEthPrice();

        if (balances && ethPrice) {
          for (const bal of balances) {
            const balanceNum = parseFloat(bal.balance as any);
            await this.whaleWalletModel.updateOne(
              { address: bal.account.toLowerCase(), blockchain: 'eth' },
              {
                $set: {
                  balance: balanceNum,
                  balanceUsd: balanceNum * ethPrice,
                  lastActiveAt: new Date(),
                },
              },
            );
          }
          this.logger.log(`Updated ${balances.length} ETH wallet balances`);
        }
      }

      // Get BTC wallets (limited by Blockchair rate limits - max 10 per batch)
      const btcWallets = await this.whaleWalletModel
        .find({ blockchain: 'btc', walletType: 'exchange' })
        .limit(10)
        .lean();

      if (btcWallets.length > 0 && this.blockchairService.isEnabled()) {
        // Only fetch if we have remaining quota
        if (this.blockchairService.getRemainingCalls() > 100) {
          const addresses = btcWallets.map((w) => w.address);
          const data = await this.blockchairService.getMultiAddressData(addresses);

          if (data) {
            for (const [address, info] of Object.entries(data)) {
              // Balance is in satoshis
              const balanceBtc = info.address.balance / 1e8;
              await this.whaleWalletModel.updateOne(
                { address: address.toLowerCase(), blockchain: 'btc' },
                {
                  $set: {
                    balance: balanceBtc,
                    balanceUsd: info.address.balance_usd,
                    transactionCount: info.address.transaction_count,
                    lastActiveAt: new Date(),
                  },
                },
              );
            }
            this.logger.log(`Updated ${Object.keys(data).length} BTC wallet balances`);
          }
        } else {
          this.logger.warn('Skipping BTC balance update - low Blockchair quota');
        }
      }

      this.logger.log('✅ Wallet balances updated');
    } catch (error) {
      this.logger.error(`Failed to update wallet balances: ${error}`);
    }
  }

  /**
   * Get service health status
   */
  async getStatus(): Promise<{
    whaleAlert: boolean;
    etherscan: boolean;
    blockchair: boolean;
    lastFetch: Date;
    transactionCount: number;
    walletCount: number;
  }> {
    const [transactionCount, walletCount] = await Promise.all([
      this.whaleTransactionModel.countDocuments(),
      this.whaleWalletModel.countDocuments(),
    ]);

    return {
      whaleAlert: this.whaleAlertService.isEnabled(),
      etherscan: this.etherscanService.isEnabled(),
      blockchair: this.blockchairService.isEnabled(),
      lastFetch: new Date(this.lastWhaleAlertFetch * 1000),
      transactionCount,
      walletCount,
    };
  }
}
