import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();

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

/**
 * GET /api/v1/support/messages
 * 获取用户的客服消息历史
 * Headers: Authorization: Bearer <token>
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('support_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data?.map((msg: any) => ({
        id: msg.id,
        senderType: msg.sender_type,
        senderId: msg.sender_id,
        message: msg.message,
        messageType: msg.message_type,
        isRead: msg.is_read,
        createdAt: msg.created_at,
      })) || [],
    });
  } catch (error) {
    console.error('Get support messages error:', error);
    res.status(500).json({ success: false, message: '获取消息失败' });
  }
});

/**
 * POST /api/v1/support/messages
 * 用户发送客服消息
 * Headers: Authorization: Bearer <token>
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const { message, messageType = 'text' } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }

    const client = getSupabaseClient();

    // 保存用户消息
    const { data: newMessage, error } = await client
      .from('support_messages')
      .insert({
        user_id: userId,
        sender_type: 'user',
        message,
        message_type: messageType,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;

    // 检查AI自动回复是否开启
    const { data: aiSetting } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'support_ai_auto_reply')
      .maybeSingle();

    const aiAutoReplyEnabled = aiSetting?.config_value === 'true';

    // AI自动回复
    if (aiAutoReplyEnabled) {
      try {
        // 获取用户信息
        const { data: userData } = await client
          .from('users')
          .select('nickname, phone')
          .eq('id', userId)
          .single();

        const userName = userData?.nickname || userData?.phone || '用户';

        // 获取最近的对话历史（最多10条）
        const { data: recentMessages } = await client
          .from('support_messages')
          .select('sender_type, message')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        // 构建对话历史
        const conversationHistory = [];
        if (recentMessages && recentMessages.length > 0) {
          // 反转顺序，从旧到新
          const orderedMessages = recentMessages.reverse();
          for (const msg of orderedMessages) {
            const role = msg.sender_type === 'user' ? 'user' : 'assistant';
            conversationHistory.push({ role, content: msg.message });
          }
        }

        // 调用LLM生成回复
        const customHeaders = HeaderUtils.extractForwardHeaders(
          req.headers as Record<string, string>
        );
        const config = new Config();
        const llmClient = new LLMClient(config, customHeaders);

        const systemPrompt = `你是一个专业的客服助手，为BoostAra区块链钱包和C2C交易平台的用户提供帮助。
用户名：${userName}

你需要帮助用户解答以下类型的问题：
1. 账户相关问题（注册、登录、KYC认证等）
2. 钱包操作（充值、提现、转账等）
3. C2C交易问题（买卖流程、申诉处理等）
4. DeFi质押相关
5. 其他平台功能咨询

代币说明：
- AI：平台治理代币，用于行情显示和交易
- GPU：平台功能代币，用于C2C交易和质押

回答要求：
- 简洁友好，避免过于技术化的术语
- 如果无法解决用户问题，建议用户等待人工客服回复
- 不要编造信息，如果不确定，请诚实告知`;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];
        
        // 添加对话历史
        for (const msg of conversationHistory) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }

        const response = await llmClient.invoke(messages, {
          temperature: 0.7,
          model: 'doubao-seed-1-6-lite-251015', // 使用轻量模型，快速响应
        });

        // 保存AI回复
        await client.from('support_messages').insert({
          user_id: userId,
          sender_type: 'ai',
          message: response.content,
          message_type: 'text',
          is_read: false,
        });

        // 返回用户消息和AI回复
        const { data: allMessages } = await client
          .from('support_messages')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        return res.json({
          success: true,
          data: {
            message: {
              id: newMessage.id,
              senderType: 'user',
              message,
              messageType,
              createdAt: newMessage.created_at,
            },
            aiReplied: true,
            allMessages: allMessages?.map((msg: any) => ({
              id: msg.id,
              senderType: msg.sender_type,
              senderId: msg.sender_id,
              message: msg.message,
              messageType: msg.message_type,
              isRead: msg.is_read,
              createdAt: msg.created_at,
            })),
          },
        });
      } catch (aiError) {
        console.error('AI auto reply error:', aiError);
        // AI回复失败，仍然返回用户消息成功
      }
    }

    res.json({
      success: true,
      data: {
        message: {
          id: newMessage.id,
          senderType: 'user',
          message,
          messageType,
          createdAt: newMessage.created_at,
        },
        aiReplied: false,
      },
    });
  } catch (error) {
    console.error('Send support message error:', error);
    res.status(500).json({ success: false, message: '发送消息失败' });
  }
});

/**
 * GET /api/v1/support/unread-count
 * 获取用户未读消息数量
 * Headers: Authorization: Bearer <token>
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();
    const { count, error } = await client
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('sender_type', 'user')
      .eq('is_read', false);

    if (error) throw error;

    res.json({
      success: true,
      data: { count: count || 0 },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: '获取未读数量失败' });
  }
});

/**
 * POST /api/v1/support/mark-read
 * 标记消息为已读
 * Headers: Authorization: Bearer <token>
 */
router.post('/mark-read', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权' });
    }

    const client = getSupabaseClient();
    await client
      .from('support_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .neq('sender_type', 'user');

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

export default router;
