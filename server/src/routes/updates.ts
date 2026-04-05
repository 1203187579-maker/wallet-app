import express from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse, generateId } from '../utils';

const router = express.Router();

/**
 * 检查更新
 * GET /api/v1/updates/check
 * Query: platform, currentVersion, buildNumber
 * 
 * 兼容 Expo Updates 协议的检查接口
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const { platform, currentVersion, buildNumber, runtimeVersion } = req.query;

    // 获取客户端平台
    const clientPlatform = (platform as string)?.toLowerCase() || 'android';
    const clientVersion = (currentVersion as string) || '1.0.0';
    const clientBuildNumber = parseInt(buildNumber as string) || 1;

    const client = getSupabaseClient();

    // 查询最新版本
    const { data: latestVersion, error } = await client
      .from('app_versions')
      .select('*')
      .eq('platform', clientPlatform)
      .eq('is_active', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Query latest version error:', error);
      return res.json({
        message: 'ok',
        currentUpdateId: null,
      });
    }

    // 没有找到版本信息或已经是最新版本
    if (!latestVersion) {
      return res.json({
        message: 'ok',
        currentUpdateId: null,
      });
    }

    // 判断是否需要更新
    const needsUpdate = latestVersion.build_number > clientBuildNumber || 
                        compareVersions(latestVersion.version, clientVersion) > 0;

    if (!needsUpdate) {
      return res.json({
        message: 'ok',
        currentUpdateId: null,
      });
    }

    // 返回更新信息
    const response: any = {
      message: 'update_available',
      currentUpdateId: generateId(),
      latestVersion: latestVersion.version,
      buildNumber: latestVersion.build_number,
      updateType: latestVersion.update_type,
      isForceUpdate: latestVersion.is_force_update,
      updateNotes: latestVersion.update_notes,
      updateUrl: latestVersion.update_url,
      // Expo Updates 协议兼容字段
      directives: latestVersion.update_type === 'force' ? {
        type: 'reload',
        message: latestVersion.update_notes,
      } : undefined,
    };

    // 如果有热更新包地址
    if (latestVersion.update_bundle_url) {
      response.updateBundleUrl = latestVersion.update_bundle_url;
    }

    res.json(response);
  } catch (error) {
    console.error('Check update error:', error);
    res.json({
      message: 'ok',
      currentUpdateId: null,
    });
  }
});

/**
 * 获取最新版本信息
 * GET /api/v1/updates/latest
 * Query: platform
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const { platform } = req.query;
    const clientPlatform = (platform as string)?.toLowerCase() || 'android';

    const client = getSupabaseClient();

    const { data: latestVersion, error } = await client
      .from('app_versions')
      .select('*')
      .eq('platform', clientPlatform)
      .eq('is_active', true)
      .order('build_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json(errorResponse('获取版本信息失败'));
    }

    res.json(successResponse(latestVersion));
  } catch (error) {
    console.error('Get latest version error:', error);
    res.status(500).json(errorResponse('获取版本信息失败'));
  }
});

/**
 * 记录更新日志
 * POST /api/v1/updates/log
 * Body: { user_id?, device_id?, platform, current_version, target_version, update_status, error_message? }
 */
router.post('/log', async (req: Request, res: Response) => {
  try {
    const { user_id, device_id, platform, current_version, target_version, update_status, error_message } = req.body;

    const client = getSupabaseClient();

    await client.from('update_logs').insert({
      id: generateId(),
      user_id,
      device_id,
      platform,
      current_version,
      target_version,
      update_status,
      error_message,
    });

    res.json(successResponse(null, '记录成功'));
  } catch (error) {
    console.error('Log update error:', error);
    res.json(successResponse(null)); // 静默失败
  }
});

// ==================== 管理端接口 ====================

/**
 * 获取版本列表（管理端）
 * GET /api/v1/updates/admin/list
 * Query: platform?, page?, limit?
 */
router.get('/admin/list', async (req: Request, res: Response) => {
  try {
    const { platform, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const client = getSupabaseClient();

    let query = client
      .from('app_versions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, count, error } = await query
      .range(offset, offset + parseInt(limit as string) - 1);

    if (error) {
      return res.status(500).json(errorResponse('获取版本列表失败'));
    }

    res.json(successResponse({
      list: data,
      total: count,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    }));
  } catch (error) {
    console.error('Get version list error:', error);
    res.status(500).json(errorResponse('获取版本列表失败'));
  }
});

/**
 * 创建新版本（管理端）
 * POST /api/v1/updates/admin/create
 * Body: { version, build_number, platform, is_force_update?, update_type?, update_url?, update_notes?, update_bundle_url?, min_version? }
 */
router.post('/admin/create', async (req: Request, res: Response) => {
  try {
    const {
      version,
      build_number,
      platform,
      is_force_update = false,
      update_type = 'optional',
      update_url,
      update_notes,
      update_bundle_url,
      min_version,
    } = req.body;

    if (!version || !build_number || !platform) {
      return res.status(400).json(errorResponse('版本号、构建号和平台不能为空'));
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('app_versions')
      .insert({
        id: generateId(),
        version,
        build_number,
        platform: platform.toLowerCase(),
        is_force_update,
        update_type,
        update_url,
        update_notes,
        update_bundle_url,
        min_version,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json(errorResponse('该版本已存在'));
      }
      return res.status(500).json(errorResponse('创建版本失败'));
    }

    res.json(successResponse(data, '创建成功'));
  } catch (error) {
    console.error('Create version error:', error);
    res.status(500).json(errorResponse('创建版本失败'));
  }
});

/**
 * 更新版本信息（管理端）
 * PUT /api/v1/updates/admin/:id
 */
router.put('/admin/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      version,
      build_number,
      platform,
      is_force_update,
      update_type,
      update_url,
      update_notes,
      update_bundle_url,
      min_version,
      is_active,
    } = req.body;

    const client = getSupabaseClient();

    const updateData: any = { updated_at: new Date().toISOString() };
    if (version !== undefined) updateData.version = version;
    if (build_number !== undefined) updateData.build_number = build_number;
    if (platform !== undefined) updateData.platform = platform.toLowerCase();
    if (is_force_update !== undefined) updateData.is_force_update = is_force_update;
    if (update_type !== undefined) updateData.update_type = update_type;
    if (update_url !== undefined) updateData.update_url = update_url;
    if (update_notes !== undefined) updateData.update_notes = update_notes;
    if (update_bundle_url !== undefined) updateData.update_bundle_url = update_bundle_url;
    if (min_version !== undefined) updateData.min_version = min_version;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await client
      .from('app_versions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json(errorResponse('更新版本失败'));
    }

    if (!data) {
      return res.status(404).json(errorResponse('版本不存在'));
    }

    res.json(successResponse(data, '更新成功'));
  } catch (error) {
    console.error('Update version error:', error);
    res.status(500).json(errorResponse('更新版本失败'));
  }
});

/**
 * 删除版本（管理端）
 * DELETE /api/v1/updates/admin/:id
 */
router.delete('/admin/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const client = getSupabaseClient();

    const { error } = await client
      .from('app_versions')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json(errorResponse('删除版本失败'));
    }

    res.json(successResponse(null, '删除成功'));
  } catch (error) {
    console.error('Delete version error:', error);
    res.status(500).json(errorResponse('删除版本失败'));
  }
});

/**
 * 发布热更新（管理端）
 * POST /api/v1/updates/admin/publish
 * Body: { version, platform, update_bundle_url, update_notes?, is_force_update? }
 */
router.post('/admin/publish', async (req: Request, res: Response) => {
  try {
    const { version, platform, update_bundle_url, update_notes, is_force_update = false } = req.body;

    if (!version || !platform || !update_bundle_url) {
      return res.status(400).json(errorResponse('版本号、平台和更新包地址不能为空'));
    }

    const client = getSupabaseClient();

    // 查找版本记录
    const { data: existingVersion } = await client
      .from('app_versions')
      .select('*')
      .eq('version', version)
      .eq('platform', platform.toLowerCase())
      .maybeSingle();

    if (existingVersion) {
      // 更新现有版本
      const { data, error } = await client
        .from('app_versions')
        .update({
          update_bundle_url,
          update_notes,
          is_force_update,
          update_type: is_force_update ? 'force' : 'optional',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVersion.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json(errorResponse('发布热更新失败'));
      }

      res.json(successResponse(data, '发布成功'));
    } else {
      // 创建新版本记录
      const { data, error } = await client
        .from('app_versions')
        .insert({
          id: generateId(),
          version,
          build_number: 1,
          platform: platform.toLowerCase(),
          update_bundle_url,
          update_notes,
          is_force_update,
          update_type: is_force_update ? 'force' : 'optional',
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json(errorResponse('发布热更新失败'));
      }

      res.json(successResponse(data, '发布成功'));
    }
  } catch (error) {
    console.error('Publish update error:', error);
    res.status(500).json(errorResponse('发布热更新失败'));
  }
});

/**
 * 获取更新日志（管理端）
 * GET /api/v1/updates/admin/logs
 * Query: platform?, update_status?, page?, limit?
 */
router.get('/admin/logs', async (req: Request, res: Response) => {
  try {
    const { platform, update_status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const client = getSupabaseClient();

    let query = client
      .from('update_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (platform) {
      query = query.eq('platform', platform);
    }
    if (update_status) {
      query = query.eq('update_status', update_status);
    }

    const { data, count, error } = await query
      .range(offset, offset + parseInt(limit as string) - 1);

    if (error) {
      return res.status(500).json(errorResponse('获取更新日志失败'));
    }

    res.json(successResponse({
      list: data,
      total: count,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    }));
  } catch (error) {
    console.error('Get update logs error:', error);
    res.status(500).json(errorResponse('获取更新日志失败'));
  }
});

// 版本比较函数
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

export default router;
