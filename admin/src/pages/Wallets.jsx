import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Input, Select, Button, message } from 'antd';
import { SearchOutlined, WalletOutlined, CopyOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { Search } = Input;
const { Option } = Select;

export default function Wallets() {
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchWallets();
  }, [page, pageSize]);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await api.getWallets({ page, pageSize, search: searchText });
      setWallets(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const columns = [
    { 
      title: '钱包地址', 
      dataIndex: 'address',
      render: (address) => (
        <Space>
          <code style={{ fontSize: 12 }}>{address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '-'}</code>
          {address && (
            <Button 
              type="link" 
              size="small" 
              icon={<CopyOutlined />}
              onClick={() => handleCopy(address)}
            />
          )}
        </Space>
      )
    },
    { 
      title: '用户昵称', 
      dataIndex: 'username',
      render: (text) => <span style={{ fontWeight: 500 }}>{text || '-'}</span>
    },
    { 
      title: '类型', 
      dataIndex: 'type',
      render: (type) => {
        const colors = { main: 'blue', trading: 'green' };
        const texts = { main: '主钱包', trading: '交易钱包' };
        return <Tag color={colors[type]}>{texts[type] || type}</Tag>;
      }
    },
    { 
      title: '网络', 
      dataIndex: 'network',
      render: (network) => <Tag>{network || 'BSC'}</Tag>
    },
    { 
      title: 'USDT余额', 
      dataIndex: 'usdtBalance',
      render: (balance) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>{balance || '0.00'}</span>
    },
    { 
      title: 'BNB余额', 
      dataIndex: 'bnbBalance',
      render: (balance) => <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{balance || '0.00'}</span>
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small">查看交易</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>💼 钱包管理</h2>
      
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space wrap>
          <Search
            placeholder="搜索用户名/钱包地址"
            allowClear
            style={{ width: 300 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => { setPage(1); fetchWallets(); }}
            enterButton={<SearchOutlined />}
          />
          <Select
            style={{ width: 150 }}
            placeholder="网络筛选"
            allowClear
          >
            <Option value="BSC">BSC</Option>
            <Option value="ETH">ETH</Option>
            <Option value="TRX">TRX</Option>
          </Select>
          <Button type="primary" onClick={() => { setPage(1); fetchWallets(); }} style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
            搜索
          </Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={wallets}
          rowKey="id"
          loading={loading}
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
    </div>
  );
}
