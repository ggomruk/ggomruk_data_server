import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config';
import { MarketModule } from 'src/market/market.module';
import { HealthController } from './health.controller';

const logger = new Logger('AppModule');

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      cache: true,
      isGlobal: true,
      load: configuration,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.get('app');
        const dbConfig = configService.get('db');
        const env = appConfig.env;

        if (env === 'prod') {
          const uri = dbConfig.uri;
          logger.log('MongoDB URI: ' + uri.replace(/:([^:@]+)@/, ':****@'));
          return { uri };
        } else {
          // Check if credentials are provided
          const hasCredentials = dbConfig.username && dbConfig.password;
          const uri = hasCredentials
            ? `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.dbName}?authSource=admin`
            : `mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.dbName}`;
          
          logger.log('MongoDB URI: ' + uri.replace(/:([^:@]+)@/, ':****@'));
          return { uri };
        }
      },
    }),
    MarketModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
