import React, { useState, useEffect } from 'react';
import {
  Table, Card, Space, Button, Modal, Form, InputNumber, message, Row, Col,
  Statistic, Input, Result, Spin, Tabs, Divider, Typography, Tag, Tooltip, Switch
} from 'antd';
import {
  EditOutlined, RiseOutlined, FallOutlined, ReloadOutlined,
  LineChartOutlined, HistoryOutlined, SettingOutlined, PlusOutlined
} from '@ant-design/icons';
import * as api from '../utils/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function Prices() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prices, setPrices] = useState([]);
  const [editVisible, setEditVisible] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [form] = Form.useForm();

  // AI价格管理
  const [aiPrice, setAiPrice] = useState(null);
  const [aiHistory, setAiHistory] = useState([]);
  const [aiForm] = Form.useForm();
  const [aiModalVisible, setAiModalVisible] = useState(false);

  // K线生成
  const [klineForm] = Form.useForm();
  const [klineModalVisible, setKlineModalVisible] = useState(false);
  const [pairs, setPairs] = useState([]);
  
  // 交易对配置
  const [tradingPairs, setTradingPairs] = useState([]);
  const [tradingPairsLoading, setTradingPairsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pricesRes, pairsRes, tradingPairsRes] = await Promise.all([
        api.getTokenPrices(),
        api.getMarketPairs().catch(() => ({ data: [] })),
        api.getTradingPairs().catch(() => ({ data: [] })),
      ]);
      
      if (pricesRes && pricesRes.data) {
        setPrices(pricesRes.data);
        const ai = pricesRes.data.find(p => p.symbol === 'AI');
        setAiPrice(ai);
      } else {
        setPrices([]);
      }
      
      if (pairsRes && pairsRes.data) {
        setPairs(pairsRes.data);
      }
      
      if (tradingPairsRes && tradingPairsRes.data) {
        setTradingPairs(tradingPairsRes.data);
      }
      
      // 获取AI价格历史
      try {
        const historyRes = await api.getAiPriceHistory(20);
        if (historyRes && historyRes.data) {
          setAiHistory(historyRes.data);
        }
      } catch (err) {
        console.log('AI历史加载失败:', err);
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setCurrentPrice(record);
    form.setFieldsValue({
      price: record.price || 0,
      change24h: record.change24h || 0,
    });
    setEditVisible(true);
  };

  const handleSave = async (values) => {
    try {
      await api.updateTokenPrice(currentPrice.symbol, values);
      message.success('价格更新成功');
      setEditVisible(false);
      fetchData();
    } catch (err) {
      message.error('更新失败');
    }
  };

  // AI价格调整
  const handleAiPriceSubmit = async (values) => {
    try {
      const res = await api.updateAiPrice(values.price, values.reason, 'manual');
      if (res && res.success) {
        message.success(`AI价格已更新: $${res.data.newPrice}`);
        setAiModalVisible(false);
        aiForm.resetFields();
        fetchData();
      }
    } catch (err) {
      message.error('价格调整失败');
    }
  };

  // K线数据生成
  const handleKlineGenerate = async (values) => {
    try {
      const res = await api.generateKlineData(
        values.pairSymbol,
        values.interval,
        values.count || 100,
        values.basePrice || 100
      );
      if (res && res.success) {
        message.success(res.message || 'K线数据生成成功');
        setKlineModalVisible(false);
        klineForm.resetFields();
      }
    } catch (err) {
      message.error('生成失败');
    }
  };

  // 更新交易对配置
  const handleUpdateTradingPair = async (id, field, value) => {
    try {
      setTradingPairsLoading(true);
      await api.updateTradingPair(id, { [field]: value });
      message.success('更新成功');
      fetchData();
    } catch (err) {
      message.error('更新失败');
    } finally {
      setTradingPairsLoading(false);
    }
  };

  if (loading) {
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

  const getSymbolColor = (symbol) => {
    const colors = {
      'BTC': '#F7931A',
      'ETH': '#627EEA',
      'USDT': '#26A17B',
      'BNB': '#F0B90B',
      'AI': '#8B5CF6',
      'GPU': '#10B981',
      'PLATFORM': '#F59E0B',
    };
    return colors[symbol] || '#666';
  };

  const columns = [
    {
      title: '代币',
      dataIndex: 'symbol',
      render: (symbol) => (
        <Space>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: getSymbolColor(symbol),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold'
          }}>
            {symbol ? symbol.slice(0, 2) : '??'}
          </div>
          <span style={{ fontWeight: 'bold' }}>{symbol || '-'}</span>
        </Space>
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (v) => v || '-'
    },
    {
      title: '当前价格',
      dataIndex: 'price',
      render: (price) => <span style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: 16 }}>${price || 0}</span>
    },
    {
      title: '24h涨跌',
      dataIndex: 'change24h',
      render: (change) => {
        const val = change || 0;
        return (
          <Space>
            {val >= 0 ? <RiseOutlined style={{ color: '#52c41a' }} /> : <FallOutlined style={{ color: '#ff4d4f' }} />}
            <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
              {val >= 0 ? '+' : ''}{val}%
            </span>
          </Space>
        );
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (v) => v || '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>
      ),
    },
  ];

  // AI历史表格列
  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (v) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '原价格',
      dataIndex: 'old_price',
      render: (v) => v ? `$${parseFloat(v).toFixed(4)}` : '-',
    },
    {
      title: '新价格',
      dataIndex: 'new_price',
      render: (v) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>${v ? parseFloat(v).toFixed(4) : '-'}</span>,
    },
    {
      title: '涨跌幅',
      dataIndex: 'price_change_percent',
      render: (v) => {
        if (!v) return '-';
        const val = parseFloat(v);
        return (
          <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {val >= 0 ? '+' : ''}{val.toFixed(2)}%
          </span>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'adjustment_type',
      render: (v) => (
        <Tag color={v === 'ai_auto' ? 'blue' : 'orange'}>
          {v === 'ai_auto' ? 'AI调控' : '手动调整'}
        </Tag>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      render: (v) => v || '-',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>📈 行情管理</Title>
        <Space>
          <Button icon={<LineChartOutlined />} onClick={() => setKlineModalVisible(true)}>
            生成K线数据
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="prices">
        <TabPane tab="价格列表" key="prices">
          {prices.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {prices.slice(0, 4).map((token, index) => (
                <Col xs={24} sm={6} key={token.symbol || index}>
                  <Card style={{ borderRadius: 12 }} hoverable>
                    <Statistic
                      title={
                        <Space>
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: getSymbolColor(token.symbol),
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: 10
                          }}>
                            {token.symbol ? token.symbol.slice(0, 2) : '??'}
                          </div>
                          {token.symbol || 'Unknown'}
                        </Space>
                      }
                      value={token.price || 0}
                      prefix="$"
                      precision={2}
                      valueStyle={{ color: '#F59E0B', fontWeight: 'bold' }}
                      suffix={
                        <span style={{
                          fontSize: 14,
                          color: (token.change24h || 0) >= 0 ? '#52c41a' : '#ff4d4f',
                          marginLeft: 8
                        }}>
                          {(token.change24h || 0) >= 0 ? '+' : ''}{token.change24h || 0}%
                        </span>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Card style={{ borderRadius: 12 }}>
            <Table
              columns={columns}
              dataSource={prices}
              rowKey="symbol"
              loading={loading}
              pagination={false}
              locale={{ emptyText: '暂无数据' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="AI价格调控" key="ai">
          <Card style={{ borderRadius: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary">当前AI价格</Text>
                <Title level={2} style={{ color: '#F59E0B', margin: 0 }}>
                  ${aiPrice?.price || '0.00'}
                </Title>
              </div>
              <Button
                type="primary"
                icon={<EditOutlined />}
                style={{ background: '#F59E0B', borderColor: '#F59E0B' }}
                onClick={() => setAiModalVisible(true)}
              >
                调整价格
              </Button>
            </div>
          </Card>

          <Card title={<><HistoryOutlined /> 价格调整历史</>} style={{ borderRadius: 12 }}>
            <Table
              columns={historyColumns}
              dataSource={aiHistory}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '暂无调整记录' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="交易对配置" key="pairs">
          <Card style={{ borderRadius: 12 }}>
            <Table
              dataSource={tradingPairs}
              rowKey="id"
              loading={tradingPairsLoading}
              pagination={false}
              columns={[
                {
                  title: '交易对',
                  dataIndex: 'pair_symbol',
                  render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span>
                },
                {
                  title: '基础货币',
                  dataIndex: 'base_currency',
                },
                {
                  title: '报价货币',
                  dataIndex: 'quote_currency',
                },
                {
                  title: '可查看',
                  dataIndex: 'is_viewable',
                  render: (v, record) => (
                    <Switch
                      checked={v !== false}
                      onChange={(checked) => handleUpdateTradingPair(record.id, 'is_viewable', checked)}
                      checkedChildren="开"
                      unCheckedChildren="关"
                    />
                  )
                },
                {
                  title: '可交易',
                  dataIndex: 'is_trading_enabled',
                  render: (v, record) => (
                    <Switch
                      checked={v !== false}
                      onChange={(checked) => handleUpdateTradingPair(record.id, 'is_trading_enabled', checked)}
                      checkedChildren="开"
                      unCheckedChildren="关"
                    />
                  )
                },
                {
                  title: '最小交易量',
                  dataIndex: 'min_trade_amount',
                  render: (v) => v || '-'
                },
                {
                  title: '状态',
                  dataIndex: 'is_active',
                  render: (v) => (
                    <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
                  )
                },
              ]}
              locale={{ emptyText: '暂无交易对配置' }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 编辑价格弹窗 */}
      <Modal
        title="💵 编辑价格"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item label="代币">
            <Input value={currentPrice?.symbol || ''} disabled />
          </Form.Item>
          <Form.Item name="price" label="当前价格($)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={8} />
          </Form.Item>
          <Form.Item name="change24h" label="24h涨跌(%)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI价格调整弹窗 */}
      <Modal
        title="🎯 AI价格调整"
        open={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        footer={null}
      >
        <Form form={aiForm} onFinish={handleAiPriceSubmit} layout="vertical">
          <Form.Item label="当前价格">
            <Input value={`$${aiPrice?.price || '0.00'}`} disabled />
          </Form.Item>
          <Form.Item name="price" label="新价格($)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={8} />
          </Form.Item>
          <Form.Item name="reason" label="调整原因">
            <Input.TextArea rows={3} placeholder="请输入调整原因（可选）" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAiModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                确认调整
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* K线数据生成弹窗 */}
      <Modal
        title="📊 生成K线数据"
        open={klineModalVisible}
        onCancel={() => setKlineModalVisible(false)}
        footer={null}
      >
        <Form form={klineForm} onFinish={handleKlineGenerate} layout="vertical" 
          initialValues={{ interval: '1h', count: 100, basePrice: 100 }}>
          <Form.Item name="pairSymbol" label="交易对" rules={[{ required: true }]}>
            <Input placeholder="例如: AI/USDT" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="interval" label="时间周期">
                <Input placeholder="1m, 5m, 15m, 1h, 4h, 1d" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="count" label="数据条数">
                <InputNumber style={{ width: '100%' }} min={10} max={1000} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="basePrice" label="基准价格">
            <InputNumber style={{ width: '100%' }} min={0} precision={8} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setKlineModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                生成数据
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
