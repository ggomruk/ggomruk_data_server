import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMarket } from './market.schema';
import { IklineData } from './interface/Ikline';

@Injectable()
export class MarketDataRepository {
  private readonly logger = new Logger(MarketDataRepository.name);
  constructor(
    @InjectModel('Market') private readonly marketModel: Model<IMarket>,
  ) {}

  async insertData(data: IklineData): Promise<IMarket> {
    const query = {
      symbol: data.symbol,
      openTime: data.openTime,
      closeTime: data.closeTime,
    };
    const update = { $set: data };
    const options = { upsert: true, new: true };

    const result = await this.marketModel.findOneAndUpdate(
      query,
      update,
      options,
    );
    return result;
  }

  async insertBulkData(data: IklineData[]) {
    const operations = data.map((item) => ({
      updateOne: {
        filter: {
          symbol: item.symbol,
          openTime: item.openTime,
          closeTime: item.closeTime,
        },
        update: { $set: item },
        upsert: true,
      },
    }));

    try {
      await this.marketModel.bulkWrite(operations);
      this.logger.debug(
        `Data inserted/updated successfully (${data[0].symbol})`,
      );
    } catch (error) {
      this.logger.error(
        `Error inserting/updating data (${data[0].symbol}) => `,
        error,
      );
    }
  }

  async getKlineDataCount(
    symbol: string,
    startDate: number,
    endDate: number,
  ): Promise<number> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const dataCount = await this.marketModel.countDocuments({
      symbol: { $eq: symbol },
      openTime: { $gte: start },
      closeTime: { $lte: end },
    });

    return dataCount;
  }
}
