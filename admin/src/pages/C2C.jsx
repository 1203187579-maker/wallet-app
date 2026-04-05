import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Descriptions, message, Popconfirm, Tabs, Input, Select, Alert, Tooltip, Switch, Form } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, SearchOutlined, WarningOutlined, CopyOutlined, SettingOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

export default function C2C() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [buyOrders, setBuyOrders] = useState([]);
  const [appealOrders, setAppealOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [appealTotal, setAppealTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('sell');
  
  // 标签配置状态
  const [labelConfig, setLabelConfig] = useState({
    text: 'GPU',
    color: '#22C55E',
    enabled: true,
  });
  const [labelConfigLoading, setLabelConfigLoading] = useState(false);

  // 复制到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // ID显示组件（可复制）
  const IdCell = ({ id, color = '#666' }) => (
    <Tooltip title="点击复制">
      <span 
        style={{ 
          fontSize: 11, 
          color, 
          cursor: 'pointer',
          fontFamily: 'monospace',
          wordBreak: 'break-all'
        }}
        onClick={() => copyToClipboard(id)}
      >
        {id}
      </span>
    </Tooltip>
  );

  useEffect(() => {
    if (activeTab === 'sell') {
      fetchOrders();
    } else if (activeTab === 'buy') {
      fetchBuyOrders();
    } else if (activeTab === 'appeal') {
      fetchAppealOrders();
    } else if (activeTab === 'settings') {
      fetchLabelConfig();
    }
  }, [activeTab, page, pageSize, statusFilter]);
  
  // 获取标签配置
  const fetchLabelConfig = async () => {
    setLabelConfigLoading(true);
    try {
      const res = await api.getC2CLabelConfig();
      if (res.success && res.data) {
        setLabelConfig({
          text: res.data.text || 'GPU',
          color: res.data.color || '#22C55E',
          enabled: res.data.enabled !== false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch label config:', error);
    } finally {
      setLabelConfigLoading(false);
    }
  };
  
  // 保存标签配置
  const handleSaveLabelConfig = async () => {
    setLabelConfigLoading(true);
    try {
      const res = await api.saveC2CLabelConfig(labelConfig);
      if (res.success) {
        message.success('配置保存成功');
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLabelConfigLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getC2COrders({ page, pageSize, status: statusFilter, search: searchText });
      setOrders(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getBuyOrders({ page, pageSize, search: searchText });
      setBuyOrders(res.data?.list || []);
    } catch (error) {
      console.error('Failed to fetch buy orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppealOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getAppealOrders({ page, pageSize });
      setAppealOrders(res.data?.orders || []);
      setAppealTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch appeal orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (record) => {
    setCurrentOrder(record);
    setDetailVisible(true);
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.updateOrderStatus(id, status);
      message.success('状态更新成功');
      fetchOrders();
      fetchBuyOrders();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 完成订单
  const handleCompleteOrder = async (id) => {
    try {
      await api.updateOrderStatus(id, 'completed');
      message.success('订单已完成，代币已转给买家');
      fetchOrders();
      setDetailVisible(false);
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 取消订单
  const handleCancelOrder = async (id) => {
    try {
      await api.updateOrderStatus(id, 'cancelled');
      message.success('订单已取消，代币已退还给卖家');
      fetchOrders();
      setDetailVisible(false);
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 处理申诉订单
  const handleAppeal = async (orderId, action) => {
    try {
      await api.handleAppeal(orderId, action);
      message.success(action === 'release' ? '已放行，代币已转给买家' : '申诉已取消，订单恢复正常');
      fetchAppealOrders();
      setDetailVisible(false);
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const orderColumns = [
    { 
      title: '订单ID', 
      dataIndex: 'id', 
      width: 200,
      render: (id) => <IdCell id={id} color="#666" />
    },
    { 
      title: '卖家钱包地址', 
      dataIndex: 'sellerWalletAddress',
      width: 200,
      render: (address) => <IdCell id={address} color="#F59E0B" />
    },
    { 
      title: '买家钱包地址', 
      dataIndex: 'buyerWalletAddress',
      width: 200,
      render: (address) => <IdCell id={address} color="#3B82F6" />
    },
    { 
      title: '代币', 
      dataIndex: 'token',
      width: 80,
      render: (token) => <Tag color="orange">{token}</Tag>
    },
    { 
      title: '数量', 
      dataIndex: 'amount',
      width: 100,
      render: (amount) => <span style={{ fontWeight: 'bold' }}>{amount}</span>
    },
    { 
      title: '总额', 
      dataIndex: 'totalPrice',
      width: 100,
      render: (price) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{price}</span>
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const colors = { 
          pending: 'orange', 
          pending_payment: 'orange',
          matched: 'blue',
          active: 'blue', 
          paid: 'blue',
          completed: 'green', 
          cancelled: 'red',
          appealing: 'red'
        };
        const texts = { 
          pending: '待匹配', 
          pending_payment: '待付款',
          matched: '已匹配',
          active: '进行中', 
          paid: '进行中',
          completed: '已完成', 
          cancelled: '已取消',
          appealing: '申诉中'
        };
        return <Tag color={colors[status]}>{texts[status] || status}</Tag>;
      }
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt',
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status !== 'completed' && record.status !== 'cancelled' && (
            <>
              <Popconfirm
                title="确认完成订单？"
                description="将订单标记为已完成，代币将转给买家"
                onConfirm={() => handleCompleteOrder(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />}>
                  完成
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认取消订单？"
                description="取消订单后，冻结的代币将退还给卖家"
                onConfirm={() => handleCancelOrder(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  取消
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const buyOrderColumns = [
    { 
      title: '求购单ID', 
      dataIndex: 'id', 
      width: 200,
      render: (id) => <IdCell id={id} color="#666" />
    },
    { 
      title: '买家钱包地址', 
      dataIndex: 'walletAddress',
      width: 200,
      render: (address) => <IdCell id={address} color="#3B82F6" />
    },
    { title: '数量', dataIndex: 'amount', width: 100, render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span> },
    { title: '单价', dataIndex: 'price', width: 100, render: (v) => `${v} CNY` },
    { title: '总价', dataIndex: 'totalPrice', width: 100, render: (v) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>¥{v}</span> },
    { title: '订单类型', dataIndex: 'orderType', width: 80, render: (t) => <Tag color={t === 'big' ? 'red' : 'green'}>{t === 'big' ? '大单' : '小单'}</Tag> },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const colors = { 
          pending: 'orange', 
          matched: 'blue',
          pending_payment: 'blue',
          paid: 'cyan', 
          completed: 'green', 
          cancelled: 'red' 
        };
        const texts = { 
          pending: '待匹配', 
          matched: '进行中',
          pending_payment: '待付款',
          paid: '已付款', 
          completed: '已完成', 
          cancelled: '已取消' 
        };
        return <Tag color={colors[status]}>{texts[status] || status}</Tag>;
      }
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认取消此求购单？"
              onConfirm={() => handleCancelBuyOrder(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<CloseOutlined />}>
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 取消求购单
  const handleCancelBuyOrder = async (id) => {
    try {
      const res = await api.cancelBuyOrder(id);
      if (res.success) {
        message.success('求购单已取消');
        fetchBuyOrders();
      } else {
        message.error(res.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 申诉订单列
  const appealColumns = [
    { 
      title: '订单ID', 
      dataIndex: 'id', 
      width: 120 
    },
    { 
      title: '买家', 
      dataIndex: 'buyer',
      render: (buyer) => <span>{buyer?.nickname || buyer?.phone || buyer?.id?.slice(0, 8)}</span>
    },
    { 
      title: '卖家', 
      dataIndex: 'seller',
      render: (seller) => <span>{seller?.nickname || seller?.phone || seller?.id?.slice(0, 8)}</span>
    },
    { 
      title: '代币', 
      dataIndex: 'token_symbol',
      render: (token) => <Tag color="orange">{token}</Tag>
    },
    { 
      title: '数量', 
      dataIndex: 'amount',
      render: (amount) => <span style={{ fontWeight: 'bold' }}>{amount}</span>
    },
    { 
      title: '总额', 
      dataIndex: 'total_price',
      render: (price) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>¥{price}</span>
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      render: () => <Tag color="red" icon={<WarningOutlined />}>申诉中</Tag>
    },
    { 
      title: '更新时间', 
      dataIndex: 'updated_at',
      width: 180,
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Popconfirm
            title="放行后将把代币转给买家，确定放行?"
            onConfirm={() => handleAppeal(record.id, 'release')}
            okText="确定放行"
            cancelText="取消"
          >
            <Button type="link" size="small" style={{ color: '#52c41a' }}>放行</Button>
          </Popconfirm>
          <Popconfirm
            title="取消申诉后订单将恢复正常状态，确定取消?"
            onConfirm={() => handleAppeal(record.id, 'cancel')}
            okText="确定取消"
            cancelText="返回"
          >
            <Button type="link" size="small" danger>取消申诉</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>💱 C2C交易管理</h2>
      
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space wrap>
          <Search
            placeholder="搜索钱包地址"
            allowClear
            style={{ width: 280 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => { 
              setPage(1); 
              if (activeTab === 'buy') {
                fetchBuyOrders();
              } else {
                fetchOrders();
              }
            }}
          />
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setPage(1); }}
          >
            <Option value="">全部订单</Option>
            <Option value="active">进行中</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
            <Option value="appealing">申诉中</Option>
          </Select>
          <Button type="primary" onClick={() => { 
            setPage(1); 
            if (activeTab === 'buy') {
              fetchBuyOrders();
            } else {
              fetchOrders();
            }
          }} style={{ background: '#F59E0B', borderColor: '#F59E0B' }}>
            搜索
          </Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="全部订单" key="sell">
            <Table
              columns={orderColumns}
              dataSource={orders}
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
          </TabPane>
          <TabPane tab="购买订单" key="buy">
            <Table
              columns={buyOrderColumns}
              dataSource={buyOrders}
              rowKey="id"
              loading={loading}
              pagination={{
                current: page,
                pageSize: pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                onChange: (page, pageSize) => {
                  setPage(page);
                  setPageSize(pageSize);
                },
              }}
            />
          </TabPane>
          <TabPane tab="⚙️ 标签设置" key="settings">
            <Card title="买家列表动态标签配置" style={{ maxWidth: 500 }}>
              <Form layout="vertical">
                <Form.Item label="启用标签">
                  <Switch
                    checked={labelConfig.enabled}
                    onChange={(checked) => setLabelConfig({ ...labelConfig, enabled: checked })}
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                  />
                </Form.Item>
                <Form.Item label="标签文字">
                  <Input
                    value={labelConfig.text}
                    onChange={(e) => setLabelConfig({ ...labelConfig, text: e.target.value })}
                    placeholder="输入标签文字，如：GPU"
                    maxLength={10}
                  />
                </Form.Item>
                <Form.Item label="标签颜色">
                  <Space>
                    <Input
                      type="color"
                      value={labelConfig.color}
                      onChange={(e) => setLabelConfig({ ...labelConfig, color: e.target.value })}
                      style={{ width: 60, height: 40, padding: 4 }}
                    />
                    <Input
                      value={labelConfig.color}
                      onChange={(e) => setLabelConfig({ ...labelConfig, color: e.target.value })}
                      placeholder="#22C55E"
                      style={{ width: 120 }}
                    />
                  </Space>
                </Form.Item>
                <Form.Item label="预览效果">
                  <div style={{ 
                    backgroundColor: '#0D0D0D', 
                    padding: 20, 
                    borderRadius: 8,
                    textAlign: 'center'
                  }}>
                    <span style={{ 
                      fontSize: 24, 
                      fontWeight: 800, 
                      color: labelConfig.color,
                      textShadow: `0 0 10px ${labelConfig.color}`,
                      letterSpacing: 4
                    }}>
                      {labelConfig.text || 'GPU'}
                    </span>
                  </div>
                </Form.Item>
                <Form.Item>
                  <Button 
                    type="primary" 
                    onClick={handleSaveLabelConfig}
                    loading={labelConfigLoading}
                    style={{ background: '#F59E0B', borderColor: '#F59E0B' }}
                  >
                    保存配置
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={<span style={{ fontSize: 18 }}>📋 订单详情</span>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          currentOrder?.status === 'appealing' ? [
            <Button key="cancel" onClick={() => setDetailVisible(false)}>关闭</Button>,
            <Popconfirm
              key="cancelAppeal"
              title="取消申诉后订单将恢复正常状态，确定取消?"
              onConfirm={() => handleAppeal(currentOrder.id, 'cancel')}
              okText="确定取消"
              cancelText="返回"
            >
              <Button danger>取消申诉</Button>
            </Popconfirm>,
            <Popconfirm
              key="release"
              title="放行后将把代币转给买家，确定放行?"
              onConfirm={() => handleAppeal(currentOrder.id, 'release')}
              okText="确定放行"
              cancelText="取消"
            >
              <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}>放行</Button>
            </Popconfirm>,
          ] : [
            <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
          ]
        }
        width={700}
      >
        {currentOrder && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="订单ID">{currentOrder.id}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={currentOrder.seller ? 'blue' : 'green'}>
                {currentOrder.seller ? 'C2C交易' : '购买'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="买家">
              {currentOrder.buyer?.nickname || currentOrder.buyer?.phone || currentOrder.buyerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="卖家">
              {currentOrder.seller?.nickname || currentOrder.seller?.phone || currentOrder.sellerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="代币">{currentOrder.token_symbol || currentOrder.token}</Descriptions.Item>
            <Descriptions.Item label="数量">{currentOrder.amount}</Descriptions.Item>
            <Descriptions.Item label="单价">{currentOrder.price} CNY</Descriptions.Item>
            <Descriptions.Item label="总额">
              <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>{currentOrder.total_price || currentOrder.totalPrice} CNY</span>
            </Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              {currentOrder.status === 'appealing' ? (
                <Tag color="red" icon={<WarningOutlined />}>申诉中</Tag>
              ) : (
                <Tag color="blue">{currentOrder.status}</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {new Date(currentOrder.created_at || currentOrder.createdAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
