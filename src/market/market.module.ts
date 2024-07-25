import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketSchema } from './market.schema';
import { BinanceWebsocketService } from './websocket/binance.service';
import { MarketConfig, MarketConfiglist } from 'src/config/config.interface';
import { ConfigService } from '@nestjs/config';
import { MarketDataRepository } from './market.service';
import { HttpModule } from '@nestjs/axios';
import { ApiService } from './api/api.service';

const getConfig = (exchangeName: string, configService: ConfigService) => {
  const exchangeConfig: MarketConfig = configService
    .get<MarketConfiglist>('exchanges')
    .find((exchange: MarketConfig) => exchange.name === exchangeName);
  return exchangeConfig;
};

const serviceProviders = [
  MarketDataRepository,
  ApiService,
  {
    provide: BinanceWebsocketService,
    useFactory: (
      configService: ConfigService,
      marketService: MarketDataRepository,
    ) => {
      const binanceConfig = getConfig('binance', configService);
      if (!binanceConfig) throw new Error('Unable to find binance config');
      return new BinanceWebsocketService(binanceConfig, marketService);
    },
    inject: [ConfigService, MarketDataRepository],
  },
];

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Market', schema: MarketSchema }]),
    HttpModule.registerAsync({
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
