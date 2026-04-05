import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse } from '../utils';

const router = Router();

/**
 * 获取公告列表（前端用户端）
 * GET /api/v1/announcements
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, type, is_popup, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get announcements error:', error);
      return res.status(500).json({ success: false, message: '获取公告列表失败' });
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: '获取公告列表失败' });
  }
});

/**
 * 获取弹窗公告（首页弹窗用）
 * GET /api/v1/announcements/popup
 */
router.get('/popup', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, type')
      .eq('is_active', true)
      .eq('is_popup', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Get popup announcements error:', error);
      return res.status(500).json({ success: false, message: '获取弹窗公告失败' });
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Get popup announcements error:', error);
    res.status(500).json({ success: false, message: '获取弹窗公告失败' });
  }
});

/**
 * 获取单条公告详情
 * GET /api/v1/announcements/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get announcement detail error:', error);
    res.status(500).json({ success: false, message: '获取公告详情失败' });
  }
});

export default router;
