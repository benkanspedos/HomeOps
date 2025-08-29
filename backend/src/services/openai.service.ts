import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { config } from '../config';

// Rate limiting configuration
interface RateLimitConfig {
  requests: number;
  window: number; // in milliseconds
  retryAfter: number; // in milliseconds
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export interface CommandIntent {
  action: string;
  target: string;
  parameters: Record<string, any>;
  confidence: number;
  requiresConfirmation: boolean;
  description: string;
}

export interface VoiceProcessingResult {
  transcription: string;
  intent?: CommandIntent;
  error?: string;
}

export class OpenAIService {
  private openai: OpenAI;
  private rateLimitConfig: RateLimitConfig;
  private requestHistory: Map<string, RequestRecord>;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Rate limiting: 60 requests per minute (OpenAI's default tier limit)
    this.rateLimitConfig = {
      requests: 60,
      window: 60 * 1000, // 1 minute
      retryAfter: 1000, // 1 second
    };

    this.requestHistory = new Map();
    logger.info('OpenAI service initialized');
  }

  /**
   * Check if request is within rate limits
   */
  private checkRateLimit(userId: string = 'default'): boolean {
    const now = Date.now();
    const record = this.requestHistory.get(userId);

    if (!record) {
      this.requestHistory.set(userId, { timestamp: now, count: 1 });
      return true;
    }

    // Reset count if window has expired
    if (now - record.timestamp > this.rateLimitConfig.window) {
      this.requestHistory.set(userId, { timestamp: now, count: 1 });
      return true;
    }

    // Check if within limits
    if (record.count >= this.rateLimitConfig.requests) {
      logger.warn(`Rate limit exceeded for user: ${userId}`);
      return false;
    }

    // Increment count
    record.count++;
    return true;
  }

  /**
   * Process natural language input and extract command intent
   */
  async processNaturalLanguage(message: string, userId?: string): Promise<CommandIntent> {
    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = `Parse this HomeOps command: "${message}"`;

      logger.debug(`Processing NLP request for user: ${userId}`, { message });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Cost-effective model for intent recognition
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 300,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      const intent = JSON.parse(response) as CommandIntent;
      
      // Validate intent structure
      this.validateIntent(intent);

      logger.info(`Command intent parsed successfully`, { 
        userId, 
        action: intent.action, 
        target: intent.target,
        confidence: intent.confidence 
      });

      return intent;
    } catch (error: any) {
      logger.error('Failed to process natural language:', error);
      throw new Error(`Natural language processing failed: ${error.message}`);
    }
  }

  /**
   * Process voice input using Whisper API
   */
  async processVoiceInput(audioBuffer: Buffer, userId?: string): Promise<VoiceProcessingResult> {
    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      logger.debug(`Processing voice input for user: ${userId}`, { 
        audioSize: audioBuffer.length 
      });

      // Convert audio to transcription using Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      if (!transcription || typeof transcription !== 'string') {
        throw new Error('Invalid transcription response');
      }

      logger.info(`Voice transcription completed`, { 
        userId, 
        transcriptionLength: transcription.length 
      });

      // Process the transcribed text for command intent
      let intent: CommandIntent | undefined;
      try {
        intent = await this.processNaturalLanguage(transcription, userId);
      } catch (error: any) {
        logger.warn('Failed to extract intent from transcription:', error.message);
      }

      return {
        transcription: transcription.trim(),
        intent,
      };
    } catch (error: any) {
      logger.error('Failed to process voice input:', error);
      return {
        transcription: '',
        error: `Voice processing failed: ${error.message}`
      };
    }
  }

  /**
   * Generate conversational response for chat interface
   */
  async generateResponse(
    context: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    userId?: string
  ): Promise<string> {
    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      const systemMessage = {
        role: 'system' as const,
        content: this.buildChatSystemPrompt()
      };

      const messages = [systemMessage, ...context.slice(-10)]; // Keep last 10 messages for context

      logger.debug(`Generating response for user: ${userId}`, { 
        contextLength: context.length 
      });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7, // More conversational
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      logger.info(`Response generated successfully`, { 
        userId, 
        responseLength: response.length 
      });

      return response.trim();
    } catch (error: any) {
      logger.error('Failed to generate response:', error);
      throw new Error(`Response generation failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt for command intent recognition
   */
  private buildSystemPrompt(): string {
    return `You are HomeOps Assistant, a natural language interface for home automation and infrastructure management.

Available commands and their parameters:

CONTAINER MANAGEMENT:
- Actions: start, stop, restart, status, logs, remove
- Targets: container names (pihole, timescaledb, redis, nginx, etc.)
- Parameters: lines (for logs), force (for remove)

HEALTH MONITORING:  
- Actions: health, status, alerts, metrics, check
- Targets: system, containers, services, cpu, memory, disk
- Parameters: hours (for history), type (for metrics)

DNS MANAGEMENT:
- Actions: add, remove, lookup, resolve, list
- Targets: domain names, dns records, zones
- Parameters: type (A, CNAME, MX), value, ttl

SYSTEM QUERIES:
- Actions: logs, resources, disk, memory, processes, uptime
- Targets: system, application logs, specific services
- Parameters: lines, level (error, warn, info)

Return a JSON object with this exact structure:
{
  "action": "specific action verb",
  "target": "what the action applies to", 
  "parameters": {"key": "value"},
  "confidence": 0.0-1.0,
  "requiresConfirmation": true/false,
  "description": "human-readable explanation"
}

Examples:
"restart pihole container" → {"action": "restart", "target": "pihole", "parameters": {}, "confidence": 0.95, "requiresConfirmation": true, "description": "Restart the Pi-hole DNS container"}
"show me system health" → {"action": "health", "target": "system", "parameters": {}, "confidence": 0.9, "requiresConfirmation": false, "description": "Display overall system health status"}
"add DNS record example.com" → {"action": "add", "target": "example.com", "parameters": {"type": "A"}, "confidence": 0.8, "requiresConfirmation": true, "description": "Add DNS A record for example.com"}

Set requiresConfirmation: true for destructive actions (stop, remove, restart, add, delete).
Set confidence lower (0.6-0.8) for ambiguous commands.`;
  }

  /**
   * Build system prompt for conversational responses
   */
  private buildChatSystemPrompt(): string {
    return `You are HomeOps Assistant, a helpful and knowledgeable home automation assistant.

You help users manage their home infrastructure including:
- Docker containers (Pi-hole, databases, web servers)
- DNS management and network configuration
- System monitoring and health checks
- Infrastructure alerts and maintenance

Provide clear, helpful responses that:
1. Confirm what actions were taken or will be taken
2. Explain technical concepts in accessible terms
3. Suggest related commands or best practices
4. Warn about potential issues or risks
5. Offer troubleshooting steps when appropriate

Keep responses concise but informative. Use a friendly, professional tone.
When commands fail or have issues, provide specific next steps to resolve them.`;
  }

  /**
   * Validate command intent structure
   */
  private validateIntent(intent: CommandIntent): void {
    const required = ['action', 'target', 'parameters', 'confidence', 'requiresConfirmation', 'description'];
    
    for (const field of required) {
      if (!(field in intent)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof intent.confidence !== 'number' || intent.confidence < 0 || intent.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1');
    }

    if (typeof intent.requiresConfirmation !== 'boolean') {
      throw new Error('requiresConfirmation must be a boolean');
    }

    if (!intent.action || !intent.target || !intent.description) {
      throw new Error('Action, target, and description cannot be empty');
    }
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats(userId: string = 'default'): { remaining: number; resetTime: number } {
    const record = this.requestHistory.get(userId);
    
    if (!record) {
      return { 
        remaining: this.rateLimitConfig.requests, 
        resetTime: Date.now() + this.rateLimitConfig.window 
      };
    }

    const now = Date.now();
    const windowExpiry = record.timestamp + this.rateLimitConfig.window;
    
    if (now > windowExpiry) {
      return { 
        remaining: this.rateLimitConfig.requests, 
        resetTime: now + this.rateLimitConfig.window 
      };
    }

    return {
      remaining: Math.max(0, this.rateLimitConfig.requests - record.count),
      resetTime: windowExpiry
    };
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();