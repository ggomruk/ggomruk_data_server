import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MarketService } from './market.service';
import { HttpService } from '@nestjs/axios';
import { MarketConfig } from 'src/config/config.interface';
import { catchError, firstValueFrom, last, Observable } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

interface IklineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

@Injectable()
export class ApiService implements OnModuleInit {
  private readonly logger = new Logger(ApiService.name);
  constructor(
    private readonly config: MarketConfig,
    private marketService: MarketService,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    this.initializeData();
  }

  async initializeData() {
    const data = await this.getKlineData();
  }

  async getKlineData(): Promise<IklineData[]> {
    const symbol = 'BTCUSDT';
    const interval = '1m';
    const endTime = new Date().getTime();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startTime = threeMonthsAgo.getTime();
    const limit = 4000000;

    console.log(startTime);
    console.log(endTime)

    const url = `/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<IklineData[]>(url),
      );
      if (!response.data || response.data.length === 0) {
        throw new Error('No data found');
      }
      const data = response.data.map((item) => ({
        openTime: item[0],
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
        closeTime: item[6],
      }));
      console.log(data.length)
      let firstData = data[0];
      let lastData = data[data.length - 1];
      console.log(new Date(firstData.openTime).toISOString());
      console.log(new Date(lastData.closeTime).toISOString());
      console.log(lastData.closeTime - firstData.openTime);
      return response.data;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }
}
