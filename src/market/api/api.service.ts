import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MarketDataRepository } from '../market.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IklineData } from '../interface/Ikline';
import { SYMBOL_LIST } from '../constants';
import { sleep } from 'src/utils/utils';

@Injectable()
export class ApiService implements OnModuleInit {
  private readonly logger = new Logger(ApiService.name);
  constructor(
    private marketDataService: MarketDataRepository,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    this.initializeData();
  }

  async initializeData() {
    const interval = '1m';
    const endTime = new Date().getTime();
    const startTime = new Date(new Date().getFullYear(), 0, 1).getTime();

    const expectedDataAmount = (endTime - startTime) / (1000 * 60);
    const tolerancePercentage = 1;
    const toleranceAmount = expectedDataAmount * (tolerancePercentage / 100);
    const lowerBound = expectedDataAmount - toleranceAmount;

    for (let i = 0; i < SYMBOL_LIST.length; i++) {
      const symbol = SYMBOL_LIST[i];
      this.logger.debug(`Checking data for ${symbol}`);
      try {
        const dataCount = await this.marketDataService.getKlineDataCount(
          symbol,
          startTime,
          endTime,
        );
        if (dataCount < lowerBound) {
          const data = await this.getKlineData(
            symbol,
            interval,
            startTime,
            endTime,
          );
          await this.marketDataService.insertBulkData(data);
        } else {
          this.logger.log(
            'Sufficient amount of data in database. Skipping data fetch for ' + symbol,
          );
        }
      } catch (error) {
        continue;
      }
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
          this.logger.warn(
            `Rate limit exceeded. Waiting for 2 seconds (${weightsUsed} weight used)`,
          );
          this.logger.warn(response.headers);
          await sleep(2000);
          continue;
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
            // console.log(
            //   'Getting Next Batch Starting From => ',
            //   new Date(lastDataCloseTime),
            // );
            startTime = lastDataCloseTime;
          } else {
            console.log(
              `Finished fetching data for ${symbol} (count: ${finalData.length})`,
            );
            break;
          }
        }
      } catch (error) {
        this.logger.error(`[${symbol}] => ${error.message}`);
        throw new Error(error.message);
      }
    }
    return finalData;
  }
}
