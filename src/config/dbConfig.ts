import { registerAs } from '@nestjs/config';

interface IDbConfig {
    uri?: string;
    host: string;
    port: number;
    username: string;
    password: string;
    dbName: string;
}

export default registerAs<IDbConfig>('db', () => ({
    uri: process.env.DB_URI,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
}));

export { IDbConfig };
