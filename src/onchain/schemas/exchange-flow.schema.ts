import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExchangeFlowDocument = ExchangeFlow & Document;

/**
 * 📊 ExchangeFlow Schema
 *
 * @description Hourly aggregated exchange inflow/outflow data.
 * Helps track if crypto is moving to/from exchanges (sell/buy pressure indicator).
 */
@Schema({
  timestamps: true,
  collection: 'exchange_flows',
})
export class ExchangeFlow {
  @Prop({ required: true, index: true })
  exchange: string;

  @Prop({ required: true, enum: ['btc', 'eth'], index: true })
  blockchain: string;

  @Prop({ required: true, index: true })
  hour: Date;

  @Prop({ required: true, default: 0 })
  inflowAmount: number;

  @Prop({ required: true, default: 0 })
  inflowUsd: number;

  @Prop({ required: true, default: 0 })
  inflowCount: number;

  @Prop({ required: true, default: 0 })
  outflowAmount: number;

  @Prop({ required: true, default: 0 })
  outflowUsd: number;

  @Prop({ required: true, default: 0 })
  outflowCount: number;

  @Prop()
  netFlowAmount?: number;

  @Prop()
  netFlowUsd?: number;
}

export const ExchangeFlowSchema = SchemaFactory.createForClass(ExchangeFlow);

// Unique compound index for time-series data
ExchangeFlowSchema.index(
  { exchange: 1, blockchain: 1, hour: 1 },
  { unique: true },
);
ExchangeFlowSchema.index({ hour: -1 });
ExchangeFlowSchema.index({ netFlowUsd: -1 });

// TTL index - keep 90 days of hourly data
ExchangeFlowSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);
