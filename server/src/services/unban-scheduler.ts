/**
 * 自动解封定时任务服务
 * 处理：到期自动解封用户、到期自动解除功能禁用
 */

import { getSupabaseClient } from '../storage/database/supabase-client';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * 启动自动解封定时任务
 * 每小时检查一次到期的封禁和功能禁用
 */
export function startUnbanScheduler() {
  if (schedulerInterval) {
    console.log('[UnbanScheduler] 已在运行中');
    return;
  }

  console.log('[UnbanScheduler] Starting...');

  // 立即执行一次
  processExpiredBans();
  processExpiredFeatureDisables();

  // 每小时执行一次
  schedulerInterval = setInterval(() => {
    processExpiredBans();
    processExpiredFeatureDisables();
  }, 60 * 60 * 1000); // 1小时

  console.log('[UnbanScheduler] Started');
}

/**
 * 停止定时任务
 */
export function stopUnbanScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[UnbanScheduler] Stopped');
  }
}

/**
 * 处理到期的封禁
 */
async function processExpiredBans() {
  try {
    console.log('[UnbanScheduler] Running tasks...');
    
    const client = getSupabaseClient();
    const now = new Date().toISOString();

    // 查找所有已到期但仍被封禁的用户
    const { data: expiredUsers, error: findError } = await client
      .from('users')
      .select('id, nickname, banned_until')
      .eq('is_banned', true)
      .not('banned_until', 'is', null)
      .lte('banned_until', now);

    if (findError) {
      console.error('[UnbanScheduler] Find expired users error:', findError);
      return;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('[UnbanScheduler] No expired bans found');
      return;
    }

    console.log(`[UnbanScheduler] Found ${expiredUsers.length} users to unban`);

    // 批量解封
    const userIds = expiredUsers.map((u: any) => u.id);
    
    const { error: updateError } = await client
      .from('users')
      .update({ 
        is_banned: false, 
        banned_until: null, 
        ban_reason: null,
        updated_at: now 
      })
      .in('id', userIds);

    if (updateError) {
      console.error('[UnbanScheduler] Update error:', updateError);
      return;
    }

    console.log(`[UnbanScheduler] Successfully unbanned ${userIds.length} users`);
    expiredUsers.forEach((u: any) => {
      console.log(`[UnbanScheduler] - Unbanned: ${u.nickname || u.id}`);
    });

  } catch (error) {
    console.error('[UnbanScheduler] Error:', error);
  }
}

/**
 * 处理到期的功能禁用
 */
async function processExpiredFeatureDisables() {
  try {
    console.log('[FeatureDisableScheduler] Running tasks...');
    
    const client = getSupabaseClient();
    const now = new Date().toISOString();

    // 查找所有有功能禁用的用户
    const { data: usersWithDisabledFeatures, error: findError } = await client
      .from('users')
      .select('id, nickname, disabled_features, disabled_features_detail')
      .not('disabled_features', 'eq', '[]')
      .not('disabled_features', 'is', null);

    if (findError) {
      console.error('[FeatureDisableScheduler] Find users error:', findError);
      return;
    }

    if (!usersWithDisabledFeatures || usersWithDisabledFeatures.length === 0) {
      console.log('[FeatureDisableScheduler] No users with disabled features');
      return;
    }

    let updatedCount = 0;

    for (const user of usersWithDisabledFeatures as any[]) {
      const disabledFeatures = user.disabled_features || [];
      const detail = user.disabled_features_detail || {};
      
      // 过滤掉已过期的功能
      const activeFeatures: string[] = [];
      const activeDetail: Record<string, any> = {};
      let hasExpired = false;

      for (const feature of disabledFeatures) {
        const featureDetail = detail[feature];
        
        // 如果没有设置到期时间（永久）或者还没到期，保留
        if (!featureDetail?.until || new Date(featureDetail.until) > new Date(now)) {
          activeFeatures.push(feature);
          if (featureDetail) {
            activeDetail[feature] = featureDetail;
          }
        } else {
          hasExpired = true;
          console.log(`[FeatureDisableScheduler] Feature "${feature}" expired for user ${user.nickname || user.id}`);
        }
      }

      // 如果有过期的功能，更新用户记录
      if (hasExpired) {
        const { error: updateError } = await client
          .from('users')
          .update({ 
            disabled_features: activeFeatures,
            disabled_features_detail: activeDetail,
            updated_at: now 
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('[FeatureDisableScheduler] Update error for user:', user.id, updateError);
        } else {
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      console.log(`[FeatureDisableScheduler] Updated ${updatedCount} users with expired features`);
    } else {
      console.log('[FeatureDisableScheduler] No expired feature disables found');
    }

  } catch (error) {
    console.error('[FeatureDisableScheduler] Error:', error);
  }
}
