import { Router, Request, Response } from 'express';

export const alertsRouter = Router();

alertsRouter.get('/', async (req: Request, res: Response) => {
  // TODO: Get all alerts
  res.json({ alerts: [] });
});

alertsRouter.get('/:id', async (req: Request, res: Response) => {
  // TODO: Get single alert
  res.json({ alert: null });
});

alertsRouter.post('/', async (req: Request, res: Response) => {
  // TODO: Create alert
  res.json({ message: 'Alert created' });
});

alertsRouter.put('/:id', async (req: Request, res: Response) => {
  // TODO: Update alert
  res.json({ message: 'Alert updated' });
});

alertsRouter.delete('/:id', async (req: Request, res: Response) => {
  // TODO: Delete alert
  res.json({ message: 'Alert deleted' });
});

alertsRouter.get('/:id/history', async (req: Request, res: Response) => {
  // TODO: Get alert history
  res.json({ history: [] });
});