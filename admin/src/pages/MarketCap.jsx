import React, { useState, useEffect } from 'react';
import {
  Card, Space, Button, Modal, Form, InputNumber, message, Row, Col,
  Statistic, Switch, Table, Tag, Typography, Divider, Spin, Result,
  Progress, Tooltip, Input, Select, Alert, Tabs, Badge, List, Empty
} from 'antd';
import {
  RobotOutlined, SettingOutlined, HistoryOutlined, ReloadOutlined,
  RiseOutlined, FallOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  PauseCircleOutlined, PlayCircleOutlined, DollarOutlined, LineChartOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import * as api from '../utils/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 代币颜色映射
const TOKEN_COLORS = {
  'AI': '#F59E0B',
  'BTC': '#F7931A',
  'ETH': '#627EEA',
  'USDT': '#26A17B',
  'BNB': '#F0B90B',
  'SOL': '#00FFA3',
  'DOGE': '#C2A633',
};

export default function MarketCap() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 所有可用代币
  const [allTokens, setAllTokens] = useState([]);
  
  // 已配置市值管理的代币列表
  const [managedTokens, setManagedTokens] = useState([]);
  
  // 当前选中的代币
  const [selectedToken, setSelectedToken] = useState(null);

  // 弹窗状态
  const [addTokenModalVisible, setAddTokenModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [manualAdjustModalVisible, setManualAdjustModalVisible] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  
  const [addTokenForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [manualForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取所有代币价格
      const pricesRes = await api.getTokenPrices();
      if (pricesRes?.data) {
        setAllTokens(pricesRes.data);
      }

      // 获取已配置市值管理的代币
      const configRes = await api.getMarketCapConfig();
      if (configRes?.data?.tokens) {
        setManagedTokens(configRes.data.tokens);
        if (configRes.data.tokens.length > 0) {
          setSelectedToken(configRes.data.tokens[0]);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加代币到市值管理
  const handleAddToken = async (values) => {
    try {
      const token = allTokens.find(t => t.symbol === values.symbol);
      if (!token) {
        return message.error('代币不存在');
      }

      // 检查是否已添加
      if (managedTokens.find(t => t.symbol === values.symbol)) {
        return message.error('该代币已在管理列表中');
      }

      const newToken = {
        symbol: token.symbol,
        name: token.name || token.symbol,
        currentPrice: token.price || 0,
        circulatingSupply: values.circulatingSupply || 1000000000,
        targetMarketCap: values.targetMarketCap || 1000000,
        minPrice: values.minPrice || 0.001,
        maxPrice: values.maxPrice || 1,
        enabled: false,
        autoAdjust: true,
        adjustFrequency: values.adjustFrequency || 'hourly',
        maxAdjustPercent: values.maxAdjustPercent || 5,
        stopLossPercent: values.stopLossPercent || 10,
        takeProfitPercent: values.takeProfitPercent || 50,
        strategy: values.strategy || 'gradual',
      };

      // 保存到后端
      const res = await api.addMarketCapToken(newToken);
      if (res?.success) {
        message.success(`已添加 ${token.symbol} 到市值管理`);
        setAddTokenModalVisible(false);
        addTokenForm.resetFields();
        fetchData();
      }
    } catch (err) {
      message.error('添加失败');
    }
  };

  // 更新代币配置
  const handleUpdateConfig = async (values) => {
    try {
      const res = await api.updateMarketCapToken(selectedToken.symbol, values);
      if (res?.success) {
        message.success('配置更新成功');
        setConfigModalVisible(false);
        fetchData();
      }
    } catch (err) {
      message.error('更新失败');
    }
  };

  // 删除代币
  const handleRemoveToken = async (symbol) => {
    try {
      const res = await api.removeMarketCapToken(symbol);
      if (res?.success) {
        message.success('已移除');
        fetchData();
      }
    } catch (err) {
      message.error('移除失败');
    }
  };

  // 切换AI开关
  const handleToggleAI = async (symbol, enabled) => {
    try {
      const res = await api.updateMarketCapToken(symbol, { enabled });
      if (res?.success) {
        message.success(enabled ? 'AI调控已启动' : 'AI调控已暂停');
        fetchData();
      }
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 手动调整
  const handleManualAdjust = async (values) => {
    try {
      const res = await api.manualMarketCapAdjust({
        symbol: selectedToken.symbol,
        action_type: values.action_type,
        adjust_percent: values.adjust_percent,
        remark: values.remark,
      });
      if (res?.success) {
        message.success('调整成功');
        setManualAdjustModalVisible(false);
        manualForm.resetFields();
        fetchData();
      }
    } catch (err) {
      message.error('调整失败');
    }
  };

  // 格式化金额
  const formatMoney = (value) => {
    if (!value) return '$0';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // 计算当前市值
  const getCurrentMarketCap = (token) => {
    const price = token.currentPrice || 0;
    const supply = token.circulatingSupply || 1000000000;
    return price * supply;
  };

  // 计算进度
  const getProgress = (token) => {
    const current = getCurrentMarketCap(token);
    const target = token.targetMarketCap || 1000000;
    return Math.min((current / target) * 100, 100);
  };

  if (loading && allTokens.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#666' }}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
        extra={
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetchData}>
            重试
          </Button>
        }
      />
    );
  }

  // 代币列表表格列
  const tokenColumns = [
    {
      title: '代币',
      dataIndex: 'symbol',
      render: (symbol, record) => (
        <Space>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: TOKEN_COLORS[symbol] || '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 12
          }}>
            {symbol?.slice(0, 2) || '??'}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>{symbol}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.name || symbol}</Text>
          </div>
        </Space>
      )
    },
    {
      title: '当前价格',
      dataIndex: 'currentPrice',
      render: (price) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>${price?.toFixed(6) || '0'}</span>
    },
    {
      title: '当前市值',
      render: (_, record) => formatMoney(getCurrentMarketCap(record))
    },
    {
      title: '目标市值',
      dataIndex: 'targetMarketCap',
      render: (v) => formatMoney(v)
    },
    {
      title: '进度',
      render: (_, record) => (
        <Progress 
          percent={getProgress(record)} 
          size="small"
          style={{ width: 100 }}
          strokeColor={{
            '0%': '#F59E0B',
            '100%': '#52c41a',
          }}
        />
      )
    },
    {
      title: 'AI状态',
      dataIndex: 'enabled',
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleAI(record.symbol, checked)}
          checkedChildren={<><RobotOutlined /> ON</>}
          unCheckedChildren="OFF"
          size="small"
        />
      )
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      render: (strategy) => {
        const colors = { conservative: 'green', gradual: 'blue', aggressive: 'red' };
        const labels = { conservative: '保守', gradual: '稳健', aggressive: '激进' };
        return <Tag color={colors[strategy] || 'default'}>{labels[strategy] || strategy}</Tag>;
      }
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedToken(record);
              configForm.setFieldsValue(record);
              setConfigModalVisible(true);
            }}
          >
            配置
          </Button>
          <Button 
            type="link" 
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认移除',
                content: `确定要将 ${record.symbol} 从市值管理中移除吗？`,
                onOk: () => handleRemoveToken(record.symbol),
              });
            }}
          >
            移除
          </Button>
        </Space>
      )
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <RobotOutlined style={{ marginRight: 8, color: '#F59E0B' }} />
          AI市值管理
        </Title>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            style={{ background: '#F59E0B', borderColor: '#F59E0B' }}
            onClick={() => {
              addTokenForm.setFieldsValue({
                circulatingSupply: 1000000000,
                targetMarketCap: 1000000,
                minPrice: 0.001,
                maxPrice: 1,
                adjustFrequency: 'hourly',
                maxAdjustPercent: 5,
                stopLossPercent: 10,
                takeProfitPercent: 50,
                strategy: 'gradual',
              });
              setAddTokenModalVisible(true);
            }}
          >
            添加代币
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 说明 */}
      <Alert
        message="功能说明"
        description="添加需要AI市值管理的代币，配置目标市值和调控策略后，系统将自动调整价格以维持市值稳定。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {managedTokens.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                暂无管理中的代币
                <br />
                <Text type="secondary">点击上方"添加代币"按钮开始配置</Text>
              </span>
            }
          />
        </Card>
      ) : (
        <>
          {/* 代币概览卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {managedTokens.map(token => (
              <Col xs={24} sm={12} lg={6} key={token.symbol}>
                <Card 
                  style={{ 
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: selectedToken?.symbol === token.symbol ? '2px solid #F59E0B' : undefined,
                  }}
                  onClick={() => setSelectedToken(token)}
                  hoverable
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: TOKEN_COLORS[token.symbol] || '#666',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: 10
                      }}>
                        {token.symbol?.slice(0, 2) || '??'}
                      </div>
                      <Text strong>{token.symbol}</Text>
                    </Space>
                    <Badge status={token.enabled ? 'processing' : 'default'} text={token.enabled ? '运行中' : '已暂停'} />
                  </div>
                  <Statistic
                    value={getCurrentMarketCap(token)}
                    formatter={(value) => formatMoney(value)}
                    valueStyle={{ fontSize: 20, fontWeight: 'bold', color: '#F59E0B' }}
                    prefix={<DollarOutlined />}
                  />
                  <Progress 
                    percent={getProgress(token)} 
                    size="small"
                    showInfo={false}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* 代币列表 */}
          <Card style={{ borderRadius: 12 }}>
            <Table
              columns={tokenColumns}
              dataSource={managedTokens}
              rowKey="symbol"
              pagination={false}
              onRow={(record) => ({
                onClick: () => setSelectedToken(record),
                style: { 
                  cursor: 'pointer',
                  background: selectedToken?.symbol === record.symbol ? '#fffbe6' : undefined,
                }
              })}
            />
          </Card>

          {/* 选中代币的详细操作 */}
          {selectedToken && (
            <Card 
              title={
                <Space>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: TOKEN_COLORS[selectedToken.symbol] || '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 10
                  }}>
                    {selectedToken.symbol?.slice(0, 2) || '??'}
                  </div>
                  {selectedToken.symbol} 详细操作
                </Space>
              }
              style={{ borderRadius: 12, marginTop: 24 }}
              extra={
                <Space>
                  <Button 
                    type="primary" 
                    icon={<RiseOutlined />}
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={() => {
                      manualForm.setFieldsValue({ action_type: 'price_up', adjust_percent: 2 });
                      setManualAdjustModalVisible(true);
                    }}
                  >
                    手动拉升
                  </Button>
                  <Button 
                    danger
                    icon={<FallOutlined />}
                    onClick={() => {
                      manualForm.setFieldsValue({ action_type: 'price_down', adjust_percent: 2 });
                      setManualAdjustModalVisible(true);
                    }}
                  >
                    手动下调
                  </Button>
                  <Button 
                    icon={<SettingOutlined />}
                    onClick={() => {
                      configForm.setFieldsValue(selectedToken);
                      setConfigModalVisible(true);
                    }}
                  >
                    配置参数
                  </Button>
                </Space>
              }
            >
              <Row gutter={[24, 16]}>
                <Col span={6}>
                  <Text type="secondary">当前价格</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>${selectedToken.currentPrice?.toFixed(6) || '0'}</div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">当前市值</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#F59E0B' }}>{formatMoney(getCurrentMarketCap(selectedToken))}</div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">目标市值</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>{formatMoney(selectedToken.targetMarketCap)}</div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">流通量</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>{(selectedToken.circulatingSupply / 1000000).toFixed(0)}M</div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">单次最大调整</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#F59E0B' }}>{selectedToken.maxAdjustPercent}%</div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">调整频率</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    {selectedToken.adjustFrequency === 'hourly' ? '每小时' : 
                     selectedToken.adjustFrequency === 'daily' ? '每日' : '实时'}
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">止损线</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4d4f' }}>-{selectedToken.stopLossPercent}%</div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">止盈线</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>+{selectedToken.takeProfitPercent}%</div>
                </Col>
              </Row>
            </Card>
          )}
        </>
      )}

      {/* 添加代币弹窗 */}
      <Modal
        title={<><PlusOutlined /> 添加代币到市值管理</>}
        open={addTokenModalVisible}
        onCancel={() => setAddTokenModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form 
          form={addTokenForm} 
          onFinish={handleAddToken} 
          layout="vertical"
        >
          <Form.Item name="symbol" label="选择代币" rules={[{ required: true }]}>
            <Select 
              placeholder="请选择要管理的代币"
              showSearch
              filterOption={(input, option) => 
                option.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {allTokens
                .filter(t => !managedTokens.find(m => m.symbol === t.symbol))
                .map(token => (
                  <Option key={token.symbol} value={token.symbol}>
                    <Space>
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: TOKEN_COLORS[token.symbol] || '#666',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: 8
                      }}>
                        {token.symbol?.slice(0, 2)}
                      </div>
                      {token.symbol} - {token.name || token.symbol}
                      <Text type="secondary">(${token.price?.toFixed(6) || '0'})</Text>
                    </Space>
                  </Option>
                ))
              }
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="circulatingSupply" label="流通供应量" rules={[{ required: true }]}>
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={1} 
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\,/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetMarketCap" label="目标市值 ($)" rules={[{ required: true }]}>
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={10000} 
                  formatter={value => `$${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="minPrice" label="最低价格 ($)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.00001} precision={8} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxPrice" label="最高价格 ($)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.00001} precision={8} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="strategy" label="调控策略" rules={[{ required: true }]}>
            <Select>
              <Option value="conservative">
                <Space>
                  <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                  保守型 - 小幅慢调，风险低
                </Space>
              </Option>
              <Option value="gradual">
                <Space>
                  <LineChartOutlined style={{ color: '#1890ff' }} />
                  稳健型 - 适中调整，平衡风险
                </Space>
              </Option>
              <Option value="aggressive">
                <Space>
                  <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
                  激进型 - 大幅快调，风险高
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item name="adjustFrequency" label="调整频率">
            <Select>
              <Option value="realtime">实时 (每分钟检测)</Option>
              <Option value="hourly">每小时</Option>
              <Option value="daily">每日</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maxAdjustPercent" label="单次最大调整 (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.1} max={20} precision={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stopLossPercent" label="止损线 (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={50} precision={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="takeProfitPercent" label="止盈线 (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={100} precision={1} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAddTokenModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                添加代币
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 配置参数弹窗 */}
      <Modal
        title={<><SettingOutlined /> 配置参数 - {selectedToken?.symbol}</>}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form 
          form={configForm} 
          onFinish={handleUpdateConfig} 
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="circulatingSupply" label="流通供应量" rules={[{ required: true }]}>
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={1} 
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\,/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="targetMarketCap" label="目标市值 ($)" rules={[{ required: true }]}>
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={10000} 
                  formatter={value => `$${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="minPrice" label="最低价格 ($)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.00001} precision={8} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxPrice" label="最高价格 ($)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.00001} precision={8} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="strategy" label="调控策略" rules={[{ required: true }]}>
            <Select>
              <Option value="conservative">
                <Space><SafetyCertificateOutlined style={{ color: '#52c41a' }} /> 保守型</Space>
              </Option>
              <Option value="gradual">
                <Space><LineChartOutlined style={{ color: '#1890ff' }} /> 稳健型</Space>
              </Option>
              <Option value="aggressive">
                <Space><ThunderboltOutlined style={{ color: '#ff4d4f' }} /> 激进型</Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item name="adjustFrequency" label="调整频率">
            <Select>
              <Option value="realtime">实时</Option>
              <Option value="hourly">每小时</Option>
              <Option value="daily">每日</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maxAdjustPercent" label="单次最大调整 (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0.1} max={20} precision={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stopLossPercent" label="止损线 (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={50} precision={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="takeProfitPercent" label="止盈线 (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={100} precision={1} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setConfigModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                保存配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 手动调整弹窗 */}
      <Modal
        title={<><ThunderboltOutlined /> 手动调整 - {selectedToken?.symbol}</>}
        open={manualAdjustModalVisible}
        onCancel={() => setManualAdjustModalVisible(false)}
        footer={null}
      >
        <Form 
          form={manualForm} 
          onFinish={handleManualAdjust} 
          layout="vertical"
        >
          <Alert
            message="注意"
            description="手动调整将立即执行价格变动，请谨慎操作。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item name="action_type" label="操作类型" rules={[{ required: true }]}>
            <Select>
              <Option value="price_up">
                <Space><RiseOutlined style={{ color: '#52c41a' }} /> 拉升价格</Space>
              </Option>
              <Option value="price_down">
                <Space><FallOutlined style={{ color: '#ff4d4f' }} /> 下调价格</Space>
              </Option>
              <Option value="buy_wall">
                <Space><DollarOutlined style={{ color: '#1890ff' }} /> 买入托底</Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item name="adjust_percent" label="调整幅度 (%)" rules={[{ required: true }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              min={0.1} 
              max={20} 
              precision={2}
              step={0.5}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入调整原因（可选）" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setManualAdjustModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" danger>
                确认执行
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
