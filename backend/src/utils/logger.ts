import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: logFormat,
  defaultMeta: { service: 'homeops-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.isDevelopment ? consoleFormat : logFormat,
    }),
    // File transports
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Logger class for service-specific logging
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: any): void {
    logger.info(`[${this.context}] ${message}`, meta);
  }

  error(message: string, error?: any): void {
    logger.error(`[${this.context}] ${message}`, { error: error?.message || error });
  }

  warn(message: string, meta?: any): void {
    logger.warn(`[${this.context}] ${message}`, meta);
  }

  debug(message: string, meta?: any): void {
    logger.debug(`[${this.context}] ${message}`, meta);
  }
}

// Create stream for Morgan HTTP logger
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};