import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { checkFeatureDisabled } from '../utils';

const router = Router();

// 配置multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 初始化 S3 对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 辅助函数：从请求中获取用户ID
async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const client = getSupabaseClient();

  const { data: session } = await client
    .from('user_sessions')
    .select('user_id')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  return session?.user_id || null;
}

// 辅助函数：获取用户信息（包含功能禁用检查）
async function getUserWithFeatureCheck(req: Request, feature: 'plaza' | 'referral' | 'kyc' | 'asset' | 'wallet'): Promise<{ userId: string; user: any } | { error: { status: number; message: string } }> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { status: 401, message: '未授权' } };
  }

  const token = authHeader.substring(7);
  const client = getSupabaseClient();

  const { data: session } = await client
    .from('user_sessions')
    .select('user_id, users(is_active, disabled_features)')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (!session) {
    return { error: { status: 401, message: '无效的 token' } };
  }

  const user = session.users as any;
  const featureCheck = checkFeatureDisabled(user, feature);
  if (featureCheck.disabled) {
    return { error: { status: 403, message: featureCheck.message! } };
  }

  return { userId: session.user_id, user };
}

// 辅助函数：标准化用户ID格式（UUID带连字符）
function normalizeUserId(userId: string): string {
  if (userId.includes('-')) return userId;
  // 将无连字符的UUID转为带连字符格式
  return `${userId.slice(0,8)}-${userId.slice(8,12)}-${userId.slice(12,16)}-${userId.slice(16,20)}-${userId.slice(20)}`;
}

// ==================== 群组管理 ====================

/**
 * GET /api/v1/plaza/groups
 * 获取群组列表（公开群 + 用户加入的群）
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { page = 1, pageSize = 20 } = req.query;
    const client = getSupabaseClient();

    // 获取公开群列表
    const { data: publicGroups, error } = await client
      .from('chat_groups')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range((Number(page) - 1) * Number(pageSize), Number(page) * Number(pageSize) - 1);

    if (error) throw error;

    // 获取用户已加入的群
    const { data: joinedGroups } = await client
      .from('chat_group_members')
      .select('group_id')
      .eq('user_id', userId);

    // 标记用户是否已加入
    const joinedGroupIds = new Set(joinedGroups?.map((g: any) => g.group_id) || []);

    // 获取群主信息
    const ownerIds = [...new Set((publicGroups || []).map((g: any) => g.owner_id))];
    let ownerMap: Record<string, any> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await client
        .from('users')
        .select('id, nickname, phone')
        .in('id', ownerIds);
      (owners || []).forEach((o: any) => {
        ownerMap[o.id] = o;
      });
    }

    const groups = (publicGroups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatarUrl: g.avatar_url,
      ownerId: g.owner_id,
      ownerName: ownerMap[g.owner_id]?.nickname || ownerMap[g.owner_id]?.phone,
      memberCount: g.member_count || 0,
      isJoined: joinedGroupIds.has(g.id),
      createdAt: g.created_at,
    }));

    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ success: false, message: '获取群组失败' });
  }
});

/**
 * GET /api/v1/plaza/my-groups
 * 获取用户加入的群组
 */
router.get('/my-groups', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();

    // 获取用户加入的群
    const { data: memberships, error } = await client
      .from('chat_group_members')
      .select('group_id, role, nickname, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    // 获取群组详情
    const groupIds = (memberships || []).map((m: any) => m.group_id);
    let groupsData: any[] = [];
    if (groupIds.length > 0) {
      const { data: groups } = await client
        .from('chat_groups')
        .select('id, name, description, avatar_url, member_count')
        .in('id', groupIds);
      groupsData = groups || [];
    }

    const groupMap = new Map(groupsData.map((g: any) => [g.id, g]));

    const groups = (memberships || []).map((item: any) => {
      const group = groupMap.get(item.group_id) || {};
      return {
        id: item.group_id,
        name: group.name,
        description: group.description,
        avatarUrl: group.avatar_url,
        memberCount: group.member_count || 0,
        role: item.role,
        nickname: item.nickname,
        joinedAt: item.joined_at,
        isJoined: true,
      };
    });

    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Get my groups error:', error);
    res.status(500).json({ success: false, message: '获取我的群组失败' });
  }
});

/**
 * POST /api/v1/plaza/groups
 * 创建群组
 */
router.post('/groups', async (req: Request, res: Response) => {
  try {
    const userCheck = await getUserWithFeatureCheck(req, 'plaza');
    if ('error' in userCheck) {
      return res.status(userCheck.error.status).json({ success: false, message: userCheck.error.message });
    }
    const { userId } = userCheck;

    const { name, description, avatarUrl, isPublic = true, settings } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '群名称不能为空' });
    }

    const client = getSupabaseClient();

    // 创建群组
    const { data: group, error: groupError } = await client
      .from('chat_groups')
      .insert({
        name,
        description,
        avatar_url: avatarUrl,
        owner_id: userId,
        is_public: isPublic,
        settings: settings || {
          allowImage: true,
          allowVideo: true,
          allowAddFriend: true,
          bannedWords: [],
          onlyAdminCanSend: false,
        },
        member_count: 1,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // 创建群主成员记录
    const { error: memberError } = await client
      .from('chat_group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'owner',
      });

    if (memberError) throw memberError;

    res.json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        description: group.description,
        avatarUrl: group.avatar_url,
        ownerId: group.owner_id,
        memberCount: group.member_count,
        createdAt: group.created_at,
      },
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ success: false, message: '创建群组失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/join
 * 加入群组
 */
router.post('/groups/:groupId/join', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查群组是否存在
    const { data: group } = await client
      .from('chat_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({ success: false, message: '群组不存在' });
    }

    // 检查是否已加入
    const { data: existingMember } = await client
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ success: false, message: '已加入该群组' });
    }

    // 加入群组
    const { error } = await client
      .from('chat_group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role: 'member',
      });

    if (error) throw error;

    // 更新成员数
    await client
      .from('chat_groups')
      .update({ member_count: (group.member_count || 0) + 1 })
      .eq('id', groupId);

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      group_id: groupId,
      sender_type: 'system',
      message: '有新成员加入群聊',
    });

    res.json({ success: true, message: '加入成功' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ success: false, message: '加入群组失败' });
  }
});

// ==================== 群机器人管理 ====================

/**
 * GET /api/v1/plaza/groups/:groupId/bots
 * 获取群组的机器人列表
 */
router.get('/groups/:groupId/bots', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查用户是否是群成员
    const { data: membership } = await client
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ success: false, message: '您不是该群成员' });
    }

    // 获取群内的机器人关联
    const { data: groupBots, error: botsError } = await client
      .from('chat_group_bots')
      .select('id, bot_id, added_by, created_at')
      .eq('group_id', groupId);

    if (botsError) throw botsError;

    // 如果没有机器人，直接返回空数组
    if (!groupBots || groupBots.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 获取机器人详情
    const botIds = groupBots.map((b: any) => b.bot_id);
    const { data: aiBots, error: aiBotsError } = await client
      .from('ai_bots')
      .select('id, name, description, avatar_url, trigger_keywords, is_active')
      .in('id', botIds);

    if (aiBotsError) throw aiBotsError;

    // 合并数据
    const botMap = new Map((aiBots || []).map((b: any) => [b.id, b]));
    const botList = groupBots.map((gb: any) => {
      const bot = botMap.get(gb.bot_id);
      return {
        id: gb.id,
        botId: gb.bot_id,
        name: bot?.name || '未知机器人',
        description: bot?.description || '',
        avatarUrl: bot?.avatar_url,
        triggerKeywords: bot?.trigger_keywords || [],
        isActive: bot?.is_active,
        addedBy: gb.added_by,
        createdAt: gb.created_at,
      };
    });

    res.json({ success: true, data: botList });
  } catch (error) {
    console.error('Get group bots error:', error);
    res.status(500).json({ success: false, message: '获取群机器人失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/bots
 * 添加机器人到群组（仅群主和管理员）
 */
router.post('/groups/:groupId/bots', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { botId } = req.body;

    if (!botId) {
      return res.status(400).json({ success: false, message: '请选择要添加的机器人' });
    }

    const client = getSupabaseClient();

    // 检查用户权限（群主或管理员）
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: '只有群主或管理员可以添加机器人' });
    }

    // 检查机器人是否存在且启用
    const { data: bot } = await client
      .from('ai_bots')
      .select('id, name, is_active')
      .eq('id', botId)
      .single();

    if (!bot) {
      return res.status(404).json({ success: false, message: '机器人不存在' });
    }

    if (!bot.is_active) {
      return res.status(400).json({ success: false, message: '该机器人已禁用' });
    }

    // 检查是否已添加
    const { data: existing } = await client
      .from('chat_group_bots')
      .select('id')
      .eq('group_id', groupId)
      .eq('bot_id', botId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ success: false, message: '该机器人已在群中' });
    }

    // 添加机器人
    const { error } = await client
      .from('chat_group_bots')
      .insert({
        group_id: groupId,
        bot_id: botId,
        added_by: userId,
      });

    if (error) throw error;

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      message: `机器人「${bot.name}」已加入群聊`,
      message_type: 'system',
    });

    res.json({ success: true, message: '机器人已添加到群组' });
  } catch (error) {
    console.error('Add bot to group error:', error);
    res.status(500).json({ success: false, message: '添加机器人失败' });
  }
});

/**
 * DELETE /api/v1/plaza/groups/:groupId/bots/:botId
 * 移除机器人（仅群主和管理员）
 */
router.delete('/groups/:groupId/bots/:botId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId, botId } = req.params;
    const client = getSupabaseClient();

    // 检查用户权限
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: '只有群主或管理员可以移除机器人' });
    }

    // 获取机器人信息
    const { data: botRel } = await client
      .from('chat_group_bots')
      .select('bot_id')
      .eq('id', botId)
      .single();

    let botName = '机器人';
    if (botRel?.bot_id) {
      const { data: aiBot } = await client
        .from('ai_bots')
        .select('name')
        .eq('id', botRel.bot_id)
        .single();
      botName = aiBot?.name || '机器人';
    }

    // 删除机器人
    const { error } = await client
      .from('chat_group_bots')
      .delete()
      .eq('id', botId)
      .eq('group_id', groupId);

    if (error) throw error;

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      message: `机器人「${botName}」已退出群聊`,
      message_type: 'system',
    });

    res.json({ success: true, message: '机器人已移除' });
  } catch (error) {
    console.error('Remove bot from group error:', error);
    res.status(500).json({ success: false, message: '移除机器人失败' });
  }
});

/**
 * GET /api/v1/plaza/available-bots
 * 获取所有可用的AI机器人列表（用于添加到群）
 */
router.get('/available-bots', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();

    const { data: bots, error } = await client
      .from('ai_bots')
      .select('id, name, description, avatar_url, trigger_keywords')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: (bots || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        avatarUrl: b.avatar_url,
        triggerKeywords: b.trigger_keywords || [],
      })),
    });
  } catch (error) {
    console.error('Get available bots error:', error);
    res.status(500).json({ success: false, message: '获取机器人列表失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/invite
 * 邀请好友进群
 */
router.post('/groups/:groupId/invite', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { friendIds } = req.body; // 好友ID数组

    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要邀请的好友' });
    }

    const client = getSupabaseClient();

    // 检查邀请者是否是群成员
    const { data: inviterMembership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', normalizeUserId(userId))
      .maybeSingle();

    if (!inviterMembership) {
      return res.status(403).json({ success: false, message: '您不是该群成员' });
    }

    // 获取群组信息
    const { data: group } = await client
      .from('chat_groups')
      .select('name, member_count, max_members')
      .eq('id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({ success: false, message: '群组不存在' });
    }

    // 检查群人数限制
    const newCount = group.member_count + friendIds.length;
    if (newCount > (group.max_members || 500)) {
      return res.status(400).json({ success: false, message: '群人数已达上限' });
    }

    // 过滤掉已是群成员的好友
    const { data: existingMembers } = await client
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .in('user_id', friendIds);

    const existingUserIds = new Set((existingMembers || []).map((m: any) => m.user_id));
    const newFriendIds = friendIds.filter((id: string) => !existingUserIds.has(id));

    if (newFriendIds.length === 0) {
      return res.status(400).json({ success: false, message: '所选好友已在群中' });
    }

    // 批量添加成员
    const membersToInsert = newFriendIds.map((friendId: string) => ({
      group_id: groupId,
      user_id: friendId,
      role: 'member',
    }));

    const { error: insertError } = await client
      .from('chat_group_members')
      .insert(membersToInsert);

    if (insertError) throw insertError;

    // 更新群成员数量
    await client
      .from('chat_groups')
      .update({ member_count: group.member_count + newFriendIds.length })
      .eq('id', groupId);

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      content: `${newFriendIds.length} 位新成员加入群聊`,
      message: `${newFriendIds.length} 位新成员加入群聊`,
      message_type: 'system',
    });

    res.json({ 
      success: true, 
      message: `成功邀请 ${newFriendIds.length} 位好友加入群聊`,
      data: { invitedCount: newFriendIds.length }
    });
  } catch (error) {
    console.error('Invite friends error:', error);
    res.status(500).json({ success: false, message: '邀请失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/leave
 * 退出群组
 */
router.post('/groups/:groupId/leave', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查成员身份
    const { data: member } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!member) {
      return res.status(400).json({ success: false, message: '未加入该群组' });
    }

    // 群主不能退出，只能解散
    if (member.role === 'owner') {
      return res.status(400).json({ success: false, message: '群主不能退出群组，请转让群主或解散群组' });
    }

    // 退出群组
    await client
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    // 更新成员数
    await client.rpc('decrement_group_member_count', { group_id: groupId });

    res.json({ success: true, message: '已退出群组' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ success: false, message: '退出群组失败' });
  }
});

// ==================== 群消息 ====================

/**
 * GET /api/v1/plaza/groups/:groupId/messages
 * 获取群消息
 */
router.get('/groups/:groupId/messages', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { limit = 50, before } = req.query;
    const client = getSupabaseClient();

    // 检查是否是群成员
    const { data: membership } = await client
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', normalizeUserId(userId))
      .maybeSingle();

    if (!membership) {
      console.log('[Get Messages] User not a member:', { userId, groupId });
      return res.status(403).json({ success: false, message: '无权访问' });
    }

    // 获取消息
    let query = client
      .from('chat_group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (before) {
      query = query.lt('created_at', before as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    const messages = (data || []).reverse().map((msg: any) => ({
      id: msg.id,
      senderId: msg.sender_id,
      senderType: msg.sender_type,
      message: msg.message,
      messageType: msg.message_type,
      extraData: msg.extra_data,
      createdAt: msg.created_at,
    }));

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: '获取消息失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/messages
 * 发送群消息
 */
router.post('/groups/:groupId/messages', async (req: Request, res: Response) => {
  try {
    const userCheck = await getUserWithFeatureCheck(req, 'plaza');
    if ('error' in userCheck) {
      return res.status(userCheck.error.status).json({ success: false, message: userCheck.error.message });
    }
    const { userId } = userCheck;

    const groupIdParam = req.params.groupId;
    const groupId: string = Array.isArray(groupIdParam) ? groupIdParam[0] : (groupIdParam || '');
    const { message: msgContent, messageType = 'text', extraData } = req.body;
    // 确保 message 是字符串类型
    let message: string;
    if (typeof msgContent === 'string') {
      message = msgContent;
    } else if (Array.isArray(msgContent)) {
      message = msgContent[0] || '';
    } else {
      message = String(msgContent || '');
    }

    if (!message) {
      return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }

    const client = getSupabaseClient();

    // 检查成员身份和权限
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role, muted')
      .eq('group_id', groupId)
      .eq('user_id', normalizeUserId(userId))
      .maybeSingle();

    if (!membership) {
      console.log('[Send Message] User not a member:', { userId, groupId });
      return res.status(403).json({ success: false, message: '无权发送消息' });
    }

    if (membership.muted) {
      return res.status(403).json({ success: false, message: '您已被禁言' });
    }

    // 检查群设置
    const { data: group } = await client
      .from('chat_groups')
      .select('settings')
      .eq('id', groupId)
      .single();

    const settings = group?.settings as any;

    // 检查违禁词
    if (settings?.bannedWords?.length > 0) {
      const bannedWords = settings.bannedWords as string[];
      const hasBannedWord = bannedWords.some(word => 
        message.toLowerCase().includes(word.toLowerCase())
      );
      if (hasBannedWord) {
        return res.status(400).json({ success: false, message: '消息包含违禁词' });
      }
    }

    // 检查图片视频权限
    if (messageType === 'image' && !settings?.allowImage) {
      return res.status(403).json({ success: false, message: '群组禁止发送图片' });
    }
    if (messageType === 'video' && !settings?.allowVideo) {
      return res.status(403).json({ success: false, message: '群组禁止发送视频' });
    }

    // 检查是否仅管理员可发言
    if (settings?.onlyAdminCanSend && membership.role === 'member') {
      return res.status(403).json({ success: false, message: '仅管理员可发言' });
    }

    // 保存消息
    const { data: newMessage, error } = await client
      .from('chat_group_messages')
      .insert({
        group_id: groupId,
        sender_id: userId,
        sender_type: 'user',
        content: message,
        message,
        message_type: messageType,
        extra_data: extraData,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        id: newMessage.id,
        senderId: userId,
        senderType: 'user',
        message,
        messageType,
        extraData,
        createdAt: newMessage.created_at,
      },
    });

    // 异步检查是否需要AI机器人回复
    if (message) {
      checkAiBotResponse(groupId, String(message), client);
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: '发送消息失败' });
  }
});

// AI机器人响应检查
async function checkAiBotResponse(groupId: string, messageInput: any, client: any) {
  try {
    // 确保 message 是字符串
    const message = Array.isArray(messageInput) ? (messageInput[0] || '') : String(messageInput || '');
    if (!message) return;
    
    // 获取群内的AI机器人关联
    const { data: groupBots } = await client
      .from('chat_group_bots')
      .select('bot_id')
      .eq('group_id', groupId);

    if (!groupBots || groupBots.length === 0) return;

    // 获取机器人详情
    const botIds = groupBots.map((b: any) => b.bot_id);
    const { data: aiBots } = await client
      .from('ai_bots')
      .select('id, name, system_prompt, model, trigger_keywords, is_active')
      .in('id', botIds);

    if (!aiBots || aiBots.length === 0) return;

    // 检查是否@了机器人
    const mentionPattern = /@([^\s]+)/g;
    const mentions = message.match(mentionPattern);
    const lowerMessage = message.toLowerCase();

    for (const botData of aiBots) {
      if (!botData.is_active) continue;

      let shouldRespond = false;

      // 1. 检查是否@了机器人名称
      const botMentioned = mentions?.some((m: string) => 
        m.toLowerCase().includes(botData.name.toLowerCase())
      );
      if (botMentioned) shouldRespond = true;

      // 2. 检查消息是否包含机器人名称
      if (!shouldRespond && lowerMessage.includes(botData.name.toLowerCase())) {
        shouldRespond = true;
      }

      // 3. 检查是否触发关键词
      if (!shouldRespond && botData.trigger_keywords && botData.trigger_keywords.length > 0) {
        for (const keyword of botData.trigger_keywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            shouldRespond = true;
            break;
          }
        }
      }

      if (shouldRespond) {
        // 调用AI生成回复
        const config = new Config();
        const llmClient = new LLMClient(config);

        const messages = [
          { role: 'system' as const, content: botData.system_prompt },
          { role: 'user' as const, content: message },
        ];

        const response = await llmClient.invoke(messages, {
          model: botData.model || 'doubao-seed-1-6-lite-251015',
          temperature: 0.7,
        });

        // 保存AI回复
        await client.from('chat_group_messages').insert({
          group_id: groupId,
          sender_id: botData.id,
          sender_type: 'ai_bot',
          message: response.content,
          message_type: 'text',
        });
      }
    }
  } catch (error) {
    console.error('AI bot response error:', error);
  }
}

// ==================== 红包 ====================

/**
 * POST /api/v1/plaza/red-packets
 * 发红包
 */
router.post('/red-packets', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId, totalAmount, totalCount, packetType = 'random', message = '恭喜发财，大吉大利' } = req.body;

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ success: false, message: '红包金额无效' });
    }

    if (!totalCount || totalCount <= 0 || totalCount > 100) {
      return res.status(400).json({ success: false, message: '红包数量无效' });
    }

    const client = getSupabaseClient();

    // 检查用户余额
    const { data: asset } = await client
      .from('assets')
      .select('balance')
      .eq('user_id', userId)
      .eq('token_symbol', 'AI')
      .single();

    const balance = parseFloat(asset?.balance || '0');
    if (balance < totalAmount) {
      return res.status(400).json({ success: false, message: '余额不足' });
    }

    // 扣减余额
    await client
      .from('assets')
      .update({ balance: (balance - totalAmount).toString() })
      .eq('user_id', userId)
      .eq('token_symbol', 'AI');

    // 创建红包
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时过期

    const { data: redPacket, error } = await client
      .from('red_packets')
      .insert({
        group_id: groupId || null,
        sender_id: userId,
        total_amount: totalAmount.toString(),
        total_count: totalCount,
        remaining_amount: totalAmount.toString(),
        remaining_count: totalCount,
        packet_type: packetType,
        message,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // 发送红包消息到群
    if (groupId) {
      await client.from('chat_group_messages').insert({
        group_id: groupId,
        sender_id: userId,
        sender_type: 'user',
        message: message,
        message_type: 'red_packet',
        extra_data: { redPacketId: redPacket.id },
      });
    }

    res.json({
      success: true,
      data: {
        id: redPacket.id,
        totalAmount,
        totalCount,
        message,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Create red packet error:', error);
    res.status(500).json({ success: false, message: '发红包失败' });
  }
});

/**
 * POST /api/v1/plaza/red-packets/:id/claim
 * 领取红包
 */
router.post('/red-packets/:id/claim', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    // 获取红包信息
    const { data: redPacket, error: rpError } = await client
      .from('red_packets')
      .select('*')
      .eq('id', id)
      .single();

    if (rpError || !redPacket) {
      return res.status(404).json({ success: false, message: '红包不存在' });
    }

    // 检查红包状态
    if (redPacket.status !== 'active') {
      return res.status(400).json({ success: false, message: '红包已结束' });
    }

    if (new Date(redPacket.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: '红包已过期' });
    }

    if (redPacket.remaining_count <= 0) {
      return res.status(400).json({ success: false, message: '红包已被抢完' });
    }

    // 检查是否已领取
    const { data: existingClaim } = await client
      .from('red_packet_claims')
      .select('id')
      .eq('red_packet_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingClaim) {
      return res.status(400).json({ success: false, message: '已领取过该红包' });
    }

    // 计算领取金额
    let claimAmount: number;
    const remainingAmount = parseFloat(redPacket.remaining_amount);
    const remainingCount = redPacket.remaining_count;

    if (redPacket.packet_type === 'fixed') {
      claimAmount = parseFloat(redPacket.total_amount) / redPacket.total_count;
    } else {
      // 随机金额
      if (remainingCount === 1) {
        claimAmount = remainingAmount;
      } else {
        // 随机分配，但保证每个人至少能领到0.01
        const minAmount = 0.01;
        const maxAmount = remainingAmount - (remainingCount - 1) * minAmount;
        claimAmount = Math.random() * (maxAmount - minAmount) + minAmount;
        claimAmount = Math.round(claimAmount * 100) / 100;
      }
    }

    // 记录领取
    await client.from('red_packet_claims').insert({
      red_packet_id: id,
      user_id: userId,
      amount: claimAmount.toString(),
    });

    // 更新红包剩余
    const newRemainingAmount = remainingAmount - claimAmount;
    const newRemainingCount = remainingCount - 1;

    await client
      .from('red_packets')
      .update({
        remaining_amount: newRemainingAmount.toString(),
        remaining_count: newRemainingCount,
        status: newRemainingCount === 0 ? 'finished' : 'active',
      })
      .eq('id', id);

    // 增加用户余额
    const { data: asset } = await client
      .from('assets')
      .select('balance')
      .eq('user_id', userId)
      .eq('token_symbol', 'AI')
      .single();

    const currentBalance = parseFloat(asset?.balance || '0');
    await client
      .from('assets')
      .update({ balance: (currentBalance + claimAmount).toString() })
      .eq('user_id', userId)
      .eq('token_symbol', 'AI');

    res.json({
      success: true,
      data: {
        amount: claimAmount,
        message: redPacket.message,
      },
    });
  } catch (error) {
    console.error('Claim red packet error:', error);
    res.status(500).json({ success: false, message: '领取红包失败' });
  }
});

/**
 * GET /api/v1/plaza/red-packets/:id
 * 获取红包详情
 */
router.get('/red-packets/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { id } = req.params;
    const client = getSupabaseClient();

    const { data: redPacket, error } = await client
      .from('red_packets')
      .select(`
        *,
        sender:users!red_packets_sender_id_fkey(id, nickname, phone),
        claims:red_packet_claims(
          user_id,
          amount,
          claimed_at,
          user:users(id, nickname, phone)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !redPacket) {
      return res.status(404).json({ success: false, message: '红包不存在' });
    }

    // 检查当前用户是否已领取
    const myClaim = redPacket.claims?.find((c: any) => c.user_id === userId);

    res.json({
      success: true,
      data: {
        id: redPacket.id,
        senderId: redPacket.sender_id,
        senderName: redPacket.sender?.nickname || redPacket.sender?.phone,
        totalAmount: redPacket.total_amount,
        totalCount: redPacket.total_count,
        remainingAmount: redPacket.remaining_amount,
        remainingCount: redPacket.remaining_count,
        packetType: redPacket.packet_type,
        message: redPacket.message,
        status: redPacket.status,
        claims: redPacket.claims?.map((c: any) => ({
          userId: c.user_id,
          userName: c.user?.nickname || c.user?.phone,
          amount: c.amount,
          claimedAt: c.claimed_at,
        })),
        myAmount: myClaim?.amount,
        createdAt: redPacket.created_at,
      },
    });
  } catch (error) {
    console.error('Get red packet error:', error);
    res.status(500).json({ success: false, message: '获取红包详情失败' });
  }
});

// ==================== 好友 ====================

/**
 * POST /api/v1/plaza/friends/request
 * 发送好友请求
 */
router.post('/friends/request', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { friendId, requestMessage } = req.body;

    if (!friendId || friendId === userId) {
      return res.status(400).json({ success: false, message: '无效的好友ID' });
    }

    const client = getSupabaseClient();

    // 检查是否已是好友或已有请求
    const { data: existing } = await client
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ success: false, message: '已是好友' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ success: false, message: '已有待处理的好友请求' });
      }
    }

    // 创建好友请求
    const { error } = await client
      .from('friendships')
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: 'pending',
        request_message: requestMessage,
      });

    if (error) throw error;

    res.json({ success: true, message: '好友请求已发送' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ success: false, message: '发送好友请求失败' });
  }
});

/**
 * POST /api/v1/plaza/friends/:id/respond
 * 响应好友请求
 */
router.post('/friends/:id/respond', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { id } = req.params;
    const { accept } = req.body;
    const client = getSupabaseClient();

    // 检查请求是否存在
    const { data: friendship } = await client
      .from('friendships')
      .select('*')
      .eq('id', id)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .single();

    if (!friendship) {
      return res.status(404).json({ success: false, message: '好友请求不存在' });
    }

    // 更新状态
    await client
      .from('friendships')
      .update({
        status: accept ? 'accepted' : 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.json({ success: true, message: accept ? '已添加好友' : '已拒绝' });
  } catch (error) {
    console.error('Friend respond error:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

/**
 * GET /api/v1/plaza/friends
 * 获取好友列表
 */
router.get('/friends', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();

    // 获取已接受的好友
    const { data: sentFriends, error: e1 } = await client
      .from('friendships')
      .select(`
        id,
        friend_id,
        created_at,
        friend:users!friendships_friend_id_fkey(id, nickname, phone, avatar_url)
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    const { data: receivedFriends, error: e2 } = await client
      .from('friendships')
      .select(`
        id,
        user_id,
        created_at,
        friend:users!friendships_user_id_fkey(id, nickname, phone, avatar_url)
      `)
      .eq('friend_id', userId)
      .eq('status', 'accepted');

    const friends = [
      ...(sentFriends || []).map((f: any) => ({
        id: f.id,
        friendId: f.friend_id,
        nickname: f.friend?.nickname,
        phone: f.friend?.phone,
        avatarUrl: f.friend?.avatar_url,
        createdAt: f.created_at,
      })),
      ...(receivedFriends || []).map((f: any) => ({
        id: f.id,
        friendId: f.user_id,
        nickname: f.friend?.nickname,
        phone: f.friend?.phone,
        avatarUrl: f.friend?.avatar_url,
        createdAt: f.created_at,
      })),
    ];

    res.json({ success: true, data: friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ success: false, message: '获取好友列表失败' });
  }
});

/**
 * GET /api/v1/plaza/friends/requests
 * 获取好友请求列表
 */
router.get('/friends/requests', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();

    const { data } = await client
      .from('friendships')
      .select(`
        id,
        user_id,
        request_message,
        created_at,
        user:users!friendships_user_id_fkey(id, nickname, phone, avatar_url)
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const requests = (data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      nickname: r.user?.nickname,
      phone: r.user?.phone,
      avatarUrl: r.user?.avatar_url,
      requestMessage: r.request_message,
      createdAt: r.created_at,
    }));

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ success: false, message: '获取好友请求失败' });
  }
});

// ==================== 群设置管理 ====================

/**
 * GET /api/v1/plaza/groups/:groupId/settings
 * 获取群设置和成员列表
 */
router.get('/groups/:groupId/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 获取群组信息
    const { data: group, error: groupError } = await client
      .from('chat_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ success: false, message: '群组不存在' });
    }

    // 获取成员列表
    const { data: members, error: membersError } = await client
      .from('chat_group_members')
      .select('id, user_id, role, joined_at, nickname, is_pinned, is_muted')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (membersError) throw membersError;

    // 获取成员用户信息
    const userIds = (members || []).map((m: any) => m.user_id);
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, nickname, phone')
        .in('id', userIds);
      (users || []).forEach((u: any) => {
        userMap[u.id] = u;
      });
    }

    const membersList = (members || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      userName: userMap[m.user_id]?.nickname || userMap[m.user_id]?.phone || '未知用户',
      role: m.role,
      joinedAt: m.joined_at,
      nickname: m.nickname,
      isPinned: m.is_pinned,
      isMuted: m.is_muted,
    }));

    res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          avatarUrl: group.avatar_url,
          ownerId: group.owner_id,
          memberCount: group.member_count,
          announcement: group.announcement,
          joinSetting: group.join_setting,
          messageFrequency: group.message_frequency,
          messageFrequencyLimit: group.message_frequency_limit,
          autoDelete: group.auto_delete,
          autoDeleteDays: group.auto_delete_days,
          capacity: group.capacity,
          createdAt: group.created_at,
        },
        members: membersList,
      },
    });
  } catch (error) {
    console.error('Get group settings error:', error);
    res.status(500).json({ success: false, message: '获取群设置失败' });
  }
});

/**
 * PUT /api/v1/plaza/groups/:groupId
 * 更新群信息（仅群主）
 */
router.put('/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { name, description, avatarUrl } = req.body;
    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: group } = await client
      .from('chat_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== userId) {
      return res.status(403).json({ success: false, message: '只有群主可以修改群信息' });
    }

    // 更新群信息
    const { error } = await client
      .from('chat_groups')
      .update({
        name,
        description,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (error) throw error;

    res.json({ success: true, message: '群信息已更新' });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ success: false, message: '更新群信息失败' });
  }
});

/**
 * PUT /api/v1/plaza/groups/:groupId/members/:memberUserId/role
 * 设置成员角色（仅群主）
 */
router.put('/groups/:groupId/members/:memberUserId/role', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId, memberUserId } = req.params;
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: group } = await client
      .from('chat_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== userId) {
      return res.status(403).json({ success: false, message: '只有群主可以设置管理员' });
    }

    // 不能修改群主的角色
    if (memberUserId === group.owner_id) {
      return res.status(400).json({ success: false, message: '不能修改群主的角色' });
    }

    // 更新成员角色
    const { error } = await client
      .from('chat_group_members')
      .update({ role })
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);

    if (error) throw error;

    res.json({ success: true, message: '角色已更新' });
  } catch (error) {
    console.error('Set member role error:', error);
    res.status(500).json({ success: false, message: '设置角色失败' });
  }
});

/**
 * DELETE /api/v1/plaza/groups/:groupId/members/:memberUserId
 * 踢出成员（仅群主）
 */
router.delete('/groups/:groupId/members/:memberUserId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId, memberUserId } = req.params;
    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: group } = await client
      .from('chat_groups')
      .select('owner_id, member_count')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== userId) {
      return res.status(403).json({ success: false, message: '只有群主可以踢出成员' });
    }

    // 不能踢出群主
    if (memberUserId === group.owner_id) {
      return res.status(400).json({ success: false, message: '不能踢出群主' });
    }

    // 删除成员
    const { error } = await client
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);

    if (error) throw error;

    // 更新成员数
    await client
      .from('chat_groups')
      .update({ member_count: Math.max(0, (group.member_count || 1) - 1) })
      .eq('id', groupId);

    res.json({ success: true, message: '成员已移出' });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ success: false, message: '踢出成员失败' });
  }
});

/**
 * DELETE /api/v1/plaza/groups/:groupId
 * 解散群组（仅群主）
 */
router.delete('/groups/:groupId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: group } = await client
      .from('chat_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== userId) {
      return res.status(403).json({ success: false, message: '只有群主可以解散群组' });
    }

    // 删除所有成员
    await client
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId);

    // 删除所有消息
    await client
      .from('chat_messages')
      .delete()
      .eq('group_id', groupId);

    // 删除群组
    await client
      .from('chat_groups')
      .delete()
      .eq('id', groupId);

    res.json({ success: true, message: '群组已解散' });
  } catch (error) {
    console.error('Dismiss group error:', error);
    res.status(500).json({ success: false, message: '解散群组失败' });
  }
});

// ==================== 群机器人管理 ====================

/**
 * GET /api/v1/plaza/groups/:groupId/bots
 * 获取群组的机器人列表
 */
router.get('/groups/:groupId/bots', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查用户是否是群成员
    const { data: membership } = await client
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ success: false, message: '您不是该群成员' });
    }

    // 获取群内的机器人关联
    const { data: groupBots, error: botsError } = await client
      .from('chat_group_bots')
      .select('id, bot_id, added_by, created_at')
      .eq('group_id', groupId);

    if (botsError) throw botsError;

    // 如果没有机器人，直接返回空数组
    if (!groupBots || groupBots.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 获取机器人详情
    const botIds = groupBots.map((b: any) => b.bot_id);
    const { data: aiBots, error: aiBotsError } = await client
      .from('ai_bots')
      .select('id, name, description, avatar_url, trigger_keywords, is_active')
      .in('id', botIds);

    if (aiBotsError) throw aiBotsError;

    // 合并数据
    const botMap = new Map((aiBots || []).map((b: any) => [b.id, b]));
    const botList = groupBots.map((gb: any) => {
      const bot = botMap.get(gb.bot_id);
      return {
        id: gb.id,
        botId: gb.bot_id,
        name: bot?.name || '未知机器人',
        description: bot?.description || '',
        avatarUrl: bot?.avatar_url,
        triggerKeywords: bot?.trigger_keywords || [],
        isActive: bot?.is_active,
        addedBy: gb.added_by,
        createdAt: gb.created_at,
      };
    });

    res.json({ success: true, data: botList });
  } catch (error) {
    console.error('Get group bots error:', error);
    res.status(500).json({ success: false, message: '获取群机器人失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/bots
 * 添加机器人到群组（仅群主和管理员）
 */
router.post('/groups/:groupId/bots', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { botId } = req.body;

    if (!botId) {
      return res.status(400).json({ success: false, message: '请选择要添加的机器人' });
    }

    const client = getSupabaseClient();

    // 检查用户权限（群主或管理员）
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: '只有群主或管理员可以添加机器人' });
    }

    // 检查机器人是否存在且启用
    const { data: bot } = await client
      .from('ai_bots')
      .select('id, name, is_active')
      .eq('id', botId)
      .single();

    if (!bot) {
      return res.status(404).json({ success: false, message: '机器人不存在' });
    }

    if (!bot.is_active) {
      return res.status(400).json({ success: false, message: '该机器人已禁用' });
    }

    // 检查是否已添加
    const { data: existing } = await client
      .from('chat_group_bots')
      .select('id')
      .eq('group_id', groupId)
      .eq('bot_id', botId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ success: false, message: '该机器人已在群中' });
    }

    // 添加机器人
    const { error } = await client
      .from('chat_group_bots')
      .insert({
        group_id: groupId,
        bot_id: botId,
        added_by: userId,
      });

    if (error) throw error;

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      message: `机器人「${bot.name}」已加入群聊`,
      message_type: 'system',
    });

    res.json({ success: true, message: '机器人已添加到群组' });
  } catch (error) {
    console.error('Add bot to group error:', error);
    res.status(500).json({ success: false, message: '添加机器人失败' });
  }
});

/**
 * DELETE /api/v1/plaza/groups/:groupId/bots/:botId
 * 移除机器人（仅群主和管理员）
 */
router.delete('/groups/:groupId/bots/:botId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId, botId } = req.params;
    const client = getSupabaseClient();

    // 检查用户权限
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: '只有群主或管理员可以移除机器人' });
    }

    // 获取机器人信息
    const { data: botRel } = await client
      .from('chat_group_bots')
      .select('bot_id')
      .eq('id', botId)
      .single();

    let botName = '机器人';
    if (botRel?.bot_id) {
      const { data: aiBot } = await client
        .from('ai_bots')
        .select('name')
        .eq('id', botRel.bot_id)
        .single();
      botName = aiBot?.name || '机器人';
    }

    // 删除机器人
    const { error } = await client
      .from('chat_group_bots')
      .delete()
      .eq('id', botId)
      .eq('group_id', groupId);

    if (error) throw error;

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      message: `机器人「${botName}」已退出群聊`,
      message_type: 'system',
    });

    res.json({ success: true, message: '机器人已移除' });
  } catch (error) {
    console.error('Remove bot from group error:', error);
    res.status(500).json({ success: false, message: '移除机器人失败' });
  }
});

/**
 * GET /api/v1/plaza/available-bots
 * 获取所有可用的AI机器人列表（用于添加到群）
 */
router.get('/available-bots', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();

    const { data: bots, error } = await client
      .from('ai_bots')
      .select('id, name, description, avatar_url, trigger_keywords')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: (bots || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        avatarUrl: b.avatar_url,
        triggerKeywords: b.trigger_keywords || [],
      })),
    });
  } catch (error) {
    console.error('Get available bots error:', error);
    res.status(500).json({ success: false, message: '获取机器人列表失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/invite
 * 邀请好友进群
 */
router.post('/groups/:groupId/invite', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { friendIds } = req.body; // 好友ID数组

    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要邀请的好友' });
    }

    const client = getSupabaseClient();

    // 检查邀请者是否是群成员
    const { data: inviterMembership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', normalizeUserId(userId))
      .maybeSingle();

    if (!inviterMembership) {
      return res.status(403).json({ success: false, message: '您不是该群成员' });
    }

    // 获取群组信息
    const { data: group } = await client
      .from('chat_groups')
      .select('name, member_count, max_members')
      .eq('id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({ success: false, message: '群组不存在' });
    }

    // 检查群人数限制
    const newCount = group.member_count + friendIds.length;
    if (newCount > (group.max_members || 500)) {
      return res.status(400).json({ success: false, message: '群人数已达上限' });
    }

    // 过滤掉已是群成员的好友
    const { data: existingMembers } = await client
      .from('chat_group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .in('user_id', friendIds);

    const existingUserIds = new Set((existingMembers || []).map((m: any) => m.user_id));
    const newFriendIds = friendIds.filter((id: string) => !existingUserIds.has(id));

    if (newFriendIds.length === 0) {
      return res.status(400).json({ success: false, message: '所选好友已在群中' });
    }

    // 批量添加成员
    const membersToInsert = newFriendIds.map((friendId: string) => ({
      group_id: groupId,
      user_id: friendId,
      role: 'member',
    }));

    const { error: insertError } = await client
      .from('chat_group_members')
      .insert(membersToInsert);

    if (insertError) throw insertError;

    // 更新群成员数量
    await client
      .from('chat_groups')
      .update({ member_count: group.member_count + newFriendIds.length })
      .eq('id', groupId);

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      content: `${newFriendIds.length} 位新成员加入群聊`,
      message: `${newFriendIds.length} 位新成员加入群聊`,
      message_type: 'system',
    });

    res.json({ 
      success: true, 
      message: `成功邀请 ${newFriendIds.length} 位好友加入群聊`,
      data: { invitedCount: newFriendIds.length }
    });
  } catch (error) {
    console.error('Invite friends error:', error);
    res.status(500).json({ success: false, message: '邀请失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/leave
 * 退出群组
 */
router.post('/groups/:groupId/leave', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: group } = await client
      .from('chat_groups')
      .select('owner_id, member_count')
      .eq('id', groupId)
      .single();

    if (!group) {
      return res.status(404).json({ success: false, message: '群组不存在' });
    }

    if (group.owner_id === userId) {
      return res.status(400).json({ success: false, message: '群主不能退出群组，请先解散群组或转让群主' });
    }

    // 删除成员记录
    const { error } = await client
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;

    // 更新成员数
    await client
      .from('chat_groups')
      .update({ member_count: Math.max(0, (group.member_count || 1) - 1) })
      .eq('id', groupId);

    res.json({ success: true, message: '已退出群组' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ success: false, message: '退出群组失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/avatar
 * 上传群头像（仅群主）
 */
router.post('/groups/:groupId/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: '未找到上传文件' });
    }

    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ success: false, message: '只有群主可以更换群头像' });
    }

    const { buffer, originalname, mimetype } = req.file;
    
    // 生成文件名
    const ext = originalname.split('.').pop() || 'jpg';
    const fileName = `group-avatars/${groupId}/${Date.now()}.${ext}`;
    
    let avatarUrl: string;
    
    try {
      // 上传到 S3 对象存储
      const fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: fileName,
        contentType: mimetype,
      });

      // 生成签名 URL（有效期 30 天）
      avatarUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 30 * 24 * 60 * 60, // 30 天
      });
    } catch (storageError) {
      console.error('Upload avatar to S3 storage error:', storageError);
      // 降级：返回 base64 数据 URL
      const base64 = buffer.toString('base64');
      avatarUrl = `data:${mimetype};base64,${base64}`;
    }

    // 更新群头像
    const { error: updateError } = await client
      .from('chat_groups')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', groupId);

    if (updateError) throw updateError;

    res.json({ success: true, message: '头像已更新', data: { avatarUrl } });
  } catch (error) {
    console.error('Upload group avatar error:', error);
    res.status(500).json({ success: false, message: '上传头像失败' });
  }
});

/**
 * PUT /api/v1/plaza/groups/:groupId/settings
 * 更新群设置（群主和管理员）
 */
router.put('/groups/:groupId/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const {
      name,
      description,
      announcement,
      joinSetting,
      messageFrequency,
      messageFrequencyLimit,
      autoDelete,
      autoDeleteDays,
      capacity,
    } = req.body;

    const client = getSupabaseClient();

    // 检查是否是群主或管理员
    const { data: membership } = await client
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: '只有群主或管理员可以修改群设置' });
    }

    // 构建更新对象
    const updateData: any = { updated_at: new Date().toISOString() };

    // 只有群主可以修改基本信息
    if (membership.role === 'owner') {
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (capacity !== undefined) updateData.capacity = capacity;
    }

    // 群主和管理员都可以修改的设置
    if (announcement !== undefined) updateData.announcement = announcement;
    if (joinSetting !== undefined) updateData.join_setting = joinSetting;
    if (messageFrequency !== undefined) updateData.message_frequency = messageFrequency;
    if (messageFrequencyLimit !== undefined) updateData.message_frequency_limit = messageFrequencyLimit;
    if (autoDelete !== undefined) updateData.auto_delete = autoDelete;
    if (autoDeleteDays !== undefined) updateData.auto_delete_days = autoDeleteDays;

    // 更新群设置
    const { error } = await client
      .from('chat_groups')
      .update(updateData)
      .eq('id', groupId);

    if (error) throw error;

    res.json({ success: true, message: '群设置已更新' });
  } catch (error) {
    console.error('Update group settings error:', error);
    res.status(500).json({ success: false, message: '更新群设置失败' });
  }
});

/**
 * PUT /api/v1/plaza/groups/:groupId/member-settings
 * 更新当前用户的群成员设置（置顶、免打扰、群昵称）
 */
router.put('/groups/:groupId/member-settings', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { isPinned, isMuted, nickname } = req.body;

    const client = getSupabaseClient();

    // 检查是否是群成员
    const { data: membership } = await client
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ success: false, message: '您不是该群成员' });
    }

    // 构建更新对象
    const updateData: any = {};
    if (isPinned !== undefined) updateData.is_pinned = isPinned;
    if (isMuted !== undefined) updateData.is_muted = isMuted;
    if (nickname !== undefined) updateData.nickname = nickname;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的设置' });
    }

    // 更新成员设置
    const { error } = await client
      .from('chat_group_members')
      .update(updateData)
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, message: '设置已更新' });
  } catch (error) {
    console.error('Update member settings error:', error);
    res.status(500).json({ success: false, message: '更新设置失败' });
  }
});

/**
 * GET /api/v1/plaza/capacity-config
 * 获取群容量扩容配置
 */
router.get('/capacity-config', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();

    // 从系统配置获取扩容参数
    const { data: configs, error } = await client
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['capacity_base', 'capacity_price_per_hundred', 'capacity_currency']);

    if (error) throw error;

    const configMap = (configs || []).reduce((acc: any, config: any) => {
      acc[config.config_key] = config.config_value;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        baseCapacity: parseInt(configMap.capacity_base || '100'),
        pricePerHundred: configMap.capacity_price_per_hundred || '10',
        currency: configMap.capacity_currency || 'AI',
      },
    });
  } catch (error) {
    console.error('Get capacity config error:', error);
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

/**
 * POST /api/v1/plaza/groups/:groupId/expand-capacity
 * 扩容群容量（花费AI）
 */
router.post('/groups/:groupId/expand-capacity', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: '最小扩容数量为100人' });
    }

    const client = getSupabaseClient();

    // 获取扩容配置
    const { data: configs } = await client
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['capacity_base', 'capacity_price_per_hundred', 'capacity_currency']);

    const configMap = (configs || []).reduce((acc: any, config: any) => {
      acc[config.config_key] = config.config_value;
      return acc;
    }, {});

    const baseCapacity = parseInt(configMap.capacity_base || '100');
    const pricePerHundred = parseFloat(configMap.capacity_price_per_hundred || '10');
    const currency = configMap.capacity_currency || 'AI';
    const totalCost = (amount / 100) * pricePerHundred;

    // 获取群信息
    const { data: group, error: groupError } = await client
      .from('chat_groups')
      .select('capacity')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ success: false, message: '群组不存在' });
    }

    // 检查当前容量是否已超过基础容量
    const currentCapacity = group.capacity || baseCapacity;
    if (currentCapacity < baseCapacity) {
      // 如果当前容量小于基础容量，先免费补充到基础容量
      const freeAmount = Math.min(amount, baseCapacity - currentCapacity);
      if (freeAmount > 0) {
        await client
          .from('chat_groups')
          .update({ capacity: baseCapacity })
          .eq('id', groupId);
      }
    }

    // 检查用户AI余额
    const { data: aiAsset, error: assetError } = await client
      .from('assets')
      .select('balance')
      .eq('user_id', userId)
      .eq('token_symbol', currency)
      .maybeSingle();

    if (assetError) throw assetError;

    const aiBalance = parseFloat(aiAsset?.balance || '0');
    if (aiBalance < totalCost) {
      return res.status(400).json({ 
        success: false, 
        message: `余额不足，需要 ${totalCost} ${currency}，当前余额 ${aiBalance.toFixed(2)} ${currency}` 
      });
    }

    // 扣除AI
    const newBalance = aiBalance - totalCost;
    const { error: deductError } = await client
      .from('assets')
      .update({ balance: newBalance.toString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token_symbol', currency);

    if (deductError) throw deductError;

    // 增加群容量
    const newCapacity = currentCapacity + amount;
    const { error: updateError } = await client
      .from('chat_groups')
      .update({ capacity: newCapacity, updated_at: new Date().toISOString() })
      .eq('id', groupId);

    if (updateError) throw updateError;

    // 记录扩容日志
    await client
      .from('capacity_expand_logs')
      .insert({
        group_id: groupId,
        user_id: userId,
        amount,
        cost: totalCost.toString(),
        currency,
        created_at: new Date().toISOString(),
      });

    res.json({ 
      success: true, 
      message: '扩容成功',
      data: {
        expandedAmount: amount,
        cost: totalCost,
        newCapacity,
      },
    });
  } catch (error) {
    console.error('Expand capacity error:', error);
    res.status(500).json({ success: false, message: '扩容失败' });
  }
});

/**
 * DELETE /api/v1/plaza/groups/:groupId/messages
 * 清除群聊天记录（仅群主）
 */
router.delete('/groups/:groupId/messages', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { groupId } = req.params;
    const client = getSupabaseClient();

    // 检查是否是群主
    const { data: group } = await client
      .from('chat_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (!group || group.owner_id !== userId) {
      return res.status(403).json({ success: false, message: '只有群主可以清除聊天记录' });
    }

    // 删除所有消息
    const { error } = await client
      .from('chat_group_messages')
      .delete()
      .eq('group_id', groupId);

    if (error) throw error;

    // 发送系统消息
    await client.from('chat_group_messages').insert({
      group_id: groupId,
      sender_id: 'system',
      sender_type: 'system',
      message: '群主已清空所有聊天记录',
      message_type: 'system',
    });

    res.json({ success: true, message: '聊天记录已清除' });
  } catch (error) {
    console.error('Clear messages error:', error);
    res.status(500).json({ success: false, message: '清除聊天记录失败' });
  }
});

export default router;
