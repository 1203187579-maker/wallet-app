import nodemailer from 'nodemailer';
import { getSupabaseClient } from '../storage/database/supabase-client';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

// 获取邮件配置
async function getEmailConfig(): Promise<EmailConfig | null> {
  const client = getSupabaseClient();
  
  const { data: configs } = await client
    .from('system_config')
    .select('config_key, config_value')
    .in('config_key', [
      'smtp_host',
      'smtp_port',
      'smtp_secure',
      'smtp_user',
      'smtp_pass',
      'smtp_from_name',
      'smtp_from_email',
    ]);

  if (!configs || configs.length < 7) {
    return null;
  }

  const configMap = new Map(configs.map(c => [c.config_key, c.config_value]));

  return {
    host: configMap.get('smtp_host') || '',
    port: parseInt(configMap.get('smtp_port') || '587', 10),
    secure: configMap.get('smtp_secure') === 'true',
    user: configMap.get('smtp_user') || '',
    pass: configMap.get('smtp_pass') || '',
    fromName: configMap.get('smtp_from_name') || 'Platform',
    fromEmail: configMap.get('smtp_from_email') || '',
  };
}

// 创建邮件传输器
async function createTransporter() {
  const config = await getEmailConfig();
  
  if (!config || !config.host || !config.user || !config.pass) {
    console.log('[Email] SMTP配置不完整，跳过邮件发送');
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

/**
 * 发送邮件
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    
    if (!transporter) {
      console.log('[Email] 邮件发送跳过：SMTP未配置');
      return false;
    }

    const config = await getEmailConfig();
    
    const info = await transporter.sendMail({
      from: `"${config?.fromName || 'Platform'}" <${config?.fromEmail || config?.user}>`,
      to,
      subject,
      html,
    });

    console.log('[Email] 邮件发送成功:', info.messageId);
    return true;
  } catch (error) {
    console.error('[Email] 邮件发送失败:', error);
    return false;
  }
}

/**
 * 发送C2C订单状态变更通知
 */
export async function sendC2COrderNotification(
  email: string,
  data: {
    orderId: string;
    status: string;
    amount: string;
    tokenSymbol: string;
    buyerName?: string;
    sellerName?: string;
  }
): Promise<boolean> {
  const statusMap: Record<string, string> = {
    'pending': '待付款',
    'paid': '已付款',
    'completed': '已完成',
    'cancelled': '已取消',
    'appealing': '申诉中',
    'refunded': '已退款',
  };

  const statusText = statusMap[data.status] || data.status;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #F59E0B; margin: 0 0 20px 0; font-size: 20px;">
          📦 C2C订单状态更新
        </h2>
        
        <div style="background: #FEF3C7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0; color: #92400E; font-size: 16px; font-weight: bold;">
            订单状态：${statusText}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; color: #6B7280; border-bottom: 1px solid #E5E7EB;">订单编号</td>
            <td style="padding: 12px 0; color: #111827; text-align: right; border-bottom: 1px solid #E5E7EB; font-family: monospace;">
              ${data.orderId.slice(0, 12)}...
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #6B7280; border-bottom: 1px solid #E5E7EB;">交易金额</td>
            <td style="padding: 12px 0; color: #111827; text-align: right; border-bottom: 1px solid #E5E7EB; font-weight: bold;">
              ${data.amount} ${data.tokenSymbol}
            </td>
          </tr>
          ${data.buyerName ? `
          <tr>
            <td style="padding: 12px 0; color: #6B7280; border-bottom: 1px solid #E5E7EB;">买家</td>
            <td style="padding: 12px 0; color: #111827; text-align: right; border-bottom: 1px solid #E5E7EB;">
              ${data.buyerName}
            </td>
          </tr>
          ` : ''}
          ${data.sellerName ? `
          <tr>
            <td style="padding: 12px 0; color: #6B7280; border-bottom: 1px solid #E5E7EB;">卖家</td>
            <td style="padding: 12px 0; color: #111827; text-align: right; border-bottom: 1px solid #E5E7EB;">
              ${data.sellerName}
            </td>
          </tr>
          ` : ''}
        </table>

        <div style="margin-top: 24px; padding: 16px; background: #F3F4F6; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #6B7280; font-size: 14px;">
            请登录App查看订单详情并及时处理
          </p>
        </div>

        <p style="margin: 24px 0 0 0; color: #9CA3AF; font-size: 12px; text-align: center;">
          此邮件由系统自动发送，请勿回复
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, `[C2C订单] ${statusText} - ${data.amount} ${data.tokenSymbol}`, html);
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationCode(
  email: string,
  code: string,
  purpose: string = '验证'
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color: #F59E0B; margin: 0 0 20px 0; font-size: 20px;">
          🔐 ${purpose}验证码
        </h2>
        
        <div style="background: #FEF3C7; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">您的验证码是</p>
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #F59E0B; letter-spacing: 8px;">
            ${code}
          </p>
        </div>

        <p style="margin: 0; color: #6B7280; font-size: 14px; text-align: center;">
          验证码有效期为5分钟，请勿泄露给他人
        </p>

        <p style="margin: 24px 0 0 0; color: #9CA3AF; font-size: 12px; text-align: center;">
          此邮件由系统自动发送，请勿回复
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, `【${purpose}】验证码`, html);
}
