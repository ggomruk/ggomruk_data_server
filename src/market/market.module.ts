import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketSchema } from './market.schema';
import { BinanceWebsocketService } from './binance.service';
import { MarketConfig, MarketConfiglist } from 'src/config/config.interface';
import { ConfigService } from '@nestjs/config';
import { MarketService } from './market.service';

const getConfig = (exchangeName: string, configService: ConfigService) => {
  const exchangeConfig: MarketConfig = configService
    .get<MarketConfiglist>('exchanges')
    .find((exchange: MarketConfig) => exchange.name === exchangeName);
  return exchangeConfig;
};

const serviceProviders = [
  MarketService, 
  {
    provide: BinanceWebsocketService,
    useFactory: (configService: ConfigService, marketService: MarketService) => {
      const binanceConfig = getConfig('binance', configService);
      if(!binanceConfig) throw new Error('Unable to find binance config');
      return new BinanceWebsocketService(binanceConfig, marketService);
    },
    inject: [ConfigService, MarketService]
  },
]

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Market', schema: MarketSchema }]),
  ],
  providers: serviceProviders,
})
export class MarketModule {}
