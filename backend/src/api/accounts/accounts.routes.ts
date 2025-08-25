import { Router, Request, Response } from 'express';

export const accountsRouter = Router();

accountsRouter.get('/', async (req: Request, res: Response) => {
  // TODO: Get all accounts
  res.json({ accounts: [] });
});

accountsRouter.get('/:id', async (req: Request, res: Response) => {
  // TODO: Get single account
  res.json({ account: null });
});

accountsRouter.post('/', async (req: Request, res: Response) => {
  // TODO: Create account
  res.json({ message: 'Account created' });
});

accountsRouter.put('/:id', async (req: Request, res: Response) => {
  // TODO: Update account
  res.json({ message: 'Account updated' });
});

accountsRouter.delete('/:id', async (req: Request, res: Response) => {
  // TODO: Delete account
  res.json({ message: 'Account deleted' });
});