import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../storage/database/db';
import { tokenPrices } from '../storage/database/shared/schema';
import { successResponse, errorResponse } from '../utils';
import { asc } from 'drizzle-orm';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const prices = await db.select()
      .from(tokenPrices)
      .orderBy(asc(tokenPrices.token_symbol));

    res.json(successResponse({ prices }));
  } catch (error: any) {
    console.error('Get prices error:', error);
    res.status(500).json(errorResponse(error.message || '获取价格失败'));
  }
});

export default router;
