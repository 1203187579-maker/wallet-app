import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, message, Divider, Row, Col, Tabs } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { TextArea } = Input;

export default function Config() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.getSystemConfig();
      const data = res.data || {};
      setConfig(data);
      
      const formValues = {};
      for (const [key, value] of Object.entries(data)) {
        if (value === 'true') {
          formValues[key] = true;
        } else if (value === 'false') {
          formValues[key] = false;
        } else {
          formValues[key] = value;
        }
      }
      form.setFieldsValue(formValues);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      for (const [key, value] of Object.entries(values)) {
        const stringValue = typeof value === 'boolean' ? String(value) : value;
        await api.updateSystemConfig(key, stringValue);
      }
      message.success('配置保存成功');
    } catch (error) {
      message.error('保存失败');
    }
  };

  const tabItems = [
    {
      key: 'basic',
      label: '基础配置',
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="appName" label="应用名称">
                <Input placeholder="BoostAra" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="appVersion" label="应用版本">
                <Input placeholder="1.0.0" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="supportEmail" label="客服邮箱">
                <Input placeholder="support@boostara.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supportTelegram" label="客服Telegram">
                <Input placeholder="@BoostAraSupport" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="appDescription" label="应用描述">
            <TextArea rows={3} placeholder="区块链钱包 + DeFi质押 + C2C交易平台" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'wallet',
      label: '钱包配置',
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="defaultNetwork" label="默认网络">
                <Input placeholder="BSC" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gasPrice" label="Gas价格(Gwei)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="minWithdrawAmount" label="最小提现金额(USDT)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="withdrawFee" label="提现手续费(USDT)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="withdrawEnabled" label="提现功能" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'staking',
      label: '质押配置',
      children: (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: '#FFF7ED', borderRadius: 8, border: '1px solid #FDBA74' }}>
            <p style={{ margin: 0, color: '#9A3412', fontSize: 14 }}>
              💰 收益领取模式：手动领取需要用户主动点击领取；自动领取系统会在每天凌晨自动发放收益并分配推荐奖励给上级。
            </p>
          </div>
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>收益领取设置</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item 
                name="stake_reward_claim_mode" 
                label="自动领取收益"
                valuePropName="checked"
                getValueFromEvent={(checked) => checked ? 'auto' : 'manual'}
                getValueProps={(value) => ({ checked: value === 'auto' })}
                extra="开启后系统每天定时自动发放收益给用户"
              >
                <Switch checkedChildren="自动" unCheckedChildren="手动" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => (
                  <Form.Item 
                    name="stake_reward_auto_time" 
                    label="自动发放时间(小时)"
                    extra={getFieldValue('stake_reward_claim_mode') === 'auto' ? "24小时制，如2表示凌晨2点自动发放" : "需先开启自动领取"}
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={0} 
                      max={23}
                      disabled={getFieldValue('stake_reward_claim_mode') !== 'auto'}
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>质押限制</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="minStakeAmount" label="最小质押金额(USDT)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxStakeAmount" label="最大质押金额(USDT)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="stakingEnabled" label="质押功能" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'c2c',
      label: 'C2C配置',
      children: (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: '#FFF7ED', borderRadius: 8, border: '1px solid #FDBA74' }}>
            <p style={{ margin: 0, color: '#9A3412', fontSize: 14 }}>
              ⏰ C2C交易时间限制：只有在交易时间内才能进行出售操作。超时自动处理：买家超时未付款自动取消订单，卖家超时未放行自动放币。
            </p>
          </div>
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>交易时间设置</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_trading_start_hour" label="交易开始时间（小时）" extra="24小时制，如9表示早上9点开始">
                <InputNumber style={{ width: '100%' }} min={0} max={23} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_trading_end_hour" label="交易结束时间（小时）" extra="24小时制，如21表示晚上21点结束">
                <InputNumber style={{ width: '100%' }} min={0} max={23} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>超时自动处理</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_payment_timeout_minutes" label="付款超时时间（分钟）" extra="买家确认付款后，超过此时间未付款自动取消">
                <InputNumber style={{ width: '100%' }} min={5} max={120} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_release_timeout_minutes" label="放行超时时间（分钟）" extra="买家付款后，卖家超过此时间未放行自动放币">
                <InputNumber style={{ width: '100%' }} min={5} max={120} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>卖家出售限制</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_seller_min_amount" label="卖家单笔最小数量(GPU)" extra="卖家出售时的最小数量限制">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_seller_max_amount" label="卖家单笔最大数量(GPU)" extra="卖家出售时的最大数量限制，0表示不限制">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>买家求购限制</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_buyer_min_amount" label="买家求购最小数量(GPU)" extra="买家发布求购时的最小数量限制">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_buyer_max_amount" label="买家求购最大数量(GPU)" extra="买家发布求购时的最大数量限制，0表示不限制">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_max_orders_per_user" label="每账户最多挂单数" extra="每个账户同时最多挂多少个求购单，0表示不限制">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>其他设置</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_display_count" label="买单列表显示数量" extra="新人区和大单区显示的买单数量，默认3条">
                <InputNumber style={{ width: '100%' }} min={1} max={20} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_big_order_threshold" label="大单阈值(GPU)" extra="数量>=该值显示在大单区，否则显示在小单区">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2cFeeRate" label="平台手续费率(%)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2cMinAmount" label="最小交易金额(CNY)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <h4 style={{ marginBottom: 16, color: '#F59E0B' }}>自动分配设置</h4>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="c2c_auto_match_enabled" label="自动分配模式" valuePropName="checked" extra="开启后，卖家出售时系统自动分配买单">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_match_cycle_count" label="掉头数量" extra="轮转N个买单后回到开头重新开始，默认100">
                <InputNumber style={{ width: '100%' }} min={10} max={1000} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="c2cEnabled" label="C2C交易功能" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'kyc',
      label: 'KYC配置',
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="kyc_auto_approve" label="自动审核" valuePropName="checked" extra="开启后，用户提交KYC将自动通过审核">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="kyc_face_check_enabled" label="AI人脸重复检测" valuePropName="checked" extra="开启后，AI会检测同一人脸是否已认证其他账号">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="kyc_max_accounts" label="每个人脸允许认证账号数" extra="设为1表示一个人脸只能认证一个账号">
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="kyc_airdrop_amount" label="KYC通过奖励(AI)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="kycMessage" label="KYC提示信息">
            <TextArea rows={3} placeholder="请上传清晰的证件照片..." />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'group',
      label: '群组配置',
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="group_default_capacity" label="默认群容量" extra="新建群的默认最大成员数">
                <InputNumber style={{ width: '100%' }} min={10} max={5000} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="group_max_capacity" label="群最大容量上限" extra="群可扩容的最大成员数">
                <InputNumber style={{ width: '100%' }} min={100} max={10000} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="group_expand_unit" label="扩容单位(人)" extra="每次扩容增加的成员数">
                <InputNumber style={{ width: '100%' }} min={10} max={500} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="group_expand_cost" label="扩容费用(AI)" extra="每次扩容消耗的AI数量">
                <InputNumber style={{ width: '100%' }} min={1} step={10} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="group_free_capacity" label="免费扩容阈值(人)" extra="低于此容量可免费扩容">
                <InputNumber style={{ width: '100%' }} min={50} max={200} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="group_create_cost" label="建群费用(AI)" extra="创建群组需消耗的AI数量">
                <InputNumber style={{ width: '100%' }} min={0} step={10} />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: 'trade',
      label: '交易配置',
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="trade_fee_rate" label="交易手续费率(%)" extra="限价挂单成交时的总手续费率">
                <InputNumber style={{ width: '100%' }} min={0} max={5} step={0.1} precision={3} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="c2c_fee_rate" label="C2C手续费率(%)" extra="C2C交易的手续费率">
                <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.1} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="trade_min_amount" label="最小交易数量" extra="限价挂单的最小交易数量">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tradeEnabled" label="限价交易功能" valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'email',
      label: '邮件配置',
      children: (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: '#FFF7ED', borderRadius: 8, border: '1px solid #FDBA74' }}>
            <p style={{ margin: 0, color: '#9A3412', fontSize: 14 }}>
              📧 配置SMTP邮件服务后，用户可收到C2C订单状态变更的邮件通知。
            </p>
          </div>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="smtp_host" label="SMTP服务器地址" extra="如：smtp.qq.com">
                <Input placeholder="smtp.example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="smtp_port" label="SMTP端口" extra="通常SSL为465，TLS为587">
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="smtp_user" label="SMTP用户名">
                <Input placeholder="your@email.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="smtp_pass" label="SMTP密码">
                <Input.Password placeholder="密码或授权码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="smtp_from_name" label="发件人名称">
                <Input placeholder="BoostAra" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="smtp_from_email" label="发件人邮箱">
                <Input placeholder="noreply@boostara.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="smtp_secure" label="使用SSL" valuePropName="checked" extra="端口465通常需要开启">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'ban',
      label: '封禁配置',
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="default_ban_days" label="默认封禁天数" extra="0表示永久封禁">
                <InputNumber style={{ width: '100%' }} min={0} max={365} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ban_tip_template" label="封禁提示模板" extra="使用{reason}作为占位符">
            <TextArea rows={3} placeholder="您的账号已被封禁，原因：{reason}。如有疑问请联系客服。" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'payment',
      label: '支付方式',
      children: (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: '#FFF7ED', borderRadius: 8, border: '1px solid #FDBA74' }}>
            <p style={{ margin: 0, color: '#9A3412', fontSize: 14 }}>
              💳 控制用户端C2C交易显示的支付方式。关闭后用户将无法选择该支付方式。
            </p>
          </div>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item 
                name="payment_alipay_enabled" 
                label="支付宝" 
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="payment_wechat_enabled" 
                label="微信支付" 
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="payment_usdt_enabled" 
                label="USDT" 
                valuePropName="checked"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>⚙️ 系统配置</h2>
      
      <Card style={{ borderRadius: 12 }}>
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Tabs defaultActiveKey="basic" items={tabItems} />
          
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              icon={<SaveOutlined />}
              style={{ 
                background: '#F59E0B', 
                borderColor: '#F59E0B',
                minWidth: 200,
                height: 44,
                fontSize: 16
              }}
            >
              保存配置
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
