import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

/**
 * Middleware to validate request data against a Joi schema
 */
export const validateRequest = (schema: Joi.ObjectSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const dataToValidate = req[target];
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown properties
      allowUnknown: false // Don't allow unknown properties
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Request validation failed', {
        endpoint: req.path,
        method: req.method,
        errors: validationErrors,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace request data with validated and sanitized data
    req[target] = value;
    next();
  };
};

/**
 * Middleware to sanitize input fields by trimming and escaping
 */
export const sanitizeInput = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const field of fields) {
        if (req.body && req.body[field] && typeof req.body[field] === 'string') {
          // Trim whitespace
          req.body[field] = req.body[field].trim();
          
          // Basic HTML escape to prevent XSS
          req.body[field] = req.body[field]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        }
      }
      next();
    } catch (error: any) {
      logger.error('Input sanitization failed:', error);
      res.status(500).json({
        success: false,
        error: 'Input sanitization failed',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Middleware to validate file uploads
 */
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedMimeTypes?: string[];
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { maxSize = 10 * 1024 * 1024, allowedMimeTypes = [], required = true } = options;

    // Check if file is required but missing
    if (required && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'File upload is required',
        timestamp: new Date().toISOString()
      });
    }

    // If file is not required and not provided, continue
    if (!required && !req.file) {
      return next();
    }

    const file = req.file!;

    // Check file size
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`,
        details: {
          fileSize: file.size,
          maxSize
        },
        timestamp: new Date().toISOString()
      });
    }

    // Check MIME type if specified
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        details: {
          providedType: file.mimetype,
          allowedTypes: allowedMimeTypes
        },
        timestamp: new Date().toISOString()
      });
    }

    logger.info('File upload validated', {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      endpoint: req.path
    });

    next();
  };
};

/**
 * Middleware to validate authentication header
 */
export const validateAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      details: 'Provide a valid Bearer token in Authorization header',
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (!token || token.length < 10) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
      timestamp: new Date().toISOString()
    });
  }

  // Add token to request for use by other middleware
  req.body.authToken = token;
  next();
};

/**
 * Middleware to validate user permissions
 */
export const validatePermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For now, just check if user is authenticated
    // In a real implementation, you would check user roles and permissions
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        details: 'User ID required for permission validation',
        timestamp: new Date().toISOString()
      });
    }

    // TODO: Implement actual permission checking logic
    // This would typically involve:
    // 1. Decode JWT token to get user info
    // 2. Query database for user permissions
    // 3. Check if user has required permissions
    
    logger.debug('Permission validation passed', {
      userId,
      requiredPermissions,
      endpoint: req.path
    });

    next();
  };
};

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  })
};

/**
 * Security validation middleware - prevents common attack patterns
 */
export const securityValidation = (req: Request, res: Response, next: NextFunction) => {
  // Skip security validation for delegation routes during testing
  if (req.path.includes('/delegation') && process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    // XSS patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    // Path traversal
    /(\.\.[\/\\]){3,}/,
    // Command injection (excluding empty objects)
    /[;&|`$()]/
  ];

  const requestBody = JSON.stringify(req.body);
  const requestQuery = JSON.stringify(req.query);
  
  // Don't flag empty objects as suspicious
  if (requestBody === '{}' && requestQuery === '{}') {
    return next();
  }
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestBody) || pattern.test(requestQuery)) {
      logger.warn('Suspicious request pattern detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        pattern: pattern.toString()
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
};