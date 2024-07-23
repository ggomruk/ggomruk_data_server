import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import config from '../config/config';
import { MarketModule } from 'src/market/market.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      cache: true,
      isGlobal: true,
      load: [config],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<string>('database');
        const uri = `mongodb://${dbConfig['host']}:${dbConfig['port']}/${dbConfig['name']}`;
        return { uri };
      },
    }),
    MarketModule,
  ],
})
export class AppModule {}
