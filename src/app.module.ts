import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config';
import { MarketModule } from 'src/market/market.module';

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

        if (env === 'production') {
          const uri = dbConfig.uri;
          console.log('MongoDB URI:', uri.replace(/:([^:@]+)@/, ':****@'));
          return { uri };
        } else {
          // Check if credentials are provided
          const hasCredentials = dbConfig.username && dbConfig.password;
          const uri = hasCredentials
            ? `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}?authSource=admin`
            : `mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`;
          
          console.log('MongoDB URI:', uri.replace(/:([^:@]+)@/, ':****@')); // Log with masked password
          return { uri };
        }
      },
    }),
    MarketModule,
  ],
})
export class AppModule {}
