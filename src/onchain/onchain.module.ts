import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OnchainService } from './onchain.service';
import { WhaleAlertService, EtherscanService, BlockchairService } from './providers';
import { WhaleTransaction, WhaleTransactionSchema, WhaleWallet, WhaleWalletSchema, ExchangeFlow, ExchangeFlowSchema } from './schemas';


/**
 * 🐋 OnchainModule - On-Chain Data Ingestion
 *
 * @description Fetches whale transaction data from external APIs
 * and stores in MongoDB for the API server to serve.
 *
 * @providers
 * - WhaleAlertService: Real-time large transaction alerts
 * - EtherscanService: Ethereum wallet/transaction data
 * - BlockchairService: Bitcoin wallet/transaction data
 *
 * @dataFlow
 * External APIs → OnchainService → MongoDB → API Server → Client
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhaleTransaction.name, schema: WhaleTransactionSchema },
      { name: WhaleWallet.name, schema: WhaleWalletSchema },
      { name: ExchangeFlow.name, schema: ExchangeFlowSchema },
    ]),
  ],
  providers: [
    OnchainService,
    WhaleAlertService,
    EtherscanService,
    BlockchairService,
  ],
  exports: [OnchainService],
})
export class OnchainModule {}
