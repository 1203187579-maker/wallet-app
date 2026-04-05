import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, Space, Input, Select, Modal, Descriptions, message, Popconfirm, Avatar, Form, InputNumber, Typography, Tooltip, Checkbox, Alert, DatePicker } from 'antd';
import { SearchOutlined, EyeOutlined, LockOutlined, UnlockOutlined, PlusCircleOutlined, MinusCircleOutlined, KeyOutlined, CopyOutlined, StopOutlined, CloseOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

// 禁用功能选项
const DISABLE_FEATURES = [
  { key: 'login', label: '登录', description: '无法登录，提示「账号已被禁用」' },
  { key: 'api', label: 'API 调用', description: '所有需要认证的接口都无法访问，返回 401' },
  { key: 'asset', label: '资产操作', description: '无法转账、交易、质押、C2C 出售' },
  { key: 'wallet', label: '钱包', description: '无法查看钱包、导出私钥' },
  { key: 'plaza', label: '社交广场', description: '无法发帖、评论、创建群组' },
  { key: 'referral', label: '推广收益', description: '无法领取推广返佣' },
  { key: 'kyc', label: 'KYC 认证', description: '无法提交/更新认证信息' },
];

export default function Users() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // 充值/扣减相关状态
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustType, setAdjustType] = useState('add'); // 'add' 或 'subtract'
  const [adjustForm] = Form.useForm();
  const [adjustLoading, setAdjustLoading] = useState(false);

  // 禁用功能相关状态
  const [disableVisible, setDisableVisible] = useState(false);
  const [disableUser, setDisableUser] = useState(null);
  const [disableMode, setDisableMode] = useState('disable'); // 'disable' 或 'enable'
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableDays, setDisableDays] = useState(0); // 0表示永久
  const [disableReason, setDisableReason] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers({ page, pageSize, search: searchText, status: statusFilter });
      setUsers(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleViewDetail = async (user) => {
    try {
      const res = await api.getUserDetail(user.id);
      console.log('用户详情数据:', res.data);
      console.log('助记词:', res.data?.mnemonic);
      console.log('私钥:', res.data?.privateKey);
      setCurrentUser(res.data);
      setDetailVisible(true);
    } catch (error) {
      message.error('获取用户详情失败');
      console.error('获取用户详情失败:', error);
    }
  };

  // 打开禁用弹窗
  const handleOpenDisable = (user) => {
    setDisableUser(user);
    const hasDisabledFeatures = user.disabledFeatures && user.disabledFeatures.length > 0;
    if (!hasDisabledFeatures) {
      // 禁用模式：默认选中所有功能
      setDisableMode('disable');
      setSelectedFeatures(['login', 'api', 'asset', 'wallet', 'plaza', 'referral', 'kyc']);
      setDisableDays(0);
      setDisableReason('');
    } else {
      // 启用模式
      setDisableMode('enable');
      setSelectedFeatures([]);
    }
    setDisableVisible(true);
  };

  // 执行禁用/启用
  const handleDisableSubmit = async () => {
    setDisableLoading(true);
    try {
      if (disableMode === 'disable') {
        // 构建禁用功能详细信息
        const disabledFeaturesDetail = {};
        const now = new Date();
        const until = disableDays > 0 
          ? new Date(now.getTime() + disableDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        
        selectedFeatures.forEach(feature => {
          disabledFeaturesDetail[feature] = {
            until: until,
            reason: disableReason || '',
            disabledAt: now.toISOString()
          };
        });

        await api.updateUser(disableUser.id, { 
          disabledFeatures: selectedFeatures,
          disabledFeaturesDetail: disabledFeaturesDetail
        });
        message.success(disableDays > 0 
          ? `已禁用选中的功能，${disableDays}天后自动解除` 
          : '已永久禁用选中的功能');
      } else {
        // 启用：清空禁用功能列表
        await api.updateUser(disableUser.id, { 
          disabledFeatures: [],
          disabledFeaturesDetail: {}
        });
        message.success('已恢复所有功能');
      }
      setDisableVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setDisableLoading(false);
    }
  };

  // 封禁/解封用户
  const handleBan = (user) => {
    if (user.isBanned) {
      // 解封确认
      Modal.confirm({
        title: '解封确认',
        content: (
          <div>
            <p>确定要解封用户 <strong>{user.username || user.id}</strong> 吗？</p>
            {user.bannedUntil && (
              <p style={{ color: '#52c41a' }}>
                原定解封时间：{new Date(user.bannedUntil).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        ),
        okText: '确定解封',
        cancelText: '取消',
        onOk: async () => {
          try {
            await api.unbanUser(user.id);
            message.success('解封成功');
            fetchUsers();
          } catch (error) {
            message.error('操作失败：' + (error.message || '未知错误'));
          }
        }
      });
    } else {
      // 封禁弹窗 - 带天数和原因输入
      let banDays = 0; // 默认永久
      let banReason = '';
      
      Modal.confirm({
        title: '封禁用户',
        width: 480,
        content: (
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 12 }}>
              用户：<strong>{user.username || user.id}</strong>
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>封禁天数：</label>
              <InputNumber
                min={0}
                max={3650}
                value={banDays}
                onChange={(val) => { banDays = val || 0; }}
                addonAfter="天"
                style={{ width: '100%' }}
                placeholder="0 表示永久封禁"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                0 = 永久封禁，设置天数后到期自动解封
              </Text>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>封禁原因：</label>
              <TextArea
                rows={3}
                placeholder="输入封禁原因（可选）"
                onChange={(e) => { banReason = e.target.value; }}
                maxLength={200}
                showCount
              />
            </div>
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              message="注意：封禁该用户将同时封禁其所有下级用户"
              showIcon
            />
          </div>
        ),
        okText: '确认封禁',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            await api.banUser(user.id, banDays, banReason);
            message.success(banDays > 0 ? `封禁成功，${banDays}天后自动解封` : '封禁成功（永久）');
            fetchUsers();
          } catch (error) {
            message.error('操作失败：' + (error.message || '未知错误'));
          }
        }
      });
    }
  };

  // 打开充值弹窗
  const handleOpenAdjust = (user, type) => {
    setAdjustUser(user);
    setAdjustType(type);
    adjustForm.resetFields();
    adjustForm.setFieldsValue({ symbol: 'USDT', amount: undefined, remark: '' });
    setAdjustVisible(true);
  };

  // 执行充值/扣减
  const handleAdjustSubmit = async () => {
    try {
      const values = await adjustForm.validateFields();
      setAdjustLoading(true);
      
      await api.adjustUserAsset(adjustUser.id, {
        symbol: values.symbol,
        amount: adjustType === 'subtract' ? -values.amount : values.amount,
        remark: values.remark || (adjustType === 'add' ? '后台充值' : '后台扣减'),
      });
      
      message.success(adjustType === 'add' ? '充值成功' : '扣减成功');
      setAdjustVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('操作失败：' + (error.message || '未知错误'));
    } finally {
      setAdjustLoading(false);
    }
  };

  // 复制到剪贴板
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const columns = [
    { 
      title: '手机号', 
      dataIndex: 'phone',
      width: 140,
      render: (phone) => phone ? (
        <span style={{ color: '#a78bfa', fontWeight: 500 }}>{phone}</span>
      ) : <span style={{ color: '#666' }}>-</span>
    },
    { 
      title: '钱包地址', 
      dataIndex: 'walletAddress',
      width: 160,
      render: (address) => address ? (
        <Tooltip title="点击复制完整地址">
          <Space size={4} style={{ cursor: 'pointer' }} onClick={() => handleCopy(address)}>
            <code style={{ fontSize: 12, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', padding: '2px 6px', borderRadius: 4 }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </code>
            <CopyOutlined style={{ fontSize: 12, color: '#60a5fa' }} />
          </Space>
        </Tooltip>
      ) : <span style={{ color: '#666' }}>-</span>
    },
    { 
      title: '推荐码', 
      dataIndex: 'referralCode',
      width: 100,
      render: (code) => code ? (
        <Tag style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>{code}</Tag>
      ) : <span style={{ color: '#666' }}>-</span>
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 80,
      render: (status) => (
        <Tag style={{ 
          background: status === 'active' ? 'rgba(82,196,26,0.15)' : 'rgba(255,77,79,0.15)', 
          border: status === 'active' ? '1px solid rgba(82,196,26,0.3)' : '1px solid rgba(255,77,79,0.3)',
          color: status === 'active' ? '#52c41a' : '#ff4d4f'
        }}>
          {status === 'active' ? '活跃' : '禁用'}
        </Tag>
      )
    },
    { 
      title: '封禁状态', 
      dataIndex: 'isBanned',
      width: 140,
      render: (isBanned, record) => {
        if (!isBanned) return (
          <Tag style={{ background: 'rgba(82,196,26,0.15)', border: '1px solid rgba(82,196,26,0.3)', color: '#52c41a' }}>正常</Tag>
        );
        
        return (
          <Space direction="vertical" size={0}>
            <Tag style={{ background: 'rgba(255,77,79,0.15)', border: '1px solid rgba(255,77,79,0.3)', color: '#ff4d4f' }}>已封禁</Tag>
            {record.bannedUntil ? (
              <Text style={{ fontSize: 11, color: '#8b8ba7' }}>
                至 {new Date(record.bannedUntil).toLocaleDateString('zh-CN')}
              </Text>
            ) : (
              <Text style={{ fontSize: 11, color: '#ff4d4f' }}>永久</Text>
            )}
          </Space>
        );
      }
    },
    { 
      title: '功能禁用', 
      dataIndex: 'disabledFeatures',
      width: 160,
      render: (features, record) => {
        if (!features || features.length === 0) return <span style={{ color: '#666' }}>-</span>;
        
        const featureLabels = {
          login: '登录',
          api: 'API',
          asset: '资产',
          wallet: '钱包',
          plaza: '社交',
          referral: '推广',
          kyc: 'KYC'
        };
        
        return (
          <Tooltip title={
            <div>
              {features.map(f => {
                const detail = record.disabledFeaturesDetail?.[f];
                return (
                  <div key={f} style={{ marginBottom: 4 }}>
                    <strong>{featureLabels[f] || f}</strong>
                    {detail?.until && <span> - 至 {new Date(detail.until).toLocaleDateString('zh-CN')}</span>}
                    {detail?.reason && <span><br/>原因: {detail.reason}</span>}
                  </div>
                );
              })}
            </div>
          }>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, cursor: 'pointer' }}>
              {features.slice(0, 3).map(f => (
                <Tag key={f} style={{ background: 'rgba(250,140,22,0.15)', border: '1px solid rgba(250,140,22,0.3)', color: '#fa8c16', fontSize: 11 }}>
                  {featureLabels[f] || f}
                </Tag>
              ))}
              {features.length > 3 && (
                <Tag style={{ background: 'rgba(139,139,167,0.15)', border: '1px solid rgba(139,139,167,0.3)', color: '#8b8ba7', fontSize: 11 }}>
                  +{features.length - 3}
                </Tag>
              )}
            </div>
          </Tooltip>
        );
      }
    },
    { 
      title: 'KYC', 
      dataIndex: 'kycStatus',
      width: 90,
      render: (status) => {
        const config = {
          approved: { bg: 'rgba(82,196,26,0.15)', border: 'rgba(82,196,26,0.3)', color: '#52c41a', text: '已认证' },
          pending: { bg: 'rgba(250,140,22,0.15)', border: 'rgba(250,140,22,0.3)', color: '#fa8c16', text: '待审核' },
          rejected: { bg: 'rgba(255,77,79,0.15)', border: 'rgba(255,77,79,0.3)', color: '#ff4d4f', text: '已拒绝' },
          none: { bg: 'rgba(139,139,167,0.15)', border: 'rgba(139,139,167,0.3)', color: '#8b8ba7', text: '未认证' },
        };
        const c = config[status] || config.none;
        return <Tag style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>{c.text}</Tag>;
      }
    },
    { 
      title: '注册时间', 
      dataIndex: 'createdAt',
      width: 150,
      render: (time) => <span style={{ color: '#8b8ba7', fontSize: 12 }}>{time ? new Date(time).toLocaleString('zh-CN') : '-'}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            style={{ color: '#60a5fa' }}
          >
            详情
          </Button>
          <Button 
            type="link" 
            size="small" 
            icon={<PlusCircleOutlined />}
            onClick={() => handleOpenAdjust(record, 'add')}
            style={{ color: '#52c41a' }}
          >
            充值
          </Button>
          <Button 
            type="link" 
            size="small" 
            icon={<MinusCircleOutlined />}
            onClick={() => handleOpenAdjust(record, 'subtract')}
            style={{ color: '#ff4d4f' }}
          >
            扣减
          </Button>
          <Button 
            type="link" 
            size="small" 
            icon={!record.disabledFeatures || record.disabledFeatures.length === 0 ? <LockOutlined /> : <UnlockOutlined />}
            onClick={() => handleOpenDisable(record)}
            style={{ color: !record.disabledFeatures || record.disabledFeatures.length === 0 ? '#fa8c16' : '#52c41a' }}
          >
            {!record.disabledFeatures || record.disabledFeatures.length === 0 ? '禁用' : '启用'}
          </Button>
          <Button 
            type="link" 
            size="small" 
            icon={<StopOutlined />}
            onClick={() => handleBan(record)}
            style={{ color: record.isBanned ? '#52c41a' : '#ff4d4f' }}
          >
            {record.isBanned ? '解封' : '封禁'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>
            用户管理
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14 }}>
            查看和管理平台用户
          </p>
        </div>
      </div>
      
      <Card style={{ 
        marginBottom: 16, 
        borderRadius: 12, 
        border: '1px solid #e8e8e8', 
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
      bodyStyle={{ padding: 20 }}
      >
        <Space wrap>
          <Search
            placeholder="搜索用户名/邮箱/手机/钱包地址"
            allowClear
            style={{ width: 320 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
          />
          <Select
            style={{ width: 140 }}
            placeholder="状态筛选"
            allowClear
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <Option value="active">活跃</Option>
            <Option value="disabled">禁用</Option>
          </Select>
          <Button 
            type="primary" 
            onClick={handleSearch} 
            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)', borderColor: '#F59E0B', borderRadius: 8 }}
          >
            搜索
          </Button>
        </Space>
      </Card>

      <Card style={{ 
        borderRadius: 12, 
        border: '1px solid #e8e8e8', 
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => <span style={{ color: '#666' }}>共 {total} 条记录</span>,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      <Modal
        title={<span style={{ fontSize: 18, color: '#1a1a2e' }}>📋 用户详情</span>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        closeIcon={<CloseOutlined style={{ color: '#999' }} />}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={900}
        styles={{ 
          body: { maxHeight: '50vh', overflowY: 'auto', background: '#fff' },
          header: { background: '#fff', borderBottom: '1px solid #f0f0f0' },
          content: { background: '#fff' }
        }}
      >
        {currentUser && (
          <Descriptions 
            bordered 
            column={2} 
            size="small"
            labelStyle={{ background: '#fafafa', color: '#666', fontWeight: 500 }}
            contentStyle={{ background: '#fff', color: '#333' }}
          >
            {/* 钱包密钥信息 - 放在最前面 */}
            <Descriptions.Item label="钱包地址" span={2}>
              {currentUser.walletAddress ? (
                <Space>
                  <code style={{ fontSize: 12, background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, color: '#F59E0B' }}>{currentUser.walletAddress}</code>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(currentUser.walletAddress)}>复制</Button>
                </Space>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="钱包类型">
              <Tag color="blue">{currentUser.walletType === 'created' ? '创建' : 
                       currentUser.walletType === 'imported_mnemonic' ? '助记词导入' : 
                       currentUser.walletType === 'imported_private_key' ? '私钥导入' : '未知'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="密钥状态">
              <Space>
                {currentUser.hasMnemonic ? <Tag color="green">有助记词</Tag> : <Tag color="red">无助记词</Tag>}
                {currentUser.hasPrivateKey ? <Tag color="green">有私钥</Tag> : <Tag color="red">无私钥</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="助记词" span={2}>
              {currentUser.mnemonic ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <code style={{ fontSize: 13, wordBreak: 'break-all', background: '#fffbe6', padding: '8px 12px', borderRadius: 6, display: 'block', border: '1px solid #ffe58f', color: '#d48806' }}>
                    {currentUser.mnemonic}
                  </code>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(currentUser.mnemonic)}>复制助记词</Button>
                </Space>
              ) : <Tag color="red">无</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="私钥" span={2}>
              {currentUser.privateKey ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <code style={{ fontSize: 12, wordBreak: 'break-all', background: '#fff1f0', padding: '8px 12px', borderRadius: 6, display: 'block', border: '1px solid #ffa39e', color: '#cf1322' }}>
                    {currentUser.privateKey}
                  </code>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(currentUser.privateKey)}>复制私钥</Button>
                </Space>
              ) : <Tag color="red">无</Tag>}
            </Descriptions.Item>
            
            {/* 用户基本信息 */}
            <Descriptions.Item label="用户ID">{currentUser.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">{currentUser.username}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{currentUser.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机">{currentUser.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={currentUser.status === 'active' ? 'green' : 'red'}>
                {currentUser.status === 'active' ? '活跃' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="KYC状态">
              <Tag color={currentUser.kycStatus === 'approved' ? 'green' : 'orange'}>
                {currentUser.kycStatus === 'approved' ? '已认证' : '未认证'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="推荐码">{currentUser.referralCode || '-'}</Descriptions.Item>
            <Descriptions.Item label="推荐人">{currentUser.referrer || '-'}</Descriptions.Item>
            <Descriptions.Item label="总资产">{currentUser.totalAssets || '0.00'} USDT</Descriptions.Item>
            <Descriptions.Item label="质押金额">{currentUser.stakedAmount || '0.00'} USDT</Descriptions.Item>
            <Descriptions.Item label="C2C订单数">{currentUser.c2cOrderCount || 0}</Descriptions.Item>
            <Descriptions.Item label="推广人数">{currentUser.referralCount || 0}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{currentUser.createdAt}</Descriptions.Item>
            <Descriptions.Item label="最后登录">{currentUser.lastLoginAt || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 充值/扣减弹窗 */}
      <Modal
        title={
          <span style={{ fontSize: 18, color: '#1a1a2e' }}>
            {adjustType === 'add' ? '💰 充值代币' : '📉 扣减代币'}
            {adjustUser && <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
              ({adjustUser.walletAddress?.slice(0,6)}...{adjustUser.walletAddress?.slice(-4)})
            </span>}
          </span>
        }
        open={adjustVisible}
        onCancel={() => setAdjustVisible(false)}
        closeIcon={<CloseOutlined style={{ color: '#999' }} />}
        onOk={handleAdjustSubmit}
        confirmLoading={adjustLoading}
        okText={adjustType === 'add' ? '确认充值' : '确认扣减'}
        okButtonProps={{ danger: adjustType === 'subtract' }}
        styles={{ 
          body: { background: '#fff' },
          header: { background: '#fff', borderBottom: '1px solid #f0f0f0' },
          content: { background: '#fff' }
        }}
      >
        <Form form={adjustForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item 
            name="symbol" 
            label="代币类型"
            rules={[{ required: true, message: '请选择代币类型' }]}
          >
            <Select placeholder="选择代币">
              <Option value="USDT">USDT</Option>
              <Option value="AI">AI</Option>
              <Option value="GPU">GPU</Option>
              <Option value="BTC">BTC</Option>
              <Option value="ETH">ETH</Option>
            </Select>
          </Form.Item>
          <Form.Item 
            name="amount" 
            label={adjustType === 'add' ? '充值数量' : '扣减数量'}
            rules={[
              { required: true, message: '请输入数量' },
              { type: 'number', min: 0.0001, message: '数量必须大于0' }
            ]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="输入数量"
              precision={4}
              min={0}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea 
              placeholder="输入备注信息（可选）" 
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 禁用功能弹窗 */}
      <Modal
        title={
          <span style={{ fontSize: 18, color: '#1a1a2e' }}>
            {disableMode === 'disable' ? <><LockOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />禁用用户功能</> : <><UnlockOutlined style={{ color: '#52c41a', marginRight: 8 }} />启用用户功能</>}
            {disableUser && <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
              ({disableUser.walletAddress?.slice(0,6)}...{disableUser.walletAddress?.slice(-4)})
            </span>}
          </span>
        }
        open={disableVisible}
        onCancel={() => setDisableVisible(false)}
        closeIcon={<CloseOutlined style={{ color: '#999' }} />}
        onOk={handleDisableSubmit}
        confirmLoading={disableLoading}
        okText={disableMode === 'disable' ? '确认禁用' : '确认启用'}
        okButtonProps={{ danger: disableMode === 'disable' }}
        width={650}
        styles={{ 
          body: { background: '#fff' },
          header: { background: '#fff', borderBottom: '1px solid #f0f0f0' },
          content: { background: '#fff' }
        }}
      >
        {disableMode === 'disable' ? (
          <>
            <Alert
              message="请选择要禁用的功能"
              description="被禁用的功能将无法使用，用户数据不会被删除"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Checkbox.Group
              value={selectedFeatures}
              onChange={setSelectedFeatures}
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DISABLE_FEATURES.map(feature => (
                  <div 
                    key={feature.key} 
                    style={{ 
                      padding: '10px 14px', 
                      background: selectedFeatures.includes(feature.key) ? '#fff7e6' : '#fafafa',
                      borderRadius: 8,
                      border: `1px solid ${selectedFeatures.includes(feature.key) ? '#ffd591' : '#e8e8e8'}`
                    }}
                  >
                    <Checkbox value={feature.key} style={{ marginBottom: 2 }}>
                      <span style={{ fontWeight: 500, fontSize: 14, color: '#333' }}>{feature.label}</span>
                    </Checkbox>
                    <div style={{ marginLeft: 24, color: '#666', fontSize: 12 }}>
                      {feature.description}
                    </div>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button size="small" onClick={() => setSelectedFeatures(DISABLE_FEATURES.map(f => f.key))}>
                全选
              </Button>
              <Button size="small" onClick={() => setSelectedFeatures(['login'])}>
                仅禁用登录
              </Button>
              <Button size="small" onClick={() => setSelectedFeatures([])}>
                清空
              </Button>
            </div>

            {/* 禁用时长和原因 */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, color: '#666', fontSize: 13 }}>禁用时长</label>
                <Space>
                  <InputNumber
                    value={disableDays}
                    onChange={setDisableDays}
                    min={0}
                    max={365}
                    style={{ width: 100 }}
                    placeholder="天数"
                  />
                  <span style={{ color: '#666' }}>天 {disableDays === 0 && <span style={{ color: '#fa8c16' }}>(永久禁用)</span>}</span>
                </Space>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, color: '#666', fontSize: 13 }}>禁用原因</label>
                <TextArea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="请输入禁用原因（可选）"
                  rows={2}
                />
              </div>
            </div>
          </>
        ) : (
          <Alert
            message="确认启用该用户？"
            description="启用后，用户将恢复正常使用所有功能"
            type="success"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
}
