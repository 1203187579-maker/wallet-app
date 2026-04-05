import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { successResponse, errorResponse, checkFeatureDisabled } from '../utils';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = express.Router();

/**
 * 随机生成活体检测动作
 */
function generateLivenessActions(): { action: string; label: string }[] {
  const allActions = [
    { action: 'blink', label: '眨眼' },
    { action: 'open_mouth', label: '张嘴' },
    { action: 'shake_head', label: '摇头' },
    { action: 'nod', label: '点头' },
  ];
  
  // 随机选择2-3个动作
  const count = 2 + Math.floor(Math.random() * 2);
  const shuffled = [...allActions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 清理和验证base64图片数据
 */
function cleanBase64Image(imageData: string): string {
  if (!imageData) {
    throw new Error('Empty image data');
  }
  
  // 先解码HTML实体（如 &#x2F; -> /）
  let cleanUrl = imageData
    .replace(/&#x2F;/g, '/')
    .replace(/&#x3D;/g, '=')
    .replace(/&#x2B;/g, '+')
    .replace(/&amp;/g, '&');
  
  // 如果已经是完整的 data URI，直接返回
  if (cleanUrl.startsWith('data:image/')) {
    // 验证格式是否正确
    const match = cleanUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (match && match[1].length > 0) {
      return cleanUrl;
    }
  }
  
  // 如果是纯 base64 字符串，添加前缀
  const cleanBase64 = cleanUrl.replace(/[\s\r\n]/g, '');
  return `data:image/jpeg;base64,${cleanBase64}`;
}

/**
 * 使用AI视觉模型进行活体检测
 * @param frames 视频关键帧（base64图片数组）
 * @param requiredActions 需要完成的动作
 * @returns 检测结果
 */
async function performLivenessDetection(
  frames: string[],
  requiredActions: string[]
): Promise<{ success: boolean; isLive: boolean; actionsDetected: string[]; message: string }> {
  try {
    const config = new Config();
    const client = new LLMClient(config);

    // 只使用前2帧，避免数据量过大
    const framesToUse = frames.slice(0, 2);
    
    // 清理并构建图片内容
    const imageContents = framesToUse.map((frame, index) => {
      const cleanUrl = cleanBase64Image(frame);
      console.log(`[KYC Liveness] Frame ${index}: length=${cleanUrl.length}, preview=${cleanUrl.substring(0, 60)}...`);
      return {
        type: 'image_url' as const,
        image_url: {
          url: cleanUrl,
          detail: 'low' as const,
        },
      };
    });

    const actionLabels: Record<string, string> = {
      'blink': '眨眼',
      'open_mouth': '张嘴',
      'shake_head': '摇头',
      'nod': '点头',
    };

    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `You are a professional liveness detection system. Analyze these ${frames.length} video frames from a KYC verification process.

CRITICAL TASKS:
1. DETECT if this is a REAL PERSON (not a photo, screen, or video playback)
   - Look for: skin texture, natural lighting, 3D face structure, depth
   - Reject if: flat image, screen reflection, paper edges, unnatural texture

2. VERIFY the person performed these required actions: ${requiredActions.map(a => actionLabels[a] || a).join(', ')}

ANALYSIS INSTRUCTIONS:
- Compare frames to detect motion and action changes
- Look for natural facial movements (eyes blinking, mouth opening, head turning)
- Check for signs of spoofing: static features, flat surfaces, moiré patterns

RESPOND IN JSON FORMAT ONLY:
{
  "is_live": true/false,
  "detected_actions": ["action1", "action2"],
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}

Answer ONLY with valid JSON, no other text.`
          },
          ...imageContents,
        ],
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.0,
    });

    const content = response.content.trim();
    console.log('[KYC Liveness] AI response:', content.substring(0, 200));

    // 解析JSON响应
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          isLive: result.is_live === true,
          actionsDetected: result.detected_actions || [],
          message: result.reason || (result.is_live ? '活体检测通过' : '未通过活体检测'),
        };
      }
    } catch (parseError) {
      console.error('[KYC Liveness] JSON parse error:', parseError);
    }

    // 如果无法解析，根据关键词判断
    const lowerContent = content.toLowerCase();
    const isLive = lowerContent.includes('"is_live": true') || 
                   lowerContent.includes('"is_live":true') ||
                   (lowerContent.includes('live') && !lowerContent.includes('not live'));

    return {
      success: true,
      isLive,
      actionsDetected: [],
      message: isLive ? '活体检测通过' : '未通过活体检测',
    };
  } catch (error) {
    console.error('[KYC Liveness] Detection error:', error);
    return {
      success: false,
      isLive: false,
      actionsDetected: [],
      message: '活体检测服务异常，请重试',
    };
  }
}

/**
 * 使用AI视觉模型比对人脸
 * @param newFaceImage 新提交的人脸图片（base64）
 * @param existingImage 已有的人脸图片（base64或URL）
 * @returns true: 是同一个人, false: 不是同一个人
 */
async function compareFaces(newFaceImage: string, existingImage: string): Promise<boolean> {
  try {
    const config = new Config();
    const client = new LLMClient(config);

    // 确保图片格式正确
    const newImageData = newFaceImage.startsWith('data:') ? newFaceImage : `data:image/jpeg;base64,${newFaceImage}`;
    const existingImageData = existingImage.startsWith('data:') ? existingImage : `data:image/jpeg;base64,${existingImage}`;

    const messages = [
      {
        role: 'user' as const,
        content: [
          { 
            type: 'text' as const, 
            text: `You are a professional face recognition system. Compare these two face photos.

CRITICAL INSTRUCTIONS:
1. Only answer "YES" if you are 100% CERTAIN they are the EXACT SAME PERSON
2. If there is ANY DOUBT, even slight differences in facial features, answer "NO"
3. Different people often have similar features - be extremely careful
4. Look for exact matches in: face shape, eye spacing, nose shape, lip shape, chin, ears
5. Consider that lighting, angle, and expression may differ slightly

Answer ONLY "YES" or "NO".` 
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: newImageData,
              detail: 'low' as const,
            },
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: existingImageData,
              detail: 'low' as const,
            },
          },
        ],
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.0, // 最低温度确保一致性
    });

    const answer = response.content.trim().toUpperCase();
    console.log('[KYC] Face comparison result:', answer);
    return answer === 'YES';
  } catch (error) {
    console.error('[KYC] Face comparison error:', error);
    return false; // 出错时默认不是同一人，允许继续
  }
}

/**
 * 获取KYC状态
 * GET /api/v1/kyc/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();

    // 验证会话并获取用户信息
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id, users(is_active, disabled_features)')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    const user = session.users as any;
    
    // 检查KYC功能是否被禁用
    const featureCheck = checkFeatureDisabled(user, 'kyc');
    if (featureCheck.disabled) {
      return res.status(403).json(errorResponse(featureCheck.message!));
    }

    // 查询KYC记录
    const { data: kycRecord } = await client
      .from('kyc_records')
      .select('*')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!kycRecord) {
      return res.json(successResponse({ status: 'none' }));
    }

    res.json(successResponse({
      status: kycRecord.status,
      reject_reason: kycRecord.reject_reason,
      submitted_at: kycRecord.created_at,
    }));
  } catch (error: any) {
    console.error('Get KYC status error:', error);
    res.status(500).json(errorResponse(error.message || '获取KYC状态失败'));
  }
});

/**
 * 提交KYC认证
 * POST /api/v1/kyc/submit
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { face_image, liveness_actions } = req.body;
    const client = getSupabaseClient();

    if (!face_image) {
      return res.status(400).json(errorResponse('请提供人脸照片'));
    }

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 检查是否已有通过或待审核的KYC
    const { data: existingKYC } = await client
      .from('kyc_records')
      .select('*')
      .eq('user_id', session.user_id)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingKYC) {
      if (existingKYC.status === 'approved') {
        return res.status(400).json(errorResponse('您已完成KYC认证'));
      } else {
        return res.status(400).json(errorResponse('您有待审核的KYC申请，请耐心等待'));
      }
    }

    // 检查系统配置：一个人脸可以绑定几个账号
    const { data: configData } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'kyc_max_accounts')
      .maybeSingle();
    
    // 默认一个人脸只能认证1个账号，配置为0表示不限制
    const maxAccountsPerFace = configData ? parseInt(configData.config_value) || 1 : 1;

    // 检查是否启用了AI人脸检测
    const { data: faceCheckConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'kyc_face_check_enabled')
      .maybeSingle();
    
    const faceCheckEnabled = faceCheckConfig?.config_value === 'true';

    // 如果启用了AI人脸检测且有人脸绑定限制，使用AI比对人脸
    if (faceCheckEnabled && maxAccountsPerFace > 0) {
      // 获取所有已通过KYC的记录（带人脸图片）
      // 限制查询最近100条，避免数据量过大
      const { data: approvedKYCs } = await client
        .from('kyc_records')
        .select('user_id, face_image, face_hash')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (approvedKYCs && approvedKYCs.length > 0) {
        // 过滤有效图片（至少1000字节的base64数据才算有效图片）
        const validKYCs = approvedKYCs.filter(kyc => 
          kyc.face_image && kyc.face_image.length > 1000
        );
        
        console.log(`[KYC] Found ${approvedKYCs.length} approved KYCs, ${validKYCs.length} with valid images`);
        
        if (validKYCs.length > 0) {
          // 使用Set记录已识别为同一人的用户ID
          const matchedUserIds = new Set<string>();
          
          // 逐一比对人脸（限制并发数）
          const BATCH_SIZE = 5; // 每次最多比对5张
          for (let i = 0; i < validKYCs.length; i += BATCH_SIZE) {
            const batch = validKYCs.slice(i, i + BATCH_SIZE);
            
            // 并发比对这个批次
            const comparisons = await Promise.all(
              batch.map(async (kyc) => {
                try {
                  const isSamePerson = await compareFaces(face_image, kyc.face_image!);
                  return isSamePerson ? kyc.user_id : null;
                } catch (e) {
                  console.error('[KYC] Compare error:', e);
                  return null;
                }
              })
            );
            
            // 收集匹配的用户ID
            comparisons.forEach((userId) => {
              if (userId && !matchedUserIds.has(userId)) {
                matchedUserIds.add(userId);
              }
            });
          }
          
          // 计算已绑定的账号数（排除当前用户自己）
          const boundAccountCount = Array.from(matchedUserIds).filter(
            (uid) => uid !== session.user_id
          ).length;
          
          console.log(`[KYC] Matched ${matchedUserIds.size} users, ${boundAccountCount} other accounts, max=${maxAccountsPerFace}, will reject=${boundAccountCount >= maxAccountsPerFace}`);
          
          // 如果已达上限，拒绝
          if (boundAccountCount >= maxAccountsPerFace) {
            console.log(`[KYC] REJECTING: Face already verified on ${boundAccountCount} other accounts`);
            return res.status(400).json(errorResponse(
              `检测到此人脸已在其他账号完成认证，每人脸仅限认证${maxAccountsPerFace}个账号`
            ));
          }
        }
      }
    }

    // 计算人脸hash（用于快速查询，虽然hash不准确，但可以作为辅助标识）
    const base64Data = face_image.includes(',') 
      ? face_image.split(',')[1] 
      : face_image;
    
    const faceHash = crypto
      .createHash('sha256')
      .update(base64Data)
      .digest('hex');

    // 检查是否开启自动审核
    const { data: autoApproveConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'kyc_auto_approve')
      .maybeSingle();
    
    const autoApprove = autoApproveConfig?.config_value === 'true';

    // 创建KYC记录
    const kycId = `kyc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const initialStatus = autoApprove ? 'approved' : 'pending';
    
    const { error: insertError } = await client
      .from('kyc_records')
      .insert({
        id: kycId,
        user_id: session.user_id,
        face_hash: faceHash,
        face_image: face_image, // 存储完整图片用于后续比对
        liveness_actions: liveness_actions,
        status: initialStatus,
      });

    if (insertError) {
      console.error('Insert KYC error:', insertError);
      return res.status(500).json(errorResponse('提交失败，请重试'));
    }

    // 如果自动审核通过，更新用户状态并发放奖励
    if (autoApprove) {
      console.log(`[KYC] Auto-approved KYC for user ${session.user_id}`);
      
      // 更新用户KYC状态
      await client
        .from('users')
        .update({ is_kyc_verified: true, updated_at: new Date().toISOString() })
        .eq('id', session.user_id);

      // 发放KYC奖励
      const { data: airdropConfig } = await client
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'kyc_airdrop_amount')
        .maybeSingle();
      
      const airdropAmount = airdropConfig ? parseFloat(airdropConfig.config_value) || 0 : 0;
      
      if (airdropAmount > 0) {
        // 获取或创建AI资产
        const { data: existingAsset } = await client
          .from('assets')
          .select('*')
          .eq('user_id', session.user_id)
          .eq('symbol', 'AI')
          .maybeSingle();
        
        if (existingAsset) {
          await client
            .from('assets')
            .update({ 
              balance: (parseFloat(existingAsset.balance) + airdropAmount).toString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAsset.id);
        } else {
          await client
            .from('assets')
            .insert({
              id: `asset_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              user_id: session.user_id,
              symbol: 'AI',
              name: 'AI Token',
              balance: airdropAmount.toString(),
              icon_url: 'https://example.com/ai.png',
            });
        }

        // 记录资产明细
        await client
          .from('asset_transactions')
          .insert({
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            user_id: session.user_id,
            type: 'kyc_reward',
            amount: airdropAmount.toString(),
            symbol: 'AI',
            description: 'KYC认证奖励',
          });
      }

      res.json(successResponse({
        kyc_id: kycId,
        status: 'approved',
        message: 'KYC认证已自动通过',
        auto_approved: true,
      }));
    } else {
      res.json(successResponse({
        kyc_id: kycId,
        status: 'pending',
        message: '提交成功，请等待审核',
      }));
    }
  } catch (error: any) {
    console.error('Submit KYC error:', error);
    res.status(500).json(errorResponse(error.message || '提交失败'));
  }
});

/**
 * 取消KYC申请
 * POST /api/v1/kyc/cancel
 */
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 取消待审核的KYC
    await client
      .from('kyc_records')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', session.user_id)
      .eq('status', 'pending');

    res.json(successResponse(null, '已取消'));
  } catch (error: any) {
    console.error('Cancel KYC error:', error);
    res.status(500).json(errorResponse(error.message || '取消失败'));
  }
});

/**
 * 获取活体检测动作
 * GET /api/v1/kyc/liveness/actions
 */
router.get('/liveness/actions', async (req: Request, res: Response) => {
  try {
    const actions = generateLivenessActions();
    res.json(successResponse({
      actions,
      expiresInSeconds: 60, // 动作60秒后过期
    }));
  } catch (error: any) {
    console.error('Get liveness actions error:', error);
    res.status(500).json(errorResponse(error.message || '获取失败'));
  }
});

/**
 * 活体检测验证
 * POST /api/v1/kyc/liveness/verify
 * Body: { frames: string[], requiredActions: string[] }
 */
router.post('/liveness/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('未授权访问'));
    }

    const token = authHeader.substring(7);
    const { frames, requiredActions } = req.body;

    console.log(`[KYC Liveness] Received request: frames=${frames?.length}, actions=${requiredActions?.join(',')}`);

    if (!frames || !Array.isArray(frames) || frames.length < 1) {
      return res.status(400).json(errorResponse('请提供视频画面'));
    }

    if (!requiredActions || !Array.isArray(requiredActions) || requiredActions.length === 0) {
      return res.status(400).json(errorResponse('缺少活体检测动作'));
    }

    const client = getSupabaseClient();

    // 验证会话
    const { data: session } = await client
      .from('user_sessions')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      return res.status(401).json(errorResponse('无效的 token'));
    }

    // 检查当前用户是否已通过KYC
    const { data: userKYC } = await client
      .from('kyc_records')
      .select('status')
      .eq('user_id', session.user_id)
      .eq('status', 'approved')
      .maybeSingle();

    if (userKYC) {
      return res.status(400).json(errorResponse('您已完成KYC认证'));
    }

    console.log(`[KYC Liveness] User ${session.user_id} verifying with ${frames.length} frames`);

    // 执行AI活体检测
    const result = await performLivenessDetection(frames, requiredActions);

    if (!result.success) {
      return res.status(500).json(errorResponse(result.message));
    }

    if (!result.isLive) {
      return res.status(400).json(errorResponse('活体检测未通过，请确保是真人在镜头前操作'));
    }

    console.log(`[KYC Liveness] Result: isLive=${result.isLive}, actions=${result.actionsDetected.join(',')}`);

    // 活体检测通过后，检查人脸是否已在其他账号认证过
    // 获取系统配置
    const { data: configData } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'kyc_max_accounts')
      .maybeSingle();
    
    const maxAccountsPerFace = configData ? parseInt(configData.config_value) || 1 : 1;

    const { data: faceCheckConfig } = await client
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'kyc_face_check_enabled')
      .maybeSingle();
    
    const faceCheckEnabled = faceCheckConfig?.config_value === 'true';

    console.log(`[KYC Liveness] Face check config: enabled=${faceCheckEnabled}, maxAccounts=${maxAccountsPerFace}`);

    // 如果启用了人脸检测且有人脸绑定限制，使用AI比对人脸
    if (faceCheckEnabled && maxAccountsPerFace > 0 && frames.length > 0) {
      // 使用第一帧作为人脸图片
      const firstFrame = cleanBase64Image(frames[0]);
      
      // 获取所有已通过KYC的记录（带人脸图片）
      const { data: approvedKYCs } = await client
        .from('kyc_records')
        .select('user_id, face_image')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (approvedKYCs && approvedKYCs.length > 0) {
        const validKYCs = approvedKYCs.filter(kyc => 
          kyc.face_image && kyc.face_image.length > 1000
        );
        
        console.log(`[KYC Liveness] Checking face against ${validKYCs.length} approved KYCs`);
        
        if (validKYCs.length > 0) {
          // 统计该人脸已经认证了多少个账号
          let matchedCount = 0;
          
          for (const kyc of validKYCs) {
            // 跳过当前用户自己的记录
            if (kyc.user_id === session.user_id) continue;
            
            try {
              const isSamePerson = await compareFaces(firstFrame, kyc.face_image!);
              if (isSamePerson) {
                matchedCount++;
                console.log(`[KYC Liveness] Face matched with user ${kyc.user_id}, total matched: ${matchedCount}`);
              }
            } catch (e) {
              console.error('[KYC Liveness] Compare error:', e);
            }
          }
          
          // 只有当匹配数量达到或超过上限时才拒绝
          if (matchedCount >= maxAccountsPerFace) {
            console.log(`[KYC Liveness] Face matched ${matchedCount} accounts, limit is ${maxAccountsPerFace}, rejecting`);
            return res.status(400).json(errorResponse(`检测到此人脸已在其他 ${matchedCount} 个账号完成认证，每人脸最多认证 ${maxAccountsPerFace} 个账号`));
          }
          
          console.log(`[KYC Liveness] Face matched ${matchedCount} accounts, limit is ${maxAccountsPerFace}, allowing`);
        }
      }
    }

    res.json(successResponse({
      isLive: result.isLive,
      actionsCompleted: result.actionsDetected,
      allActionsCompleted: true,
      message: result.message,
    }));
  } catch (error: any) {
    console.error('Verify liveness error:', error);
    res.status(500).json(errorResponse(error.message || '验证失败'));
  }
});

export default router;
