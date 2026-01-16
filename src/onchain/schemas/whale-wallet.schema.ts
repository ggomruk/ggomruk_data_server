import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhaleWalletDocument = WhaleWallet & Document;

/**
 * 🏦 WhaleWallet Schema
 *
 * @description Known wallet addresses with labels.
 * Pre-seeded with exchange addresses, updated via external APIs.
 */
@Schema({
  timestamps: true,
  collection: 'whale_wallets',
})
export class WhaleWallet {
  @Prop({ required: true, index: true })
  address: string;

  @Prop({ required: true, enum: ['btc', 'eth'], index: true })
  blockchain: string;

  @Prop({ required: true })
  label: string;

  @Prop({
    required: true,
    enum: ['exchange', 'whale', 'institution', 'smart_money', 'unknown'],
    index: true,
  })
  walletType: string;

  @Prop()
  exchangeName?: string;

  @Prop()
  balance?: number;

  @Prop()
  balanceUsd?: number;

  @Prop()
  lastActiveAt?: Date;

  @Prop()
  transactionCount?: number;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: 'manual' })
  source: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const WhaleWalletSchema = SchemaFactory.createForClass(WhaleWallet);

// Unique compound index for address + blockchain
WhaleWalletSchema.index({ address: 1, blockchain: 1 }, { unique: true });
WhaleWalletSchema.index({ walletType: 1, blockchain: 1 });
WhaleWalletSchema.index({ exchangeName: 1 });
