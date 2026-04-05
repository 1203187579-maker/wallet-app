import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Descriptions, message, Image, Row, Col, Statistic, Input, Select } from 'antd';
import { EyeOutlined, CreditCardOutlined, AlipayOutlined, WechatOutlined, DollarOutlined, PhoneOutlined, SearchOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { Search } = Input;
const { Option } = Select;

export default function PaymentInfo() {
  const [loading, setLoading] = useState(true);
  const [paymentList, setPaymentList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchUserId, setSearchUserId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [stats, setStats] = useState({ total: 0, alipay: 0, wechat: 0, usdt: 0 });

  useEffect(() => {
    fetchPaymentList();
  }, [page, pageSize, searchUserId, typeFilter]);

  const fetchPaymentList = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (searchUserId) params.userId = searchUserId;
      if (typeFilter) params.paymentType = typeFilter;
      
      const res = await api.getPaymentInfoList(params);
      const list = res.data?.list || [];
      setPaymentList(list);
      setTotal(res.data?.total || 0);
      
      // 计算统计
      setStats({
        total: list.length,
        alipay: list.filter(p => p.payment_type === 'alipay').length,
        wechat: list.filter(p => p.payment_type === 'wechat').length,
        usdt: list.filter(p => p.payment_type === 'usdt_bsc').length,
      });
    } catch (error) {
      console.error('Failed to fetch payment info list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (record) => {
    setCurrentPayment(record);
    setDetailVisible(true);
  };

  const getPaymentTypeTag = (type) => {
    const config = {
      alipay: { color: '#1677FF', icon: <AlipayOutlined />, text: '支付宝' },
      wechat: { color: '#07C160', icon: <WechatOutlined />, text: '微信' },
      usdt_bsc: { color: '#F7931A', icon: <DollarOutlined />, text: 'USDT(BSC)' },
    };
    const cfg = config[type] || { color: '#666', icon: <CreditCardOutlined />, text: type };
    return (
      <Tag color={cfg.color} icon={cfg.icon}>
        {cfg.text}
      </Tag>
    );
  };

  const columns = [
    { 
      title: '钱包地址', 
      dataIndex: 'walletAddress',
      width: 180,
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
      title: '支付方式', 
      dataIndex: 'payment_type',
      render: (type) => getPaymentTypeTag(type)
    },
    { 
      title: '账号信息', 
      dataIndex: 'account_info',
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>
    },
    { 
      title: '账户名称', 
      dataIndex: 'account_name',
      render: (text) => text || <span style={{ color: '#999' }}>-</span>
    },
    { 
      title: '手机号', 
      dataIndex: 'phone',
      render: (text) => text || <span style={{ color: '#999' }}>-</span>
    },
    { 
      title: '收款码', 
      dataIndex: 'qrcode_url',
      width: 80,
      render: (url) => url ? (
        <Image
          width={40}
          height={40}
          src={url}
          style={{ borderRadius: 4, objectFit: 'cover' }}
          placeholder={<div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4 }} />}
        />
      ) : <span style={{ color: '#999' }}>-</span>
    },
    { 
      title: '创建时间', 
      dataIndex: 'created_at',
      width: 180,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>💳 收款信息管理</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="总记录数"
              value={total}
              valueStyle={{ color: '#F59E0B' }}
              prefix={<CreditCardOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="支付宝"
              value={stats.alipay}
              valueStyle={{ color: '#1677FF' }}
              prefix={<AlipayOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="微信"
              value={stats.wechat}
              valueStyle={{ color: '#07C160' }}
              prefix={<WechatOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="USDT"
              value={stats.usdt}
              valueStyle={{ color: '#F7931A' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space>
          <span>筛选:</span>
          <Search
            placeholder="输入钱包地址搜索"
            allowClear
            style={{ width: 250 }}
            onSearch={(value) => setSearchUserId(value)}
            prefix={<SearchOutlined />}
          />
          <Select
            style={{ width: 150 }}
            placeholder="支付方式"
            allowClear
            onChange={(value) => setTypeFilter(value || '')}
          >
            <Option value="alipay">支付宝</Option>
            <Option value="wechat">微信</Option>
            <Option value="usdt_bsc">USDT(BSC)</Option>
          </Select>
          <Button onClick={fetchPaymentList}>刷新</Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={paymentList}
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

      {/* 详情弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>📋 收款信息详情</span>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {currentPayment && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="钱包地址">
                <span 
                  style={{ fontFamily: 'monospace', fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                  onClick={() => {
                    if (currentPayment.walletAddress) {
                      navigator.clipboard.writeText(currentPayment.walletAddress);
                      message.success('已复制');
                    }
                  }}
                >
                  {currentPayment.walletAddress || '-'}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">
                {getPaymentTypeTag(currentPayment.payment_type)}
              </Descriptions.Item>
              <Descriptions.Item label="账号信息">
                <span style={{ fontFamily: 'monospace' }}>{currentPayment.account_info}</span>
              </Descriptions.Item>
              <Descriptions.Item label="账户名称">
                {currentPayment.account_name || <span style={{ color: '#999' }}>未填写</span>}
              </Descriptions.Item>
              <Descriptions.Item label="手机号">
                {currentPayment.phone ? (
                  <Space>
                    <PhoneOutlined />
                    <span>{currentPayment.phone}</span>
                  </Space>
                ) : <span style={{ color: '#999' }}>未填写</span>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {currentPayment.created_at ? new Date(currentPayment.created_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {currentPayment.updated_at ? new Date(currentPayment.updated_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
            </Descriptions>
            
            {currentPayment.qrcode_url && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ marginBottom: 12 }}>📷 收款码</h4>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  background: '#f5f5f5',
                  borderRadius: 12,
                  padding: 20
                }}>
                  <Image
                    width={200}
                    height={200}
                    src={currentPayment.qrcode_url}
                    style={{ borderRadius: 8, objectFit: 'cover' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
