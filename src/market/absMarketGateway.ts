import { Logger } from '@nestjs/common';
import { MarketConfig } from 'src/config/config.interface';
import { WebSocket } from 'ws';

export abstract class AbsMarketGateway {
  protected readonly logger = new Logger(AbsMarketGateway.name);
  protected pingInterval: NodeJS.Timeout;
  protected ws: WebSocket;

  constructor(protected readonly config: MarketConfig) {
    this.config = config;
  }

  connect() {
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data: string) => this.onMessage(data));
    this.ws.on('close', () => this.onClose());
    this.ws.on('error', (error: Error) => this.handleError(error));
  }

  protected onOpen() {
    this.logger.log(`Connected to ${this.config.name}`);
    this.subscribe();
  }

  protected onClose() {
    this.logger.log(`Disconnected from ${this.config.name}`);
    clearInterval(this.pingInterval);
    setTimeout(() => this.connect(), 5000);
  }

  protected abstract onMessage(data: string): void;
  protected abstract handleError(error: Error): void;
  protected abstract subscribe(): void;
  protected abstract unsubscribe(): void;
}
