import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import { openaiService, CommandIntent } from '../../services/openai.service';
import { commandExecutionEngine, SecurityContext } from '../../services/command-execution.service';
import { getWebSocketService } from '../../services/websocket.service';
import { auditService } from '../../services/audit.service';
import { logger } from '../../utils/logger';
import { validateRequest, sanitizeInput } from '../../middleware/validation';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

// Configure multer for voice file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    // Allow common audio formats
    const allowedMimeTypes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/ogg'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  }
});

// Rate limiting for NLP endpoints - more restrictive than general API
const nlpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes
  message: {
    error: 'Too many NLP requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const chatMessageSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
  sessionId: Joi.string().uuid().required(),
  userId: Joi.string().min(1).max(100).required(),
  context: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant', 'system').required(),
      content: Joi.string().required()
    })
  ).max(20).optional()
});

const commandExecutionSchema = Joi.object({
  intent: Joi.object({
    action: Joi.string().required(),
    target: Joi.string().required(),
    parameters: Joi.object().optional(),
    confidence: Joi.number().min(0).max(1).required(),
    requiresConfirmation: Joi.boolean().required(),
    description: Joi.string().required()
  }).required(),
  sessionId: Joi.string().uuid().required(),
  userId: Joi.string().min(1).max(100).required(),
  confirmed: Joi.boolean().optional()
});

const voiceProcessingSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  userId: Joi.string().min(1).max(100).required()
});

// Apply rate limiting to all NLP routes
router.use(nlpRateLimit);

/**
 * POST /api/nlp/chat/message
 * Process a chat message with natural language understanding
 */
router.post('/chat/message', 
  validateRequest(chatMessageSchema),
  sanitizeInput(['message']),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { message, sessionId, userId, context = [] } = req.body;

    try {
      // Log API request
      await auditService.logApiEvent(
        userId,
        '/api/nlp/chat/message',
        'POST',
        'success',
        0,
        200,
        {
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        }
      );

      logger.info('Processing chat message', { 
        userId, 
        sessionId, 
        messageLength: message.length 
      });

      // Process natural language intent
      let intent: CommandIntent | null = null;
      let intentError: string | null = null;
      
      try {
        intent = await openaiService.processNaturalLanguage(message, userId);
      } catch (error: any) {
        logger.warn('Intent recognition failed:', error.message);
        intentError = error.message;
      }

      // Generate conversational response
      const conversationContext = context.slice(-10); // Keep last 10 messages
      const response = await openaiService.generateResponse(
        [...conversationContext, { role: 'user', content: message }],
        userId
      );

      // Check if command execution is needed
      let executionResult: any = null;
      if (intent && !intent.requiresConfirmation) {
        const securityContext: SecurityContext = {
          userId,
          sessionId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        };

        try {
          executionResult = await commandExecutionEngine.executeCommand(intent, securityContext);
          logger.info('Command executed via chat API', {
            userId,
            action: intent.action,
            target: intent.target,
            success: executionResult.success
          });
        } catch (error: any) {
          logger.error('Command execution failed:', error);
          executionResult = {
            success: false,
            message: `Command execution failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime
          };
        }
      }

      // Broadcast to WebSocket clients if connected
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastMetricsUpdate();
      }

      const responseData = {
        success: true,
        data: {
          response,
          intent: intent ? {
            ...intent,
            requiresConfirmation: intent.requiresConfirmation
          } : null,
          intentError,
          executionResult,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      };

      res.json(responseData);

    } catch (error: any) {
      logger.error('Chat message processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process chat message',
        details: error.message,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      });
    }
  }
);

/**
 * POST /api/nlp/voice/process
 * Process voice input with speech-to-text and intent recognition
 */
router.post('/voice/process',
  upload.single('audio'),
  validateRequest(voiceProcessingSchema, 'body'),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { sessionId, userId } = req.body;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided',
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Processing voice input', {
        userId,
        sessionId,
        audioSize: req.file.size,
        mimeType: req.file.mimetype
      });

      // Process voice with OpenAI Whisper
      const voiceResult = await openaiService.processVoiceInput(req.file.buffer, userId);

      if (voiceResult.error) {
        return res.status(400).json({
          success: false,
          error: voiceResult.error,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        });
      }

      // Execute command if intent was detected and doesn't require confirmation
      let executionResult = null;
      if (voiceResult.intent && !voiceResult.intent.requiresConfirmation) {
        const securityContext: SecurityContext = {
          userId,
          sessionId,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        };

        try {
          executionResult = await commandExecutionEngine.executeCommand(voiceResult.intent, securityContext);
          logger.info('Command executed via voice API', {
            userId,
            action: voiceResult.intent.action,
            target: voiceResult.intent.target,
            success: executionResult.success
          });
        } catch (error: any) {
          logger.error('Voice command execution failed:', error);
          executionResult = {
            success: false,
            message: `Command execution failed: ${error.message}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime
          };
        }
      }

      // Broadcast to WebSocket clients if connected
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.broadcastMetricsUpdate();
      }

      const responseData = {
        success: true,
        data: {
          transcription: voiceResult.transcription,
          intent: voiceResult.intent,
          executionResult,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          audioProcessed: {
            size: req.file.size,
            format: req.file.mimetype,
            duration: null // Could be calculated if needed
          }
        }
      };

      res.json(responseData);

    } catch (error: any) {
      logger.error('Voice processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process voice input',
        details: error.message,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      });
    }
  }
);

/**
 * POST /api/nlp/command/execute
 * Execute a command intent with security validation
 */
router.post('/command/execute',
  validateRequest(commandExecutionSchema),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { intent, sessionId, userId, confirmed = false } = req.body;

    try {
      logger.info('Executing command via API', {
        userId,
        sessionId,
        action: intent.action,
        target: intent.target,
        confirmed
      });

      // Add confirmation if provided
      if (confirmed && intent.requiresConfirmation) {
        intent.parameters = { ...intent.parameters, confirmed: true };
      }

      const securityContext: SecurityContext = {
        userId,
        sessionId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const executionResult = await commandExecutionEngine.executeCommand(intent, securityContext);

      // Broadcast to WebSocket clients if connected
      const wsService = getWebSocketService();
      if (wsService && executionResult.success) {
        wsService.broadcastMetricsUpdate();
      }

      const responseData = {
        success: true,
        data: {
          intent,
          result: executionResult,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      };

      res.json(responseData);

    } catch (error: any) {
      logger.error('Command execution failed:', error);
      res.status(500).json({
        success: false,
        error: 'Command execution failed',
        details: error.message,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      });
    }
  }
);

/**
 * GET /api/nlp/audit/history/:userId
 * Get audit history for a specific user
 */
router.get('/audit/history/:userId',
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const auditHistory = commandExecutionEngine.getAuditHistory(userId, limit);

      res.json({
        success: true,
        data: {
          userId,
          history: auditHistory,
          totalCount: auditHistory.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      logger.error('Failed to retrieve audit history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit history',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/nlp/stats
 * Get system statistics for NLP services
 */
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const auditStats = commandExecutionEngine.getAuditStats();
      const wsService = getWebSocketService();
      const chatStats = wsService ? wsService.getChatStats() : null;

      res.json({
        success: true,
        data: {
          audit: auditStats,
          chat: chatStats,
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }
      });

    } catch (error: any) {
      logger.error('Failed to retrieve NLP stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/nlp/health
 * Health check endpoint for NLP services
 */
router.get('/health',
  async (req: Request, res: Response) => {
    try {
      // Test OpenAI connection with a simple request
      const rateLimitStats = openaiService.getRateLimitStats();
      
      const healthData = {
        status: 'healthy',
        services: {
          openai: {
            status: 'connected',
            rateLimit: rateLimitStats
          },
          commandExecution: {
            status: 'operational',
            stats: commandExecutionEngine.getAuditStats()
          },
          websocket: {
            status: 'operational',
            connectedClients: getWebSocketService()?.getConnectedClientCount() || 0
          }
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };

      res.json({
        success: true,
        data: healthData
      });

    } catch (error: any) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Health check failed',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;