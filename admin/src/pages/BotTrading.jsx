import React, { useState, useEffect } from 'react';
import {
  Card, Space, Button, Modal, Form, InputNumber, message, Row, Col,
  Statistic, Switch, Table, Tag, Typography, Divider, Spin, Result,
  Progress, Tooltip, Input, Select, Alert, Tabs, Badge, List, Empty,
  Descriptions, Slider, InputNumber as AntInputNumber
} from 'antd';
import {
  RobotOutlined, SettingOutlined, HistoryOutlined, ReloadOutlined,
  RiseOutlined, FallOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  PauseCircleOutlined, PlayCircleOutlined, DollarOutlined, LineChartOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SyncOutlined, DashboardOutlined, OrderedListOutlined, BarChartOutlined
} from '@ant-design/icons';
import * as api from '../utils/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// API基础路径
const API_BASE = '/api/v1/admin/bot-trading';

// 策略类型映射
const STRATEGY_MAP = {
  'market_making': { name: '做市策略', desc: '根据买卖盘压力自动挂单' },
  'trend_follow': { name: '趋势跟踪', desc: '跟随价格趋势进行交易' },
  'mean_revert': { name: '均值回归', desc: '价格回归目标价位' },
};

export default function BotTrading() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [botConfigs, setBotConfigs] = useState([]);
  const [botOrders, setBotOrders] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [tradeHistoryTotal, setTradeHistoryTotal] = useState(0);
  const [tradeHistoryPage, setTradeHistoryPage] = useState(1);
  const [traderTypeFilter, setTraderTypeFilter] = useState('all');
  const [userStats, setUserStats] = useState([]);
  const [userStatsPeriod, setUserStatsPeriod] = useState('24h');
  const [userStatsTraderType, setUserStatsTraderType] = useState('all');
  
  // 弹窗状态
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  
  const [configForm] = Form.useForm();
  const [executeForm] = Form.useForm();

  // 当前选中的代币
  const [selectedSymbol, setSelectedSymbol] = useState('AI');

  useEffect(() => {
    fetchAllData();
    // 每30秒刷新一次数据
    const interval = setInterval(() => {
      fetchDashboardData(selectedSymbol);
      fetchStats(selectedSymbol);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDashboardData(selectedSymbol),
        fetchBotConfigs(),
        fetchStats(selectedSymbol),
        fetchBotOrders(),
        fetchTradeHistory(selectedSymbol, 1, traderTypeFilter),
        fetchUserStats(selectedSymbol, userStatsPeriod),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async (symbol) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/dashboard?symbol=${symbol}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err);
    }
  };

  const fetchBotConfigs = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/config`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBotConfigs(data.data || []);
      }
    } catch (err) {
      console.error('Fetch config error:', err);
    }
  };

  const fetchStats = async (symbol) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/stats?symbol=${symbol}&period=24h`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatsData(data.data);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const fetchBotOrders = async (symbol) => {
    try {
      const token = localStorage.getItem('admin_token');
      const url = symbol ? `${API_BASE}/orders?symbol=${symbol}` : `${API_BASE}/orders`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBotOrders(data.data || []);
      }
    } catch (err) {
      console.error('Fetch orders error:', err);
    }
  };

  const fetchTradeHistory = async (symbol, page = 1, traderType = 'all') => {
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        symbol: symbol || selectedSymbol,
        page: page.toString(),
        pageSize: '20',
      });
      if (traderType !== 'all') {
        params.append('traderType', traderType);
      }
      const res = await fetch(`${API_BASE}/trade-history?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTradeHistory(data.data?.list || []);
        setTradeHistoryTotal(data.data?.total || 0);
        setTradeHistoryPage(page);
      }
    } catch (err) {
      console.error('Fetch trade history error:', err);
    }
  };

  const fetchUserStats = async (symbol, period = '24h') => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/user-stats?symbol=${symbol || selectedSymbol}&period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUserStats(data.data?.list || []);
      }
    } catch (err) {
      console.error('Fetch user stats error:', err);
    }
  };

  // 切换机器人开关
  const handleToggleBot = async (id, enabled) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/config/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(enabled ? '机器人已启动' : '机器人已暂停');
        fetchBotConfigs();
        fetchDashboardData(selectedSymbol);
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 手动执行策略
  const handleRunStrategy = async (symbol) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/run-strategy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(data.message);
        fetchAllData();
      } else {
        message.error(data.message || '执行失败');
      }
    } catch (err) {
      message.error('执行失败');
    }
  };

  // 手动执行交易
  const handleExecuteTrade = async (values) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        message.success(`机器人挂单成功: ${data.data.action} ${data.data.amount} @ ${data.data.price}`);
        setExecuteModalVisible(false);
        executeForm.resetFields();
        fetchAllData();
      } else {
        message.error(data.message || '执行失败');
      }
    } catch (err) {
      message.error('执行失败');
    }
  };

  // 创建配置
  const handleCreateConfig = async (values) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        message.success('配置创建成功');
        setConfigModalVisible(false);
        configForm.resetFields();
        fetchBotConfigs();
      } else {
        message.error(data.message || '创建失败');
      }
    } catch (err) {
      message.error('创建失败');
    }
  };

  // 更新配置
  const handleUpdateConfig = async (id, values) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/config/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        message.success('配置更新成功');
        setConfigModalVisible(false);
        setEditingConfig(null);
        fetchBotConfigs();
      } else {
        message.error(data.message || '更新失败');
      }
    } catch (err) {
      message.error('更新失败');
    }
  };

  // 删除配置
  const handleDeleteConfig = async (id) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/config/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        fetchBotConfigs();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (err) {
      message.error('删除失败');
    }
  };

  // 重置每日统计
  const handleResetDaily = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/reset-daily`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        message.success('每日统计已重置');
        fetchAllData();
      } else {
        message.error(data.message || '重置失败');
      }
    } catch (err) {
      message.error('重置失败');
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

  // 格式化数量
  const formatAmount = (value) => {
    if (!value) return '0';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  // 配置表格列
  const configColumns = [
    {
      title: '代币',
      dataIndex: 'token_symbol',
      key: 'token_symbol',
      render: (text) => <Tag color="#F59E0B">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleBot(record.id, checked)}
          checkedChildren="运行中"
          unCheckedChildren="已暂停"
        />
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (strategy) => (
        <Tooltip title={STRATEGY_MAP[strategy]?.desc}>
          <Tag color="blue">{STRATEGY_MAP[strategy]?.name || strategy}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '价格范围',
      key: 'price_range',
      render: (_, record) => (
        <Text>
          ${parseFloat(record.price_floor).toFixed(4)} - ${parseFloat(record.price_ceiling).toFixed(4)}
        </Text>
      ),
    },
    {
      title: '今日交易',
      key: 'today_trading',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="success">买入: {formatAmount(record.today_buy_amount)}</Text>
          <Text type="danger">卖出: {formatAmount(record.today_sell_amount)}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunStrategy(record.token_symbol)}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingConfig(record);
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
            onClick={() => handleDeleteConfig(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 挂单表格列
  const orderColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '代币',
      dataIndex: 'base_currency',
      key: 'base_currency',
      render: (text) => <Tag color="#F59E0B">{text}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'order_type',
      key: 'order_type',
      render: (type) => (
        <Tag color={type === 'buy' ? 'green' : 'red'}>
          {type === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '数量',
      dataIndex: 'amount',
      key: 'amount',
      render: (text) => formatAmount(parseFloat(text)),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (text) => `$${parseFloat(text).toFixed(4)}`,
    },
    {
      title: '已成交',
      dataIndex: 'filled_amount',
      key: 'filled_amount',
      render: (text) => formatAmount(parseFloat(text || 0)),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          'open': { text: '待成交', color: 'blue' },
          'partial': { text: '部分成交', color: 'orange' },
          'filled': { text: '已完成', color: 'green' },
          'cancelled': { text: '已取消', color: 'default' },
        };
        const s = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <RobotOutlined style={{ marginRight: 8 }} />
        机器人交易管理
      </Title>

      {/* 操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            value={selectedSymbol}
            onChange={setSelectedSymbol}
            style={{ width: 120 }}
          >
            <Option value="AI">AI</Option>
            <Option value="BTC">BTC</Option>
            <Option value="ETH">ETH</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchAllData}>
            刷新数据
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunStrategy(selectedSymbol)}
          >
            执行策略
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => {
              executeForm.setFieldsValue({ symbol: selectedSymbol });
              setExecuteModalVisible(true);
            }}
          >
            手动挂单
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingConfig(null);
              configForm.resetFields();
              configForm.setFieldsValue({
                token_symbol: selectedSymbol,
                strategy: 'market_making',
                buy_enabled: true,
                sell_enabled: true,
                max_price_change_percent: 5,
                daily_buy_limit: 10000,
                daily_sell_limit: 10000,
                min_order_amount: 10,
                max_order_amount: 100,
                order_interval_seconds: 60,
                max_open_orders: 5,
              });
              setConfigModalVisible(true);
            }}
          >
            新增配置
          </Button>
          <Button icon={<SyncOutlined />} onClick={handleResetDaily}>
            重置每日统计
          </Button>
        </Space>
      </Card>

      {/* 仪表盘概览 */}
      {dashboardData && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="当前价格"
                value={dashboardData.currentPrice}
                precision={4}
                prefix={<DollarOutlined />}
                suffix="USD"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="买入压力"
                value={dashboardData.orderbook?.buyPressure || 0}
                suffix="%"
                valueStyle={{ color: '#3f8600' }}
              />
              <Progress
                percent={parseFloat(dashboardData.orderbook?.buyPressure || 0)}
                showInfo={false}
                strokeColor="#3f8600"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="用户交易量 (24h)"
                value={dashboardData.tradingStats?.user?.buyAmount + dashboardData.tradingStats?.user?.sellAmount || 0}
                formatter={(value) => formatAmount(value)}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="机器人交易量 (24h)"
                value={dashboardData.tradingStats?.bot?.buyAmount + dashboardData.tradingStats?.bot?.sellAmount || 0}
                formatter={(value) => formatAmount(value)}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 交易统计对比 */}
      {statsData && (
        <Card title={<><BarChartOutlined /> 交易统计对比 (24h)</>} style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={12}>
              <Card type="inner" title="用户交易">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="买入"
                      value={statsData.user?.buyAmount || 0}
                      formatter={(v) => formatAmount(v)}
                      valueStyle={{ color: '#3f8600' }}
                      prefix={<RiseOutlined />}
                    />
                    <Text type="secondary">{statsData.user?.buyCount || 0} 笔</Text>
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="卖出"
                      value={statsData.user?.sellAmount || 0}
                      formatter={(v) => formatAmount(v)}
                      valueStyle={{ color: '#cf1322' }}
                      prefix={<FallOutlined />}
                    />
                    <Text type="secondary">{statsData.user?.sellCount || 0} 笔</Text>
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col span={12}>
              <Card type="inner" title="机器人交易">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="买入"
                      value={statsData.bot?.buyAmount || 0}
                      formatter={(v) => formatAmount(v)}
                      valueStyle={{ color: '#3f8600' }}
                      prefix={<RiseOutlined />}
                    />
                    <Text type="secondary">{statsData.bot?.buyCount || 0} 笔</Text>
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="卖出"
                      value={statsData.bot?.sellAmount || 0}
                      formatter={(v) => formatAmount(v)}
                      valueStyle={{ color: '#cf1322' }}
                      prefix={<FallOutlined />}
                    />
                    <Text type="secondary">{statsData.bot?.sellCount || 0} 笔</Text>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      <Tabs defaultActiveKey="configs">
        <TabPane
          tab={<><SettingOutlined /> 机器人配置</>}
          key="configs"
        >
          <Table
            dataSource={botConfigs}
            columns={configColumns}
            rowKey="id"
            pagination={false}
          />
        </TabPane>

        <TabPane
          tab={<><OrderedListOutlined /> 挂单记录</>}
          key="orders"
        >
          <Table
            dataSource={botOrders}
            columns={orderColumns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
          />
        </TabPane>

        <TabPane
          tab={<><HistoryOutlined /> 交易记录 <Badge count={tradeHistoryTotal} style={{ backgroundColor: '#52c41a' }} /></>}
          key="tradeHistory"
        >
          <div style={{ marginBottom: 16 }}>
            <Select
              value={traderTypeFilter}
              onChange={(value) => {
                setTraderTypeFilter(value);
                fetchTradeHistory(selectedSymbol, 1, value);
              }}
              style={{ width: 150 }}
            >
              <Option value="all">全部交易</Option>
              <Option value="user">用户交易</Option>
              <Option value="bot">机器人交易</Option>
            </Select>
          </div>
          <Table
            dataSource={tradeHistory}
            columns={[
              {
                title: '时间',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 160,
                render: (text) => new Date(text).toLocaleString('zh-CN'),
              },
              {
                title: '交易者',
                dataIndex: 'traderType',
                key: 'traderType',
                width: 140,
                render: (type, record) => (
                  <div>
                    <Tag color={type === 'bot' ? 'purple' : 'blue'}>
                      {type === 'bot' ? '机器人' : '用户'}
                    </Tag>
                    <div 
                      style={{ 
                        fontSize: 10, 
                        color: '#1890ff', 
                        marginTop: 4,
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                      }}
                      onClick={() => {
                        if (record.walletAddress && record.walletAddress !== '-') {
                          navigator.clipboard.writeText(record.walletAddress);
                          message.success('已复制钱包地址');
                        }
                      }}
                    >
                      {record.walletAddress ? `${record.walletAddress.slice(0, 8)}...${record.walletAddress.slice(-6)}` : '-'}
                    </div>
                  </div>
                ),
              },
              {
                title: '类型',
                dataIndex: 'tradeType',
                key: 'tradeType',
                width: 80,
                render: (type) => (
                  <Tag color={type === 'buy' ? 'green' : 'red'}>
                    {type === 'buy' ? '买入' : '卖出'}
                  </Tag>
                ),
              },
              {
                title: '代币',
                dataIndex: 'baseCurrency',
                key: 'baseCurrency',
                width: 80,
                render: (text) => <Tag color="orange">{text}</Tag>,
              },
              {
                title: '数量',
                dataIndex: 'amount',
                key: 'amount',
                width: 100,
                render: (value) => formatAmount(value),
              },
              {
                title: '成交价',
                dataIndex: 'price',
                key: 'price',
                width: 100,
                render: (value) => <span style={{ color: '#F59E0B' }}>${value?.toFixed(4)}</span>,
              },
              {
                title: '总额',
                dataIndex: 'totalValue',
                key: 'totalValue',
                width: 100,
                render: (value) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>${value?.toFixed(2)}</span>,
              },
              {
                title: '手续费',
                dataIndex: 'fee',
                key: 'fee',
                width: 80,
                render: (value) => <span style={{ color: '#999' }}>{value?.toFixed(4)}</span>,
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 80,
                render: (status) => (
                  <Tag color={status === 'completed' ? 'green' : 'blue'}>
                    {status === 'completed' ? '已完成' : status}
                  </Tag>
                ),
              },
            ]}
            rowKey="id"
            pagination={{
              current: tradeHistoryPage,
              pageSize: 20,
              total: tradeHistoryTotal,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: (page) => fetchTradeHistory(selectedSymbol, page, traderTypeFilter),
            }}
          />
        </TabPane>

        <TabPane
          tab={<><BarChartOutlined /> 用户汇总 <Badge count={userStats.length} style={{ backgroundColor: '#1890ff' }} /></>}
          key="userStats"
        >
          <div style={{ marginBottom: 16 }}>
            <Space>
              <span>时间范围：</span>
              <Select
                value={userStatsPeriod}
                onChange={(value) => {
                  setUserStatsPeriod(value);
                  fetchUserStats(selectedSymbol, value);
                }}
                style={{ width: 120 }}
              >
                <Option value="24h">近24小时</Option>
                <Option value="7d">近7天</Option>
                <Option value="30d">近30天</Option>
                <Option value="90d">近90天</Option>
              </Select>
              <span>交易者类型：</span>
              <Select
                value={userStatsTraderType}
                onChange={(value) => setUserStatsTraderType(value)}
                style={{ width: 120 }}
              >
                <Option value="all">全部</Option>
                <Option value="user">用户</Option>
                <Option value="bot">机器人</Option>
              </Select>
            </Space>
          </div>
          <Table
            dataSource={userStats.filter(s => userStatsTraderType === 'all' || s.traderType === userStatsTraderType)}
            columns={[
              {
                title: '钱包地址',
                dataIndex: 'walletAddress',
                key: 'walletAddress',
                width: 280,
                render: (address) => (
                  <Tooltip title="点击复制">
                    <span 
                      style={{ 
                        fontFamily: 'monospace', 
                        fontSize: 11, 
                        cursor: 'pointer',
                        color: '#1890ff',
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(address);
                        message.success('已复制');
                      }}
                    >
                      {address}
                    </span>
                  </Tooltip>
                ),
              },
              {
                title: '用户信息',
                key: 'userInfo',
                width: 150,
                render: (_, record) => (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{record.userNickname}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{record.userPhone || '-'}</div>
                  </div>
                ),
              },
              {
                title: '类型',
                dataIndex: 'traderType',
                key: 'traderType',
                width: 80,
                render: (type) => (
                  <Tag color={type === 'bot' ? 'purple' : 'blue'}>
                    {type === 'bot' ? '机器人' : '用户'}
                  </Tag>
                ),
              },
              {
                title: '买入',
                key: 'buy',
                width: 150,
                render: (_, record) => (
                  <div>
                    <div>
                      <RiseOutlined style={{ color: '#3f8600', marginRight: 4 }} />
                      <span style={{ color: '#3f8600', fontWeight: 'bold' }}>
                        {formatAmount(record.buyAmount)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>{record.buyCount} 笔</div>
                  </div>
                ),
              },
              {
                title: '卖出',
                key: 'sell',
                width: 150,
                render: (_, record) => (
                  <div>
                    <div>
                      <FallOutlined style={{ color: '#cf1322', marginRight: 4 }} />
                      <span style={{ color: '#cf1322', fontWeight: 'bold' }}>
                        {formatAmount(record.sellAmount)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>{record.sellCount} 笔</div>
                  </div>
                ),
              },
              {
                title: '交易总额',
                key: 'totalValue',
                width: 120,
                render: (_, record) => (
                  <span style={{ fontWeight: 'bold', color: '#F59E0B' }}>
                    ${formatAmount(record.buyValue + record.sellValue)}
                  </span>
                ),
              },
              {
                title: '手续费',
                dataIndex: 'feeTotal',
                key: 'feeTotal',
                width: 100,
                render: (fee) => <span style={{ color: '#999' }}>{fee?.toFixed(4)}</span>,
              },
              {
                title: '净买入',
                key: 'netBuy',
                width: 100,
                render: (_, record) => {
                  const net = record.buyAmount - record.sellAmount;
                  return (
                    <span style={{ color: net > 0 ? '#3f8600' : net < 0 ? '#cf1322' : '#999', fontWeight: 'bold' }}>
                      {net > 0 ? '+' : ''}{formatAmount(net)}
                    </span>
                  );
                },
              },
              {
                title: '交易时间',
                key: 'tradeTime',
                width: 180,
                render: (_, record) => (
                  <div style={{ fontSize: 11 }}>
                    <div>首笔: {new Date(record.firstTradeAt).toLocaleString('zh-CN')}</div>
                    <div>末笔: {new Date(record.lastTradeAt).toLocaleString('zh-CN')}</div>
                  </div>
                ),
              },
            ]}
            rowKey="userId"
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 个用户` }}
            summary={(pageData) => {
              let totalBuyAmount = 0;
              let totalSellAmount = 0;
              let totalBuyCount = 0;
              let totalSellCount = 0;
              let totalFee = 0;
              pageData.forEach(({ buyAmount, sellAmount, buyCount, sellCount, feeTotal }) => {
                totalBuyAmount += buyAmount;
                totalSellAmount += sellAmount;
                totalBuyCount += buyCount;
                totalSellCount += sellCount;
                totalFee += feeTotal;
              });
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>合计 ({pageData.length} 个用户)</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <strong style={{ color: '#3f8600' }}>{formatAmount(totalBuyAmount)} ({totalBuyCount}笔)</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <strong style={{ color: '#cf1322' }}>{formatAmount(totalSellAmount)} ({totalSellCount}笔)</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} colSpan={2} />
                  <Table.Summary.Cell index={4}>
                    <strong>{totalFee.toFixed(4)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <strong style={{ color: totalBuyAmount - totalSellAmount > 0 ? '#3f8600' : '#cf1322' }}>
                      {formatAmount(totalBuyAmount - totalSellAmount)}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} />
                </Table.Summary.Row>
              );
            }}
          />
        </TabPane>
      </Tabs>

      {/* 配置弹窗 */}
      <Modal
        title={editingConfig ? '编辑配置' : '新增配置'}
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          setEditingConfig(null);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingConfig) {
              handleUpdateConfig(editingConfig.id, values);
            } else {
              handleCreateConfig(values);
            }
          }}
        >
          <Form.Item name="token_symbol" label="代币符号" rules={[{ required: true }]}>
            <Input disabled={!!editingConfig} placeholder="如: AI" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price_floor" label="价格下限" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={0.0001} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price_ceiling" label="价格上限" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={0.0001} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="strategy" label="交易策略">
            <Select>
              <Option value="market_making">做市策略</Option>
              <Option value="trend_follow">趋势跟踪</Option>
              <Option value="mean_revert">均值回归</Option>
            </Select>
          </Form.Item>

          <Form.Item name="target_price" label="目标价格 (均值回归策略)">
            <InputNumber style={{ width: '100%' }} min={0} step={0.0001} placeholder="可选" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buy_enabled" label="允许买入" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sell_enabled" label="允许卖出" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="daily_buy_limit" label="每日买入限额">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="daily_sell_limit" label="每日卖出限额">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="min_order_amount" label="最小挂单金额">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_order_amount" label="最大挂单金额">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="order_interval_seconds" label="挂单间隔 (秒)">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_open_orders" label="最大挂单数">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="max_price_change_percent" label="单次最大价格变动 (%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingConfig ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setConfigModalVisible(false);
                setEditingConfig(null);
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 手动挂单弹窗 */}
      <Modal
        title="机器人手动挂单"
        open={executeModalVisible}
        onCancel={() => setExecuteModalVisible(false)}
        footer={null}
      >
        <Form
          form={executeForm}
          layout="vertical"
          onFinish={handleExecuteTrade}
        >
          <Form.Item name="symbol" label="代币" rules={[{ required: true }]}>
            <Select>
              <Option value="AI">AI</Option>
              <Option value="BTC">BTC</Option>
              <Option value="ETH">ETH</Option>
            </Select>
          </Form.Item>

          <Form.Item name="action" label="交易方向" rules={[{ required: true }]}>
            <Select>
              <Option value="buy">买入</Option>
              <Option value="sell">卖出</Option>
            </Select>
          </Form.Item>

          <Form.Item name="amount" label="数量" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>

          <Form.Item name="price" label="价格 (留空使用当前价格)">
            <InputNumber style={{ width: '100%' }} min={0} step={0.0001} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                执行
              </Button>
              <Button onClick={() => setExecuteModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
