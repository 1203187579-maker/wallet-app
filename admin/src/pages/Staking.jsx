import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Form, InputNumber, message, Row, Col, Statistic, Tooltip, Alert, Divider, Input, Switch, Select, Popconfirm, Descriptions } from 'antd';
import { LockOutlined, EditOutlined, InfoCircleOutlined, ReloadOutlined, PlusOutlined, MinusCircleOutlined, CheckOutlined, CloseOutlined, StopOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { Option } = Select;
const { Search } = Input;

export default function Staking() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [config, setConfig] = useState([]);
  const [configVisible, setConfigVisible] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [form] = Form.useForm();
  const [rateConfig, setRateConfig] = useState([]);
  
  // 新增产品相关状态
  const [addVisible, setAddVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [addRateConfig, setAddRateConfig] = useState([
    { day: 1, rate: 0.6 },
    { day: 2, rate: 0.7 },
    { day: 3, rate: 0.8 },
    { day: 4, rate: 0.9 },
    { day: 5, rate: 1.0 },
    { day: 6, rate: 1.1 },
    { day: 7, rate: 1.2 },
    { day: 8, rate: 1.3 },
    { day: 9, rate: 1.4 },
    { day: 10, rate: 1.5 },
  ]);
  const [addLoading, setAddLoading] = useState(false);

  // 用户明细相关状态
  const [searchWallet, setSearchWallet] = useState('');
  const [userDetailVisible, setUserDetailVisible] = useState(false);
  const [userDetail, setUserDetail] = useState(null);
  const [userStakes, setUserStakes] = useState([]);
  const [userRewards, setUserRewards] = useState([]);

  useEffect(() => {
    fetchRecords();
    fetchConfig();
  }, [page, pageSize]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.getStakeRecords({ page, pageSize });
      setRecords(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.getStakeConfig();
      setConfig(res.data || []);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  // 查询用户质押明细
  const handleSearchUser = async () => {
    if (!searchWallet || searchWallet.length < 10) {
      message.warning('请输入有效的钱包地址');
      return;
    }
    try {
      const res = await api.getUserStakeDetail(searchWallet);
      if (res.success) {
        setUserDetail(res.data?.user);
        setUserStakes(res.data?.stakes || []);
        setUserRewards(res.data?.rewards || []);
        setUserDetailVisible(true);
      } else {
        message.error(res.message || '查询失败');
      }
    } catch (error) {
      message.error('查询失败');
    }
  };

  const handleEditConfig = (record) => {
    setCurrentConfig(record);
    form.setFieldsValue({
      daily_rate: record.daily_rate ? (record.daily_rate * 100) : 0,
      minAmount: record.minAmount,
      accumulate_rewards: record.accumulate_rewards !== false,
    });
    
    if (record.stake_type === 'flexible' && record.rate_config) {
      setRateConfig(record.rate_config);
    } else if (record.stake_type === 'flexible') {
      setRateConfig([
        { day: 1, rate: 0.6 },
        { day: 2, rate: 0.7 },
        { day: 3, rate: 0.8 },
        { day: 4, rate: 0.9 },
        { day: 5, rate: 1.0 },
        { day: 6, rate: 1.1 },
        { day: 7, rate: 1.2 },
        { day: 8, rate: 1.3 },
        { day: 9, rate: 1.4 },
        { day: 10, rate: 1.5 },
      ]);
    } else {
      setRateConfig([]);
    }
    
    setConfigVisible(true);
  };

  const handleRateConfigChange = (index, field, value) => {
    const newConfig = [...rateConfig];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setRateConfig(newConfig);
  };

  const handleAddRateDay = () => {
    const lastDay = rateConfig.length > 0 ? rateConfig[rateConfig.length - 1].day : 0;
    setRateConfig([...rateConfig, { day: lastDay + 1, rate: 0.5 }]);
  };

  const handleRemoveRateDay = (index) => {
    const newConfig = rateConfig.filter((_, i) => i !== index);
    setRateConfig(newConfig);
  };

  const handleSaveConfig = async (values) => {
    try {
      const dataToSave = {
        daily_rate: values.daily_rate / 100,
        minAmount: values.minAmount,
        accumulate_rewards: values.accumulate_rewards,
      };
      
      if (currentConfig.stake_type === 'flexible' && rateConfig.length > 0) {
        dataToSave.rate_config = rateConfig;
      }
      
      await api.updateStakeConfig(currentConfig.id, dataToSave);
      message.success('配置更新成功');
      setConfigVisible(false);
      fetchConfig();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleToggleActive = async (record, isActive) => {
    try {
      await api.updateStakeConfig(record.id, { is_active: isActive });
      message.success(isActive ? '已开启' : '已关闭');
      fetchConfig();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleOpenAdd = () => {
    addForm.resetFields();
    addForm.setFieldsValue({
      stake_type: 'flexible',
      duration_days: undefined,
      daily_rate: 0.8,
      min_amount: 100,
      accumulate_rewards: true,
    });
    setAddRateConfig([
      { day: 1, rate: 0.6 },
      { day: 2, rate: 0.7 },
      { day: 3, rate: 0.8 },
      { day: 4, rate: 0.9 },
      { day: 5, rate: 1.0 },
      { day: 6, rate: 1.1 },
      { day: 7, rate: 1.2 },
      { day: 8, rate: 1.3 },
      { day: 9, rate: 1.4 },
      { day: 10, rate: 1.5 },
    ]);
    setAddVisible(true);
  };

  const handleAddSubmit = async (values) => {
    setAddLoading(true);
    try {
      const dataToSave = {
        stake_type: values.stake_type,
        duration_days: values.stake_type === 'flexible' ? null : values.duration_days,
        daily_rate: values.daily_rate / 100,
        min_amount: values.min_amount,
        accumulate_rewards: values.accumulate_rewards,
      };
      
      if (values.stake_type === 'flexible' && addRateConfig.length > 0) {
        dataToSave.rate_config = addRateConfig;
      }
      
      await api.createStakeConfig(dataToSave);
      message.success('产品创建成功');
      setAddVisible(false);
      fetchConfig();
    } catch (error) {
      message.error(error.message || '创建失败');
    } finally {
      setAddLoading(false);
    }
  };

  const handleAddRateConfigChange = (index, field, value) => {
    const newConfig = [...addRateConfig];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setAddRateConfig(newConfig);
  };

  const handleAddNewRateDay = () => {
    const lastDay = addRateConfig.length > 0 ? addRateConfig[addRateConfig.length - 1].day : 0;
    setAddRateConfig([...addRateConfig, { day: lastDay + 1, rate: 0.5 }]);
  };

  const handleRemoveAddRateDay = (index) => {
    const newConfig = addRateConfig.filter((_, i) => i !== index);
    setAddRateConfig(newConfig);
  };

  // 计算统计数据
  const stats = {
    totalStaking: records.filter(r => r.status === 'active').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0),
    stakingCount: records.filter(r => r.status === 'active').length,
    totalRewards: records.filter(r => r.status === 'withdrawn').reduce((sum, r) => sum + parseFloat(r.expectedReward || 0), 0),
    withdrawnCount: records.filter(r => r.status === 'withdrawn').length,
  };

  const columns = [
    { 
      title: '钱包地址', 
      dataIndex: 'walletAddress',
      width: 200,
      render: (address) => (
        <span 
          style={{ fontSize: 12, fontFamily: 'monospace', color: '#1890ff', cursor: 'pointer' }}
          onClick={() => {
            if (address && address !== '-') {
              navigator.clipboard.writeText(address);
              message.success('已复制');
            }
          }}
        >
          {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '-'}
        </span>
      )
    },
    { 
      title: '质押金额', 
      dataIndex: 'amount',
      render: (amount) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>{parseFloat(amount || 0).toFixed(2)} GPU</span>
    },
    { 
      title: '质押类型', 
      dataIndex: 'stakeType',
      render: (type) => {
        const types = {
          'flexible': { text: '灵活质押', color: 'purple' },
          'fixed_180': { text: '180天定期', color: 'blue' },
          'fixed_360': { text: '360天定期', color: 'cyan' },
        };
        const config = types[type] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    { 
      title: '周期', 
      dataIndex: 'duration',
      render: (days) => days === 0 ? <Tag color="purple">灵活</Tag> : <Tag color="blue">{days}天</Tag>
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      render: (status) => {
        const statusConfig = {
          active: { color: 'blue', text: '质押中', tip: '用户资产已锁定，正在计息' },
          completed: { color: 'green', text: '已到期', tip: '质押到期，待用户提取' },
          withdrawn: { color: 'orange', text: '已取出', tip: '用户已取出本金和收益' },
          cancelled: { color: 'red', text: '已取消', tip: '管理员取消，本金已退还' }
        };
        const { color, text, tip } = statusConfig[status] || { color: 'default', text: status };
        return (
          <Tooltip title={tip}>
            <Tag color={color}>{text}</Tag>
          </Tooltip>
        );
      }
    },
    { 
      title: '开始时间', 
      dataIndex: 'startTime',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    { 
      title: '结束时间', 
      dataIndex: 'endTime',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Popconfirm
              title="确认取消质押？"
              description="取消后本金将退还给用户"
              onConfirm={() => handleCancelStake(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                取消
              </Button>
            </Popconfirm>
          )}
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />} 
            onClick={() => {
              setSearchWallet(record.walletAddress);
              handleSearchUser();
            }}
          >
            明细
          </Button>
        </Space>
      ),
    },
  ];

  // 取消质押
  const handleCancelStake = async (id) => {
    try {
      const res = await api.cancelStake(id);
      if (res.success) {
        message.success('质押已取消，本金已退还');
        fetchRecords();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>🔒 质押管理</h2>
      
      {/* 说明卡片 */}
      <Alert
        message="质押管理说明"
        description={
          <div>
            <p><strong>灵活质押收益规则：</strong>可自定义循环周期，每天收益率可单独配置</p>
            <p style={{ color: '#10B981' }}>默认：第1天 0.6% → 第2天 0.7% → ... → 第10天 1.5%，第11天重新循环</p>
            <p style={{ marginTop: 12 }}><strong>定期质押：</strong>固定日利率，到期自动结算</p>
            <p style={{ marginTop: 12 }}><strong>收益累计规则：</strong></p>
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li><Tag color="green">累计</Tag> - 收益会一直累计，用户可随时领取</li>
              <li><Tag color="orange">不累计</Tag> - 收益24小时不领取则失效（刺激用户每日登录）</li>
            </ul>
            <p style={{ marginTop: 12 }}><strong>状态说明：</strong></p>
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li><Tag color="blue">质押中</Tag> - 正在计息，不可取出</li>
              <li><Tag color="green">已到期</Tag> - 质押到期，待用户取出</li>
              <li><Tag color="orange">已取出</Tag> - 用户已取出本金和收益</li>
              <li><Tag color="red">已取消</Tag> - 管理员取消，本金已退还</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title={<span>质押中金额 <Tooltip title="当前正在质押中的总金额"><InfoCircleOutlined /></Tooltip></span>}
              value={stats.totalStaking}
              precision={2}
              suffix="GPU"
              valueStyle={{ color: '#F59E0B' }}
            />
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              {stats.stakingCount} 笔订单
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title={<span>已取出收益 <Tooltip title="用户已取出的总收益"><InfoCircleOutlined /></Tooltip></span>}
              value={stats.totalRewards}
              precision={2}
              suffix="GPU"
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              {stats.withdrawnCount} 笔已取出
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="质押产品数"
              value={config.length}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              {config.reduce((sum, c) => sum + (c.participants || 0), 0)} 人参与
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="总质押订单"
              value={total}
              suffix="笔"
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8 }}>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => { fetchRecords(); fetchConfig(); }}>
                刷新
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 用户查询 */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space>
          <Search
            placeholder="输入钱包地址查询用户质押明细"
            allowClear
            style={{ width: 400 }}
            value={searchWallet}
            onChange={(e) => setSearchWallet(e.target.value)}
            onSearch={handleSearchUser}
            enterButton={<SearchOutlined />}
          />
        </Space>
      </Card>

      {/* 质押配置 */}
      <Card 
        title={
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            ⚙️ 质押产品配置 
            <Tooltip title="配置不同的质押周期和收益率，用户可选择参与">
              <InfoCircleOutlined style={{ marginLeft: 8, fontSize: 14, color: '#999' }} />
            </Tooltip>
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd} style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
            新增产品
          </Button>
        }
        style={{ marginBottom: 16, borderRadius: 12 }}
      >
        <Table
          columns={[
            { 
              title: '质押类型', 
              dataIndex: 'stake_type',
              render: (type) => {
                const types = {
                  'flexible': '灵活质押',
                  'fixed_180': '180天定期',
                  'fixed_360': '360天定期',
                };
                return <span style={{ fontWeight: 'bold' }}>{types[type] || type}</span>;
              }
            },
            { 
              title: '周期', 
              dataIndex: 'duration',
              render: (days) => days === 0 ? <Tag color="purple">灵活</Tag> : <Tag color="blue">{days}天</Tag>
            },
            { 
              title: '最小金额', 
              dataIndex: 'minAmount', 
              render: (v) => `${v} GPU` 
            },
            { 
              title: '收益累计', 
              dataIndex: 'accumulate_rewards',
              render: (v) => (
                <Tooltip title={v ? '收益会一直累计，用户可随时领取' : '收益24小时不领取则失效'}>
                  <Tag color={v ? 'green' : 'orange'}>
                    {v ? '累计' : '不累计'}
                  </Tag>
                </Tooltip>
              )
            },
            { 
              title: '状态', 
              dataIndex: 'is_active',
              render: (v, record) => (
                <Switch
                  checked={v}
                  onChange={(checked) => handleToggleActive(record, checked)}
                  checkedChildren={<CheckOutlined />}
                  unCheckedChildren={<CloseOutlined />}
                />
              )
            },
            { 
              title: '参与人数', 
              dataIndex: 'participants',
              render: (v) => <span style={{ color: '#1890ff' }}>{v} 人</span>
            },
            { 
              title: '总质押额', 
              dataIndex: 'totalStaked', 
              render: (v) => <span style={{ fontWeight: 'bold' }}>{parseFloat(v || 0).toFixed(2)} GPU</span> 
            },
            {
              title: '操作',
              render: (_, record) => (
                <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEditConfig(record)}>
                  编辑
                </Button>
              ),
            },
          ]}
          dataSource={config}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 质押记录 */}
      <Card 
        title={
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            📋 用户质押记录 
            <Tooltip title="查看所有用户的质押订单详情">
              <InfoCircleOutlined style={{ marginLeft: 8, fontSize: 14, color: '#999' }} />
            </Tooltip>
          </span>
        }
        style={{ borderRadius: 12 }}
      >
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 用户明细弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>👤 用户质押明细</span>}
        open={userDetailVisible}
        onCancel={() => setUserDetailVisible(false)}
        footer={<Button onClick={() => setUserDetailVisible(false)}>关闭</Button>}
        width={900}
      >
        {userDetail && (
          <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="钱包地址">
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{userDetail.walletAddress}</span>
            </Descriptions.Item>
            <Descriptions.Item label="用户昵称">{userDetail.nickname || '未知'}</Descriptions.Item>
            <Descriptions.Item label="总质押次数">{userDetail.totalStakes || 0} 次</Descriptions.Item>
            <Descriptions.Item label="总质押金额">{userDetail.totalAmount || 0} GPU</Descriptions.Item>
          </Descriptions>
        )}
        
        <h4 style={{ marginTop: 16, marginBottom: 8 }}>质押记录</h4>
        <Table
          columns={[
            { title: '质押金额', dataIndex: 'amount', render: (v) => `${parseFloat(v).toFixed(2)} GPU` },
            { title: '类型', dataIndex: 'stake_type', render: (t) => t === 'flexible' ? '灵活' : t },
            { title: '状态', dataIndex: 'status', render: (s) => {
              const colors = { active: 'blue', completed: 'green', withdrawn: 'orange', cancelled: 'red' };
              const texts = { active: '质押中', completed: '已到期', withdrawn: '已取出', cancelled: '已取消' };
              return <Tag color={colors[s]}>{texts[s]}</Tag>;
            }},
            { title: '开始时间', dataIndex: 'start_date', render: (t) => t ? new Date(t).toLocaleString() : '-' },
          ]}
          dataSource={userStakes}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
        />

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>收益记录</h4>
        <Table
          columns={[
            { title: '收益金额', dataIndex: 'amount', render: (v) => `${parseFloat(v).toFixed(4)} GPU` },
            { title: '类型', dataIndex: 'type', render: (t) => t === 'daily' ? '日收益' : '结算' },
            { title: '状态', dataIndex: 'status', render: (s) => {
              const colors = { pending: 'orange', claimed: 'green', expired: 'red' };
              const texts = { pending: '待领取', claimed: '已领取', expired: '已过期' };
              return <Tag color={colors[s]}>{texts[s]}</Tag>;
            }},
            { title: '生成时间', dataIndex: 'created_at', render: (t) => t ? new Date(t).toLocaleString() : '-' },
          ]}
          dataSource={userRewards}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
        />
      </Modal>

      {/* 编辑配置弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>⚙️ 编辑质押配置</span>}
        open={configVisible}
        onCancel={() => setConfigVisible(false)}
        footer={null}
        width={currentConfig?.stake_type === 'flexible' ? 700 : 520}
      >
        <Alert
          message="修改配置后，新质押的用户将按新规则执行"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} onFinish={handleSaveConfig} layout="vertical">
          <Form.Item label="质押类型">
            <Input 
              value={{
                'flexible': '灵活质押',
                'fixed_180': '180天定期',
                'fixed_360': '360天定期',
              }[currentConfig?.stake_type] || currentConfig?.stake_type} 
              disabled 
            />
          </Form.Item>
          <Form.Item label="周期">
            <Input 
              value={currentConfig?.duration === 0 ? '灵活（随时可赎回）' : `${currentConfig?.duration}天`} 
              disabled 
            />
          </Form.Item>
          
          {currentConfig?.stake_type === 'flexible' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 12, fontWeight: 500 }}>
                📈 循环收益配置
                <Tooltip title="设置每个周期的日收益率，质押天数超过周期后重新循环">
                  <InfoCircleOutlined style={{ marginLeft: 8, fontSize: 12, color: '#999' }} />
                </Tooltip>
              </div>
              <div style={{ 
                background: '#f5f5f5', 
                borderRadius: 8, 
                padding: 16,
                maxHeight: 300,
                overflowY: 'auto'
              }}>
                {rateConfig.map((item, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: 8,
                    gap: 12
                  }}>
                    <span style={{ width: 60, color: '#666' }}>第{item.day}天</span>
                    <InputNumber
                      value={item.rate}
                      onChange={(v) => handleRateConfigChange(index, 'rate', v)}
                      min={0}
                      max={100}
                      precision={1}
                      style={{ width: 100 }}
                    />
                    <span style={{ color: '#666' }}>%</span>
                    {rateConfig.length > 1 && (
                      <Button 
                        type="text" 
                        danger 
                        icon={<MinusCircleOutlined />}
                        onClick={() => handleRemoveRateDay(index)}
                      />
                    )}
                  </div>
                ))}
                <Button 
                  type="dashed" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddRateDay}
                  style={{ marginTop: 8, width: '100%' }}
                >
                  添加天数
                </Button>
              </div>
              <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                循环周期：{rateConfig.length}天 | 
                收益范围：{Math.min(...rateConfig.map(r => r.rate))}% ~ {Math.max(...rateConfig.map(r => r.rate))}%
              </div>
            </div>
          )}
          
          {currentConfig?.stake_type !== 'flexible' && (
            <Form.Item 
              name="daily_rate" 
              label="日利率(%)" 
              rules={[{ required: true, message: '请输入日利率' }]}
              extra="例如：输入 1.2 表示日利率 1.2%"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
            </Form.Item>
          )}
          
          <Form.Item 
            name="minAmount" 
            label="最小质押金额(GPU)" 
            rules={[{ required: true, message: '请输入最小金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          
          <Form.Item 
            name="accumulate_rewards" 
            label="收益累计" 
            valuePropName="checked"
            extra={
              <div style={{ marginTop: 4 }}>
                <span style={{ color: '#52c41a' }}>开启：</span>收益会一直累计，用户可随时领取
                <br />
                <span style={{ color: '#faad14' }}>关闭：</span>收益24小时不领取则失效，不累计
              </div>
            }
          >
            <Switch 
              checkedChildren="累计" 
              unCheckedChildren="不累计"
            />
          </Form.Item>
          
          <Divider />
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setConfigVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                保存配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增产品弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>➕ 新增质押产品</span>}
        open={addVisible}
        onCancel={() => setAddVisible(false)}
        footer={null}
        width={700}
      >
        <Alert
          message="新增产品后，前端将立即显示该质押选项"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={addForm} onFinish={handleAddSubmit} layout="vertical">
          <Form.Item 
            name="stake_type" 
            label="质押类型" 
            rules={[{ required: true, message: '请选择质押类型' }]}
          >
            <Select placeholder="选择质押类型">
              <Option value="flexible">灵活质押</Option>
              <Option value="fixed_180">180天定期</Option>
              <Option value="fixed_360">360天定期</Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.stake_type !== currentValues.stake_type}
          >
            {({ getFieldValue }) => {
              const stakeType = getFieldValue('stake_type');
              return stakeType && stakeType !== 'flexible' ? (
                <Form.Item 
                  name="duration_days" 
                  label="质押天数" 
                  rules={[{ required: true, message: '请输入质押天数' }]}
                >
                  <InputNumber style={{ width: '100%' }} min={1} placeholder="如：180" />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.stake_type !== currentValues.stake_type}
          >
            {({ getFieldValue }) => {
              const stakeType = getFieldValue('stake_type');
              return stakeType === 'flexible' ? (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ marginBottom: 12, fontWeight: 500 }}>
                    📈 循环收益配置
                    <Tooltip title="设置每个周期的日收益率，质押天数超过周期后重新循环">
                      <InfoCircleOutlined style={{ marginLeft: 8, fontSize: 12, color: '#999' }} />
                    </Tooltip>
                  </div>
                  <div style={{ 
                    background: '#f5f5f5', 
                    borderRadius: 8, 
                    padding: 16,
                    maxHeight: 300,
                    overflowY: 'auto'
                  }}>
                    {addRateConfig.map((item, index) => (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: 8,
                        gap: 12
                      }}>
                        <span style={{ width: 60, color: '#666' }}>第{item.day}天</span>
                        <InputNumber
                          value={item.rate}
                          onChange={(v) => handleAddRateConfigChange(index, 'rate', v)}
                          min={0}
                          max={100}
                          precision={1}
                          style={{ width: 100 }}
                        />
                        <span style={{ color: '#666' }}>%</span>
                        {addRateConfig.length > 1 && (
                          <Button 
                            type="text" 
                            danger 
                            icon={<MinusCircleOutlined />}
                            onClick={() => handleRemoveAddRateDay(index)}
                          />
                        )}
                      </div>
                    ))}
                    <Button 
                      type="dashed" 
                      icon={<PlusOutlined />} 
                      onClick={handleAddNewRateDay}
                      style={{ marginTop: 8, width: '100%' }}
                    >
                      添加天数
                    </Button>
                  </div>
                  <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                    循环周期：{addRateConfig.length}天 | 
                    收益范围：{Math.min(...addRateConfig.map(r => r.rate))}% ~ {Math.max(...addRateConfig.map(r => r.rate))}%
                  </div>
                </div>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.stake_type !== currentValues.stake_type}
          >
            {({ getFieldValue }) => {
              const stakeType = getFieldValue('stake_type');
              return stakeType && stakeType !== 'flexible' ? (
                <Form.Item 
                  name="daily_rate" 
                  label="日利率(%)" 
                  rules={[{ required: true, message: '请输入日利率' }]}
                  extra="例如：输入 1.2 表示日利率 1.2%"
                >
                  <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item 
            name="min_amount" 
            label="最小质押金额(GPU)" 
            rules={[{ required: true, message: '请输入最小金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          
          <Form.Item 
            name="accumulate_rewards" 
            label="收益累计" 
            valuePropName="checked"
            extra={
              <div style={{ marginTop: 4 }}>
                <span style={{ color: '#52c41a' }}>开启：</span>收益会一直累计，用户可随时领取
                <br />
                <span style={{ color: '#faad14' }}>关闭：</span>收益24小时不领取则失效，不累计
              </div>
            }
          >
            <Switch 
              checkedChildren="累计" 
              unCheckedChildren="不累计"
            />
          </Form.Item>
          
          <Divider />
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAddVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={addLoading} style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
                创建产品
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
