import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AbsMarketGateway } from './absMarketGateway';
import { MarketDataRepository } from '../market.service';
import { IklineData } from '../interface/Ikline';
import { SYMBOL_LIST } from '../constants';
import { IExchangeConfig } from 'src/config/exchangeConfig';

@Injectable()
export class BinanceWebsocketService
  extends AbsMarketGateway
  implements OnModuleInit
{
  protected readonly logger = new Logger(BinanceWebsocketService.name);
  subscriptionNumber: number;
  lastKlineTime: { [key: string]: number | null } = {};
  symbols: string[];

  constructor(
    config: IExchangeConfig,
    private marketService: MarketDataRepository,
  ) {
    super(config);
    this.logger.log('BinanceWebsocketService Initialized');
    this.symbols = SYMBOL_LIST.map((symbol) => {
      this.lastKlineTime[symbol] = null;
      return `${symbol.toLowerCase()}@kline_1m`;
    });
  }
  onModuleInit() {
    this.connect();
  }

  protected subscribe(): void {
    // update subscription number
    this.subscriptionNumber = 1;
    const subscribeMessage = JSON.stringify({
      method: 'SUBSCRIBE',
      params: this.symbols,
      id: this.subscriptionNumber,
    });
    this.ws.send(subscribeMessage);
  }
  protected unsubscribe(): void {
    const subscribeMessage = JSON.stringify({
      method: 'UNSUBSCRIBE',
      params: this.symbols,
      id: 1,
    });
    this.ws.send(subscribeMessage);
  }

  protected onMessage(data: string): void {
    if (Buffer.isBuffer(data)) {
      const messageString = data.toString('utf8');
      try {
        const jsonData = JSON.parse(messageString);
        if (jsonData.result !== null) {
          if(jsonData.id === this.subscriptionNumber) {
            this.logger.log('Subscribed to Binance Websocket');
          } else if (jsonData.e === "kline") {
            const marketData: IklineData = {
              symbol: jsonData.s,
              openTime: jsonData.k.t,
              closeTime: jsonData.k.T,
              open: jsonData.k.o,
              high: jsonData.k.h,
              low: jsonData.k.l,
              close: jsonData.k.c,
              volume: jsonData.k.v,
            };
  
            if (this.lastKlineTime[jsonData.s] !== jsonData.k.t || this.lastKlineTime == null) {
              this.marketService
                .insertData(marketData)
                .then(() => {
                  this.logger.log(`Saved kline data for ${jsonData.s} (${new Date (jsonData.k.t).toISOString()})`);
                  this.lastKlineTime[jsonData.s] = jsonData.k.t;
                })
                .catch((error) => {
                  this.logger.error('Failed to save market data =>  ', error);
                  // TODO ERROR HANDLING
                });
            } else {
              this.lastKlineTime[jsonData.s] = jsonData.k.t;
            }
          } else {
            this.logger.warn('Unhandled message type');
            this.logger.debug(jsonData);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  }
  protected handleError(error: Error): void {
    // connection, transmission, or protocol error
    this.logger.error(`Error in Binance Websocket => ${error.message}`);
  }
}
