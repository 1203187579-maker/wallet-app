import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Tag, Spin, Result, Button, message } from 'antd';
import {
  UserOutlined,
  WalletOutlined,
  DollarOutlined,
  SwapOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
  LockOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import * as api from '../utils/api';

const COLORS = ['#F59E0B', '#1890ff', '#52c41a', '#722ed1', '#eb2f96'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [trends, setTrends] = useState([]);
  const [changes, setChanges] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, trendsRes] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardTrends(7)
      ]);
      
      if (statsRes && statsRes.data) {
        setStats(statsRes.data);
      }
      if (trendsRes && trendsRes.data) {
        setTrends(trendsRes.data.trends || []);
        setChanges(trendsRes.data.changes || {});
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
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

  // 核心指标卡片
  const metricCards = [
    { 
      title: '总用户', 
      value: stats.totalUsers || 0, 
      icon: <UserOutlined />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      change: changes.users,
    },
    { 
      title: '活跃用户', 
      value: stats.activeUsers || 0, 
      icon: <TeamOutlined />,
      gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    },
    { 
      title: '质押总额(GPU)', 
      value: stats.totalStaked || 0, 
      icon: <LockOutlined />,
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
      change: changes.stake,
    },
    { 
      title: 'C2C订单', 
      value: stats.c2cOrders || 0, 
      icon: <SwapOutlined />,
      gradient: 'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)',
      change: changes.c2c,
    },
  ];

  // 质押分布饼图数据
  const pieData = (stats.stakeDistribution || []).map((item, index) => ({
    name: item.name,
    value: item.amount,
    percent: item.percent,
  }));

  const recentUsers = stats.recentUsers || [];
  const recentOrders = stats.recentOrders || [];

  const userColumns = [
    { 
      title: '钱包地址', 
      dataIndex: 'wallet_address', 
      width: 180, 
      render: (v) => v ? (
        <span 
          style={{ fontSize: 12, fontFamily: 'monospace', color: '#1890ff', cursor: 'pointer' }}
          onClick={() => {
            navigator.clipboard.writeText(v);
            message.success('已复制');
          }}
        >
          {v.slice(0, 8)}...{v.slice(-6)}
        </span>
      ) : '-' 
    },
    { title: '用户名', dataIndex: 'nickname', render: (v) => v || '-' },
    { title: '邮箱', dataIndex: 'email', render: (v) => v || '-' },
    { 
      title: '状态', 
      dataIndex: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '活跃' : '禁用'}
        </Tag>
      )
    },
    { title: '注册时间', dataIndex: 'created_at', width: 180, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
  ];

  const orderColumns = [
    { title: 'ID', dataIndex: 'id', width: 60, render: (v) => v ? String(v).slice(0, 8) : '-' },
    { title: '类型', dataIndex: 'type', render: (v) => v === 'buy' ? '购买' : '出售' },
    { title: '代币', dataIndex: 'token', render: (v) => v || '-' },
    { title: '数量', dataIndex: 'amount', render: (v) => v || '-' },
    { title: '单价', dataIndex: 'price', render: (v) => v || '-' },
    { 
      title: '状态', 
      dataIndex: 'status',
      render: (status) => {
        const colors = { pending: 'orange', completed: 'green', cancelled: 'red' };
        const texts = { pending: '待处理', completed: '已完成', cancelled: '已取消' };
        return <Tag color={colors[status] || 'default'}>{texts[status] || status || '-'}</Tag>;
      }
    },
    { title: '时间', dataIndex: 'created_at', width: 180, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
  ];

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)', minHeight: '100vh', padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff' }}>
            数据概览
          </h1>
          <p style={{ margin: '8px 0 0', color: '#8b8ba7', fontSize: 14 }}>
            实时监控平台运营数据
          </p>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchData}
          style={{ borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
        >
          刷新数据
        </Button>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]}>
        {metricCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card 
              style={{ 
                borderRadius: 16, 
                border: 'none',
                background: card.gradient,
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              }}
              bodyStyle={{ padding: 24 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 8 }}>
                    {card.title}
                  </div>
                  <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                  </div>
                  {card.change !== undefined && (
                    <div style={{ 
                      marginTop: 8, 
                      display: 'flex', 
                      alignItems: 'center',
                      color: card.change >= 0 ? '#d4f8d4' : '#ffcdd2'
                    }}>
                      {card.change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      <span style={{ marginLeft: 4, fontSize: 13 }}>
                        {Math.abs(card.change)}% 较昨日
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: '#fff'
                }}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 趋势图表 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* 用户增长趋势 */}
        <Col xs={24} lg={12}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>📈 用户增长趋势</span>}
            style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8b8ba7' }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 12, fill: '#8b8ba7' }} stroke="rgba(255,255,255,0.2)" />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', background: '#1a1a2e' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#b0b0c8' }}
                  formatter={(value) => [value, '新增用户']}
                />
                <Area 
                  type="monotone" 
                  dataKey="newUsers" 
                  stroke="#667eea" 
                  strokeWidth={3}
                  fill="url(#colorUsers)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* C2C交易趋势 */}
        <Col xs={24} lg={12}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>💱 C2C交易趋势</span>}
            style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8b8ba7' }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 12, fill: '#8b8ba7' }} stroke="rgba(255,255,255,0.2)" />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', background: '#1a1a2e' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#b0b0c8' }}
                />
                <Bar dataKey="c2cVolume" name="交易量(GPU)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 质押趋势 + 分布 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>💰 质押趋势</span>}
            style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#8b8ba7' }} stroke="rgba(255,255,255,0.2)" />
                <YAxis tick={{ fontSize: 12, fill: '#8b8ba7' }} stroke="rgba(255,255,255,0.2)" />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', background: '#1a1a2e' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#b0b0c8' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="stakeAmount" 
                  name="质押金额(GPU)"
                  stroke="#52c41a" 
                  strokeWidth={3}
                  dot={{ fill: '#52c41a', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 质押分布饼图 */}
        <Col xs={24} lg={8}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>🥧 质押分布</span>}
            style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [`${value} GPU (${props.payload.percent}%)`, name]}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', background: '#1a1a2e' }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#b0b0c8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: '#666', padding: '80px 0' }}>
                暂无质押数据
              </div>
            )}
            {/* 图例 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
              {pieData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 3, 
                    background: COLORS[index % COLORS.length] 
                  }} />
                  <span style={{ fontSize: 12, color: '#b0b0c8' }}>{item.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近数据表格 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>👥 最近注册用户</span>}
            style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Table
              columns={userColumns}
              dataSource={recentUsers}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无数据' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>📋 最近C2C订单</span>}
            style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无数据' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 其他指标 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} sm={6}>
          <Card 
            style={{ borderRadius: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa' }}>
              {stats.totalWallets || 0}
            </div>
            <div style={{ color: '#8b8ba7', marginTop: 4 }}>钱包总量</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            style={{ borderRadius: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#5eead4' }}>
              {stats.totalAssets ? parseFloat(stats.totalAssets).toFixed(2) : 0}
            </div>
            <div style={{ color: '#8b8ba7', marginTop: 4 }}>总资产(USDT)</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            style={{ borderRadius: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>
              {stats.pendingKYC || 0}
            </div>
            <div style={{ color: '#8b8ba7', marginTop: 4 }}>待审KYC</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card 
            style={{ borderRadius: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}
            bodyStyle={{ padding: 20 }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>
              {stats.referrals || 0}
            </div>
            <div style={{ color: '#8b8ba7', marginTop: 4 }}>推广人数</div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
