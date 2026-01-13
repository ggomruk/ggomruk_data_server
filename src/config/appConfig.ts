import { registerAs } from '@nestjs/config';

interface IAppConfig {
    name: string;
    env: string;
    port: number;
}

export default registerAs<IAppConfig>('app', () => ({
    name: process.env.APP_NAME,
    env: process.env.NODE_ENV,
    port: parseInt(process.env.PORT, 10),
}));

export { IAppConfig };
