import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface IMarket extends Document {
  openTime: Date;
  closeTime: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Schema({ timestamps: false })
export class Market extends Document {
  @Prop({ required: true, type: Date })
  openTime: Date;

  @Prop({ required: true, type: Date })
  closeTime: Date;

  @Prop({ required: true, type: String })
  symbol: string;

  @Prop({ type: Number, required: true })
  open: number;

  @Prop({ type: Number, required: true })
  high: number;

  @Prop({ type: Number, required: true })
  low: number;

  @Prop({ type: Number, required: true })
  close: number;

  @Prop({ type: Number, required: true })
  volume: number;
}

export const MarketSchema = SchemaFactory.createForClass<IMarket>(Market);

MarketSchema.index({ symbol: 1, openTime: 1, closeTime: 1 }, { unique: true });
