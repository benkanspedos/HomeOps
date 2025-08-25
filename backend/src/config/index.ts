import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Define validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3101),
  DATABASE_URL: Joi.string().required(),
  SUPABASE_URL: Joi.string().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_KEY: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRY: Joi.string().default('7d'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  NORDVPN_USERNAME: Joi.string().optional(),
  NORDVPN_PASSWORD: Joi.string().optional(),
  NORDVPN_COUNTRY: Joi.string().default('United States'),
  TIMESCALE_USER: Joi.string().default('homeops'),
  TIMESCALE_PASSWORD: Joi.string().optional(),
  TIMESCALE_DB: Joi.string().default('homeops_metrics'),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  nodeEnv: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  database: {
    url: envVars.DATABASE_URL as string,
    supabase: {
      url: envVars.SUPABASE_URL as string,
      anonKey: envVars.SUPABASE_ANON_KEY as string,
      serviceKey: envVars.SUPABASE_SERVICE_KEY as string,
    },
    timescale: {
      user: envVars.TIMESCALE_USER as string,
      password: envVars.TIMESCALE_PASSWORD as string,
      database: envVars.TIMESCALE_DB as string,
    },
  },
  redis: {
    url: envVars.REDIS_URL as string,
  },
  jwt: {
    secret: envVars.JWT_SECRET as string,
    expiry: envVars.JWT_EXPIRY as string,
  },
  corsOrigins: envVars.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  logLevel: envVars.LOG_LEVEL as string,
  vpn: {
    username: envVars.NORDVPN_USERNAME as string,
    password: envVars.NORDVPN_PASSWORD as string,
    country: envVars.NORDVPN_COUNTRY as string,
  },
  isDevelopment: envVars.NODE_ENV === 'development',
  isProduction: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test',
};

export type Config = typeof config;