import { Request, Response, NextFunction } from 'express';
import { DNSService } from '../services/dns.service';
import { DNSModel } from '../models/dns.model';
import { Logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class DNSController {
  private dnsService: DNSService;
  private dnsModel: DNSModel;
  private logger: Logger;

  constructor() {
    this.dnsService = new DNSService();
    this.dnsModel = new DNSModel();
    this.logger = new Logger('DNSController');
  }

  /**
   * GET /api/dns/status
   * Get Pi-hole connectivity status
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.dnsService.getStatus();
      
      res.json({
        success: true,
        data: {
          connected: true,
          status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to get DNS status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to connect to Pi-hole',
        data: {
          connected: false,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/dns/domains
   * List all domains with block status
   */
  getDomains = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { listType = 'all' } = req.query;
      
      let domains: any[] = [];
      
      if (listType === 'all' || listType === 'black') {
        const blacklist = await this.dnsService.getDomains('black');
        domains.push(...blacklist.map(d => ({ ...d, listType: 'black', blocked: true })));
      }
      
      if (listType === 'all' || listType === 'white') {
        const whitelist = await this.dnsService.getDomains('white');
        domains.push(...whitelist.map(d => ({ ...d, listType: 'white', blocked: false })));
      }

      // Store domains in database for tracking
      for (const domain of domains) {
        await this.dnsModel.upsertDomain(domain.domain, domain.blocked);
      }

      res.json({
        success: true,
        data: {
          domains,
          total: domains.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError('Failed to retrieve domains', 500));
    }
  };

  /**
   * POST /api/dns/domains
   * Add new domain to list
   */
  addDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domain, listType = 'black', comment } = req.body;
      
      if (!domain) {
        throw new AppError('Domain is required', 400);
      }

      // Validate domain format
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(domain)) {
        throw new AppError('Invalid domain format', 400);
      }

      await this.dnsService.addDomain(domain, listType, comment);
      
      // Store in database
      const blocked = listType === 'black';
      await this.dnsModel.upsertDomain(domain, blocked);

      res.status(201).json({
        success: true,
        data: {
          domain,
          listType,
          blocked,
          message: `Domain ${domain} added to ${listType} list`
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/dns/domains/:domain
   * Remove domain from list
   */
  removeDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domain } = req.params;
      const { listType = 'black' } = req.query;
      
      if (!domain) {
        throw new AppError('Domain parameter is required', 400);
      }
      
      await this.dnsService.removeDomain(domain, listType as 'white' | 'black');
      
      // Update database
      await this.dnsModel.deleteDomain(domain);

      res.json({
        success: true,
        data: {
          domain,
          message: `Domain ${domain} removed from ${listType} list`
        }
      });
    } catch (error) {
      next(new AppError('Failed to remove domain', 500));
    }
  };

  /**
   * PUT /api/dns/domains/:domain/block
   * Block or unblock domain
   */
  blockDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domain } = req.params;
      const { block = true } = req.body;
      
      if (!domain) {
        throw new AppError('Domain parameter is required', 400);
      }
      
      await this.dnsService.blockDomain(domain, block);
      
      // Update database
      await this.dnsModel.upsertDomain(domain, block);

      res.json({
        success: true,
        data: {
          domain,
          blocked: block,
          message: `Domain ${domain} ${block ? 'blocked' : 'unblocked'}`
        }
      });
    } catch (error) {
      next(new AppError('Failed to update domain block status', 500));
    }
  };

  /**
   * GET /api/dns/queries
   * Get query history with pagination
   */
  getQueries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const queries = await this.dnsService.getQueryHistory(limit, offset);
      
      // Store significant queries in database
      for (const query of queries) {
        await this.dnsModel.logQuery(
          query.domain,
          query.client,
          query.type,
          query.timestamp,
          query.status === 'blocked'
        );
      }

      res.json({
        success: true,
        data: {
          queries,
          limit,
          offset,
          total: queries.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError('Failed to retrieve query history', 500));
    }
  };

  /**
   * GET /api/dns/performance
   * Get performance metrics
   */
  getPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = await this.dnsService.getPerformanceStats();
      
      // Store metrics in database
      await this.dnsModel.saveMetrics(
        metrics.queries_today,
        metrics.blocked_today,
        metrics.average_response_time || 0
      );

      res.json({
        success: true,
        data: {
          metrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError('Failed to retrieve performance metrics', 500));
    }
  };

  /**
   * GET /api/dns/top-queries
   * Get top queried domains
   */
  getTopQueries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const topQueries = await this.dnsService.getTopQueries(limit);

      res.json({
        success: true,
        data: {
          topQueries,
          limit,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError('Failed to retrieve top queries', 500));
    }
  };

  /**
   * GET /api/dns/top-blocked
   * Get top blocked domains
   */
  getTopBlocked = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const topBlocked = await this.dnsService.getTopBlocked(limit);

      res.json({
        success: true,
        data: {
          topBlocked,
          limit,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError('Failed to retrieve top blocked', 500));
    }
  };

  /**
   * POST /api/dns/blocking
   * Enable or disable Pi-hole blocking
   */
  setBlocking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { enabled, duration } = req.body;
      
      if (typeof enabled !== 'boolean') {
        throw new AppError('enabled parameter must be a boolean', 400);
      }

      await this.dnsService.setBlockingStatus(enabled, duration);

      res.json({
        success: true,
        data: {
          blockingEnabled: enabled,
          duration: duration || 'permanent',
          message: `Pi-hole blocking ${enabled ? 'enabled' : 'disabled'}`
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/dns/stats/history
   * Get historical performance metrics from database
   */
  getHistoricalStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { period = '24h' } = req.query;
      
      const stats = await this.dnsModel.getHistoricalMetrics(period as string);

      res.json({
        success: true,
        data: {
          stats,
          period,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError('Failed to retrieve historical stats', 500));
    }
  };
}