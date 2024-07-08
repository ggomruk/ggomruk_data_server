import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface IMarket extends Document {
  date: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Schema({ timestamps: true })
export class Market extends Document {
  @Prop({ required: true, type: Date })
  date: Date;

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
