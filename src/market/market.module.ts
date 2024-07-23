import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketSchema } from './market.schema';
import { BinanceWebsocketService } from './binance.service';
import { MarketConfig, MarketConfiglist } from 'src/config/config.interface';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MarketService } from './market.service';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ApiService } from './api.service';

const getConfig = (exchangeName: string, configService: ConfigService) => {
  const exchangeConfig: MarketConfig = configService
    .get<MarketConfiglist>('exchanges')
    .find((exchange: MarketConfig) => exchange.name === exchangeName);
  return exchangeConfig;
};

const serviceProviders = [
  MarketService,
  {
    provide: ApiService,
    useFactory: (
      configService: ConfigService,
      marketService: MarketService,
      httpService: HttpService,
    ) => {
      const binanceConfig = getConfig('binance', configService);
      if (!binanceConfig) throw new Error('Unable to find binance config');
      return new ApiService(binanceConfig, marketService, httpService);
    },
    inject: [ConfigService, MarketService, HttpService],
  },
  {
    provide: BinanceWebsocketService,
    useFactory: (
      configService: ConfigService,
      marketService: MarketService,
    ) => {
      const binanceConfig = getConfig('binance', configService);
      if (!binanceConfig) throw new Error('Unable to find binance config');
      return new BinanceWebsocketService(binanceConfig, marketService);
    },
    inject: [ConfigService, MarketService],
  },
];

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Market', schema: MarketSchema }]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const binanceConfig = getConfig('binance', configService);
        if (!binanceConfig) throw new Error('Unable to find binance config');
        return {
          baseURL: binanceConfig.baseUrl,
          timeout: 5000,
          maxRedirects: 5,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: serviceProviders,
})
export class MarketModule {}
