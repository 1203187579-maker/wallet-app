import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Input, Button, Modal, Form, InputNumber, message, Select, Row, Col, Statistic } from 'antd';
import { SearchOutlined, EditOutlined, DollarOutlined, WalletOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { Search } = Input;
const { Option } = Select;

export default function Assets() {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [editVisible, setEditVisible] = useState(false);
  const [currentAsset, setCurrentAsset] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAssets();
  }, [page, pageSize]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (searchText) params.search = searchText;
      if (minBalance) params.minBalance = minBalance;
      
      const res = await api.getAssets(params);
      setAssets(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setCurrentAsset(record);
    form.setFieldsValue({ 
      usdtBalance: record.usdtBalance,
      aiBalance: record.aiBalance,
    });
    setEditVisible(true);
  };

  const handleSaveAsset = async (values) => {
    try {
      // 分别更新USDT和AI余额
      if (values.usdtBalance !== undefined) {
        await api.updateAsset(currentAsset.userId, 'USDT', { balance: values.usdtBalance });
      }
      if (values.aiBalance !== undefined) {
        await api.updateAsset(currentAsset.userId, 'AI', { balance: values.aiBalance });
      }
      if (values.gpuBalance !== undefined) {
        await api.updateAsset(currentAsset.userId, 'GPU', { balance: values.gpuBalance });
      }
      message.success('资产更新成功');
      setEditVisible(false);
      fetchAssets();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const formatBalance = (balance) => {
    if (!balance || balance === 0) return <span style={{ color: '#999' }}>0.00</span>;
    return <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{balance.toFixed(4)}</span>;
  };

  const columns = [
    { 
      title: '钱包地址', 
      dataIndex: 'walletAddress',
      width: 180,
      fixed: 'left',
      render: (address) => (
        <span 
          style={{ fontSize: 11, fontFamily: 'monospace', color: '#1890ff', cursor: 'pointer' }}
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
      title: '用户昵称', 
      dataIndex: 'username',
      width: 100,
      render: (text) => <span style={{ fontWeight: 500 }}>{text || '-'}</span>
    },
    { 
      title: 'USDT余额', 
      dataIndex: 'usdtBalance',
      width: 120,
      align: 'right',
      render: (balance) => (
        <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>
          {(balance || 0).toFixed(2)}
        </span>
      )
    },
    { 
      title: 'AI余额', 
      dataIndex: 'aiBalance',
      width: 120,
      align: 'right',
      render: (balance) => (
        <span style={{ color: '#FF6B35', fontWeight: 'bold' }}>
          {(balance || 0).toFixed(4)}
        </span>
      )
    },
    { 
      title: 'GPU余额', 
      dataIndex: 'gpuBalance',
      width: 120,
      align: 'right',
      render: (balance) => (
        <span style={{ color: '#10B981', fontWeight: 'bold' }}>
          {(balance || 0).toFixed(4)}
        </span>
      )
    },
    { 
      title: 'BTC余额', 
      dataIndex: 'btcBalance',
      width: 100,
      align: 'right',
      render: (balance) => formatBalance(balance)
    },
    { 
      title: 'ETH余额', 
      dataIndex: 'ethBalance',
      width: 100,
      align: 'right',
      render: (balance) => formatBalance(balance)
    },
    { 
      title: 'BNB余额', 
      dataIndex: 'bnbBalance',
      width: 100,
      align: 'right',
      render: (balance) => formatBalance(balance)
    },
    { 
      title: '总资产估值', 
      dataIndex: 'totalBalance',
      width: 120,
      align: 'right',
      render: (balance) => (
        <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: 14 }}>
          ${(balance || 0).toFixed(2)}
        </span>
      )
    },
    { 
      title: '更新时间', 
      dataIndex: 'updatedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
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

  // 计算统计数据
  const stats = {
    totalUsers: total,
    totalUsdt: assets.reduce((sum, a) => sum + (a.usdtBalance || 0), 0),
    totalAi: assets.reduce((sum, a) => sum + (a.aiBalance || 0), 0),
    totalGpu: assets.reduce((sum, a) => sum + (a.gpuBalance || 0), 0),
    totalValue: assets.reduce((sum, a) => sum + (a.totalBalance || 0), 0),
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>💰 资产管理</h2>
      
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="用户总数"
              value={stats.totalUsers}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="USDT总量"
              value={stats.totalUsdt.toFixed(2)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#F59E0B' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="AI总量"
              value={stats.totalAi.toFixed(2)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#FF6B35' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="GPU总量"
              value={stats.totalGpu.toFixed(2)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#10B981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="总资产估值"
              value={`$${stats.totalValue.toFixed(2)}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
      
      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space wrap>
          <Search
            placeholder="搜索钱包地址"
            allowClear
            style={{ width: 280 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => { setPage(1); fetchAssets(); }}
            enterButton={<SearchOutlined />}
          />
          <Select 
            style={{ width: 150 }} 
            placeholder="最小资产" 
            allowClear
            value={minBalance}
            onChange={(value) => { setMinBalance(value || ''); }}
          >
            <Option value="100">≥ 100</Option>
            <Option value="500">≥ 500</Option>
            <Option value="1000">≥ 1,000</Option>
            <Option value="5000">≥ 5,000</Option>
            <Option value="10000">≥ 10,000</Option>
          </Select>
          <Button type="primary" onClick={() => { setPage(1); fetchAssets(); }} style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
            搜索
          </Button>
        </Space>
      </Card>

      {/* 资产列表 */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={assets}
          rowKey="userId"
          loading={loading}
          scroll={{ x: 1200 }}
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

      {/* 编辑弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>💵 编辑用户资产</span>}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleSaveAsset} layout="vertical">
          <Form.Item label="钱包地址">
            <Input value={currentAsset?.walletAddress} disabled style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item label="用户昵称">
            <Input value={currentAsset?.username} disabled />
          </Form.Item>
          <Form.Item name="usdtBalance" label="USDT余额">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="aiBalance" label="AI余额">
            <InputNumber style={{ width: '100%' }} min={0} precision={4} />
          </Form.Item>
          <Form.Item name="gpuBalance" label="GPU余额">
            <InputNumber style={{ width: '100%' }} min={0} precision={4} />
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
    </div>
  );
}
