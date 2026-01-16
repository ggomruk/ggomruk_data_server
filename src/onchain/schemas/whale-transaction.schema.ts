import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WhaleTransactionDocument = WhaleTransaction & Document;

/**
 * 🐋 WhaleTransaction Schema
 *
 * @description Stores large cryptocurrency transactions detected by external APIs.
 * Used for tracking whale movements and exchange flows.
 */
@Schema({
  timestamps: true,
  collection: 'whale_transactions',
})
export class WhaleTransaction {
  @Prop({ required: true, unique: true, index: true })
  txHash: string;

  @Prop({ required: true, enum: ['btc', 'eth'], index: true })
  blockchain: string;

  @Prop({ required: true, index: true })
  fromAddress: string;

  @Prop()
  fromLabel?: string;

  @Prop({ enum: ['exchange', 'whale', 'institution', 'unknown'] })
  fromType?: string;

  @Prop({ required: true, index: true })
  toAddress: string;

  @Prop()
  toLabel?: string;

  @Prop({ enum: ['exchange', 'whale', 'institution', 'unknown'] })
  toType?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  symbol: string;

  @Prop({ required: true, index: true })
  amountUsd: number;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ index: true })
  blockNumber?: number;

  @Prop({
    enum: ['to_exchange', 'from_exchange', 'between_exchanges', 'unknown'],
    index: true,
  })
  direction?: string;

  @Prop()
  exchangeName?: string;

  @Prop({ default: 'whale_alert' })
  source: string;
}

export const WhaleTransactionSchema =
  SchemaFactory.createForClass(WhaleTransaction);

// Compound indexes for efficient queries
WhaleTransactionSchema.index({ blockchain: 1, timestamp: -1 });
WhaleTransactionSchema.index({ direction: 1, timestamp: -1 });
WhaleTransactionSchema.index({ amountUsd: -1, timestamp: -1 });
WhaleTransactionSchema.index({ exchangeName: 1, timestamp: -1 });

// TTL index for automatic cleanup (90 days retention)
WhaleTransactionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
