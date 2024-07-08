import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AbsMarketGateway } from './absMarketGateway';
import { MarketConfig } from 'src/config/config.interface';
import { MarketService } from './market.service';

@Injectable()
export class BinanceWebsocketService
  extends AbsMarketGateway
  implements OnModuleInit
{
  protected readonly logger = new Logger(BinanceWebsocketService.name);
  subscriptionNumber : number;
  lastKlineTime: number | null = null;

  constructor(
    config: MarketConfig,
    private marketService: MarketService
  ) {
    super(config);
    this.logger.log('BinanceWebsocketService Initialized');
  }
  onModuleInit() {
    this.connect()
  }

  protected subscribe(): void {
    // update subscription number
    this.subscriptionNumber = 1;
    const subscribeMessage = JSON.stringify({
      method: 'SUBSCRIBE',
      params: [
        'btcusdt@kline_1m'
      ],
      id: this.subscriptionNumber
    });
    this.ws.send(subscribeMessage);
  }
  protected unsubscribe(): void {
    const subscribeMessage = JSON.stringify({
      method: 'UNSUBSCRIBE',
      params: [
        'btcusdt@kline_1m'
      ],
      id: 1
    });
    this.ws.send(subscribeMessage);
  }
  
  protected onMessage(data: string): void {
    if (Buffer.isBuffer(data)) {
      let messageString = data.toString('utf8');
      try {
        const jsonData = JSON.parse(messageString);
        if (jsonData.result === null && jsonData.id === this.subscriptionNumber) {
          this.logger.log('Subscribed to Binance Websocket');
        } else {
          const marketData = {
            date : jsonData.k.t,
            symbol : jsonData.s,
            open : jsonData.k.o,
            high : jsonData.k.h,
            low : jsonData.k.l,
            close : jsonData.k.c,
            volume : jsonData.k.v,
          }

          if (this.lastKlineTime !== jsonData.k.t || this.lastKlineTime == null) {
            // first time or
            this.marketService.saveMarketData(marketData).then(() => {
              this.logger.log(`Saved kline data for => ${jsonData.k.t}`);
              this.lastKlineTime = jsonData.k.t;
            }).catch((error) => {
              this.logger.error('Failed to save market data =>  ', error);
            });
          } else {
            this.lastKlineTime = jsonData.k.t;
          }
        }
        
      } catch(error) {
        console.error(error)
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected handleError(error: Error): void {
    console.log('handle error');
  }
}
