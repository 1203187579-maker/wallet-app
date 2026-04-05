import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, Avatar, message, Spin } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  WalletOutlined,
  DollarOutlined,
  LockOutlined,
  SwapOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  SettingOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CreditCardOutlined,
  MessageOutlined,
  RobotOutlined,
  StopOutlined,
  StockOutlined,
  InfoCircleOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import * as api from './utils/api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Wallets from './pages/Wallets';
import Assets from './pages/Assets';
import Staking from './pages/Staking';
import C2C from './pages/C2C';
import KYC from './pages/KYC';
import Referrals from './pages/Referrals';
import Config from './pages/Config';
import Prices from './pages/Prices';
import PaymentInfo from './pages/PaymentInfo';
import Support from './pages/Support';
import AiBots from './pages/AiBots';
import BannedWords from './pages/BannedWords';
import ChatGroups from './pages/ChatGroups';
import MarketCap from './pages/MarketCap';
import TokenInfo from './pages/TokenInfo';
import BotTrading from './pages/BotTrading';
import Announcements from './pages/Announcements';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/announcements', icon: <NotificationOutlined />, label: '公告管理' },
  { key: '/wallets', icon: <WalletOutlined />, label: '钱包管理' },
  { key: '/assets', icon: <DollarOutlined />, label: '资产管理' },
  { key: '/staking', icon: <LockOutlined />, label: '质押管理' },
  { key: '/c2c', icon: <SwapOutlined />, label: 'C2C交易' },
  { key: '/kyc', icon: <SafetyCertificateOutlined />, label: 'KYC认证' },
  { key: '/payment-info', icon: <CreditCardOutlined />, label: '收款信息' },
  { key: '/support', icon: <MessageOutlined />, label: '客服管理' },
  { key: '/chat-groups', icon: <TeamOutlined />, label: '群组管理' },
  { key: '/ai-bots', icon: <RobotOutlined />, label: 'AI机器人' },
  { key: '/market-cap', icon: <StockOutlined />, label: 'AI市值管理' },
  { key: '/bot-trading', icon: <RobotOutlined />, label: '机器人交易' },
  { key: '/banned-words', icon: <StopOutlined />, label: '违禁词管理' },
  { key: '/referrals', icon: <TeamOutlined />, label: '推广体系' },
  { key: '/prices', icon: <LineChartOutlined />, label: '价格管理' },
  { key: '/token-info', icon: <InfoCircleOutlined />, label: '代币信息' },
  { key: '/config', icon: <SettingOutlined />, label: '系统配置' },
];

function MainLayout({ onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userData = localStorage.getItem('admin_user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    message.success('已退出登录');
    onLogout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: '#001529',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{
            color: '#F59E0B',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}>
            {collapsed ? '🚀' : '🚀 BoostAra'}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 18 }}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar style={{ backgroundColor: '#F59E0B' }} icon={<UserOutlined />} />
              <span>{user?.username || '管理员'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: '#fff',
          borderRadius: 8,
          minHeight: 'calc(100vh - 112px)',
          overflow: 'auto',
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/wallets" element={<Wallets />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/staking" element={<Staking />} />
            <Route path="/c2c" element={<C2C />} />
            <Route path="/kyc" element={<KYC />} />
            <Route path="/payment-info" element={<PaymentInfo />} />
            <Route path="/support" element={<Support />} />
            <Route path="/chat-groups" element={<ChatGroups />} />
            <Route path="/ai-bots" element={<AiBots />} />
            <Route path="/market-cap" element={<MarketCap />} />
            <Route path="/bot-trading" element={<BotTrading />} />
            <Route path="/banned-words" element={<BannedWords />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/prices" element={<Prices />} />
            <Route path="/token-info" element={<TokenInfo />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    setIsLoggedIn(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <Login onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/*" element={isLoggedIn ? <MainLayout onLogout={() => setIsLoggedIn(false)} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
