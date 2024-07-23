import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMarket } from './market.schema';

@Injectable()
export class MarketService {
  constructor(
    @InjectModel('Market') private readonly marketModel: Model<IMarket>,
  ) {}

  async saveMarketData(data: any): Promise<IMarket> {
    const createdMarket = new this.marketModel(data);
    return createdMarket.save();
  }
}
