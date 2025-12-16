import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import config from './config/config';
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
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        // Check if credentials are provided
        const hasCredentials = dbConfig.username && dbConfig.password;
        const uri = hasCredentials
          ? `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}?authSource=admin`
          : `mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`;
        
        console.log('MongoDB URI:', uri.replace(/:([^:@]+)@/, ':****@')); // Log with masked password
        return { uri };
      },
    }),
    MarketModule,
  ],
})
export class AppModule {}
