import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MarketDataService } from './market.service';
import { HttpService } from '@nestjs/axios';
import { MarketConfig } from 'src/config/config.interface';
import { firstValueFrom } from 'rxjs';
import { IklineData } from './interface/Ikline';

@Injectable()
export class ApiService implements OnModuleInit {
  private readonly logger = new Logger(ApiService.name);
  constructor(
    private readonly config: MarketConfig,
    private marketDataService: MarketDataService,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    this.initializeData();
  }

  async initializeData() {
    const symbol = 'BTCUSDT';
    const interval = '1m';
    const endTime = new Date().getTime();
    const startTime = new Date(new Date().getFullYear(), 0, 1).getTime();

    const dataCount = await this.marketDataService.getKlineDataCount(
      startTime,
      endTime,
    );

    const expectedDataAmount = (endTime - startTime) / (1000 * 60);
    const tolerancePercentage = 1;
    const toleranceAmount = expectedDataAmount * (tolerancePercentage / 100);
    const lowerBound = expectedDataAmount - toleranceAmount;

    if (dataCount < lowerBound) {
      const data = await this.getKlineData(
        symbol,
        interval,
        startTime,
        endTime,
      );
      await this.marketDataService.insertBulkData(data);
    }
  }

  async getKlineData(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
  ): Promise<IklineData[]> {
    let finalData = [];

    while (true) {
      try {
        const url = `/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        const response = await firstValueFrom(
          this.httpService.get<IklineData[]>(url),
        );

        if (response.status === 429 || response.status === 418) {
          // Rate limit exceeded
          const weightsUsed = response.headers['x-mbx-used-weight'];
          console.log(weightsUsed);
        } else {
          const data = response.data.map((item) => ({
            symbol: symbol,
            openTime: item[0],
            closeTime: item[6],
            open: item[1],
            high: item[2],
            low: item[3],
            close: item[4],
            volume: item[5],
          }));
          finalData = [...finalData, ...data];

          // get the timestamp of the lasta data returned from server
          const lastDataCloseTime = data[data.length - 1]['closeTime'];
          // update time to fetch next batch
          if (lastDataCloseTime < endTime) {
            console.log(
              'Getting Next Batch Starting From => ',
              new Date(lastDataCloseTime),
            );
            startTime = lastDataCloseTime;
          } else {
            console.log(`Finished fetching data (count: ${finalData.length})`);
            break;
          }
        }
      } catch (error) {
        this.logger.error(error);
        return [];
      }
    }
    return finalData;
  }
}
