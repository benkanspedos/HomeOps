import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRouter } from './api/routes';
import { initializeDatabase } from './db/client';
import { initializeRedis } from './db/redis';
import { startScheduledJobs } from './utils/scheduler';
import { healthMonitor } from './services/health-monitor.service';
import { alertService } from './services/alert.service';
import { initializeWebSocket } from './services/websocket.service';

const app: Express = express();
const httpServer = createServer(app);
const PORT = config.port || 3101;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api', apiRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Stop monitoring services
  await healthMonitor.stopMonitoring();
  await alertService.shutdown();
  
  // Shutdown WebSocket service
  const webSocketService = require('./services/websocket.service').getWebSocketService();
  if (webSocketService) {
    await webSocketService.shutdown();
  }
  
  // Close database connections
  // await closeDatabase();
  // await closeRedis();
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = httpServer.listen(PORT, async () => {
  try {
    // Initialize services
    await initializeDatabase();
    await initializeRedis();
    
    // Initialize WebSocket service
    const webSocketService = initializeWebSocket(httpServer);
    
    // Initialize monitoring services (optional for testing)
    try {
      if (!process.env.SKIP_DOCKER_SERVICES) {
        await healthMonitor.initialize();
      } else {
        logger.info('Skipping Docker health monitor initialization');
      }
      await alertService.initialize();
    } catch (error) {
      logger.warn('Health monitor initialization failed, continuing without it:', error.message);
    }
    
    // Set up alert event listeners
    healthMonitor.on('container:down', async (container) => {
      logger.warn(`Container down: ${container.containerName}`);
      await alertService.checkThresholds({
        containerId: container.containerId,
        containerName: container.containerName,
        containerStatus: 0,
      });
    });
    
    healthMonitor.on('container:unhealthy', async (container) => {
      logger.warn(`Container unhealthy: ${container.containerName}`);
    });
    
    healthMonitor.on('threshold:cpu-high', async (data) => {
      await alertService.checkThresholds(data.container);
    });
    
    healthMonitor.on('threshold:memory-high', async (data) => {
      await alertService.checkThresholds(data.container);
    });
    
    startScheduledJobs();
    
    logger.info(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
    logger.info(`Health check available at http://localhost:${PORT}/health`);
    logger.info(`WebSocket service initialized with ${webSocketService.getConnectedClientCount()} connected clients`);
    logger.info('Health monitoring and alerting services initialized');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in development
  if (config.nodeEnv === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // Always exit on uncaught exceptions
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default app;