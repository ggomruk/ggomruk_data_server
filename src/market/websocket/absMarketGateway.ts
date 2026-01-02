import { Logger } from '@nestjs/common';
import { MarketConfig } from 'src/config/config.interface';
import { WebSocket } from 'ws';

export abstract class AbsMarketGateway {
  protected readonly logger = new Logger(AbsMarketGateway.name);
  /* eslint-disable no-undef */
  protected pingInterval: NodeJS.Timeout;
  protected ws: WebSocket;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 1000;
  private maxReconnectionDelay = this.reconnectDelay * 60;

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
    this.handleReconnect();
  }

  protected handleReconnect() {
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      let delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      delay = delay > this.maxReconnectionDelay ? this.maxReconnectionDelay : delay;

      setTimeout(() => {
        this.reconnectAttempts++;
        this.logger.log(`Attempting to reconnect ... Attempt ${this.reconnectAttempts}`);
        this.connect();
      }, delay);
    } else {
      throw new Error('Max reconnect attempts reached');
    }
  }

  protected abstract onMessage(data: string): void;
  protected abstract handleError(error: Error): void;
  protected abstract subscribe(): void;
  protected abstract unsubscribe(): void;
}
