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
    const now = new Date().getTime();
    const defaultStart = new Date(new Date().getFullYear(), 0, 1).getTime();

    for (let i = 0; i < SYMBOL_LIST.length; i++) {
      const symbol = SYMBOL_LIST[i];
      this.logger.debug(`Checking data gap for ${symbol}`);
      
      try {
        const lastKline = await this.marketDataService.getLastKline(symbol);
        let startTime = defaultStart;

        if (lastKline) {
          // Start from the end of the last candle
          startTime = new Date(lastKline.closeTime).getTime() + 1;
        }

        // If gap is larger than 1 minute (60000ms)
        if (now - startTime > 60000) {
          this.logger.log(`Gap detected for ${symbol}. Fetching from ${new Date(startTime).toISOString()} to ${new Date(now).toISOString()}`);
          
          const data = await this.getKlineData(
            symbol,
            interval,
            startTime,
            now,
          );
          
          if (data.length > 0) {
            await this.marketDataService.insertBulkData(data);
            this.logger.log(`Filled gap for ${symbol} with ${data.length} records`);
          }
        } else {
          this.logger.log(`Data is up to date for ${symbol}`);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize data for ${symbol}: ${error.message}`);
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
