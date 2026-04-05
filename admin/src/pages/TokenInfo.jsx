import React, { useState, useEffect } from 'react';
import {
  Table, Card, Button, Modal, Form, Input, InputNumber, message, Space, Tag, Popconfirm, Switch, Row, Col, Statistic
} from 'antd';
import {
  EditOutlined, DeleteOutlined, PlusOutlined, DollarOutlined, EyeOutlined, EyeInvisibleOutlined
} from '@ant-design/icons';
import * as api from '../utils/api';

const { TextArea } = Input;

export default function TokenInfo() {
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState([]);
  const [editVisible, setEditVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [currentToken, setCurrentToken] = useState(null);
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const res = await api.getTokens();
      if (res && res.data) {
        setTokens(res.data);
      }
    } catch (err) {
      console.error('获取代币列表失败:', err);
      message.error('获取代币列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    addForm.resetFields();
    setAddVisible(true);
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      await api.createToken(values);
      message.success(`代币 ${values.symbol.toUpperCase()} 创建成功`);
      setAddVisible(false);
      fetchTokens();
    } catch (err) {
      message.error(err.message || '创建失败');
    }
  };

  const handleEdit = (record) => {
    setCurrentToken(record);
    form.setFieldsValue({
      name: record.name || '',
      description: record.description || '',
      price: record.price ? parseFloat(record.price) : 0,
      isViewable: record.isViewable !== false,
      isTradingEnabled: record.isTradingEnabled !== false,
      minTradeAmount: record.minTradeAmount || 1,
    });
    setEditVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      await api.updateToken(currentToken.symbol, values);
      message.success('更新成功');
      setEditVisible(false);
      fetchTokens();
    } catch (err) {
      message.error(err.message || '更新失败');
    }
  };

  const handleDelete = async (symbol) => {
    try {
      await api.deleteToken(symbol);
      message.success(`代币 ${symbol} 已删除`);
      fetchTokens();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  // 快速切换可见性
  const toggleViewable = async (symbol, currentValue) => {
    try {
      await api.updateToken(symbol, { isViewable: !currentValue });
      message.success(!currentValue ? '已开启行情显示' : '已关闭行情显示');
      fetchTokens();
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 快速切换可交易
  const toggleTrading = async (symbol, currentValue) => {
    try {
      await api.updateToken(symbol, { isTradingEnabled: !currentValue });
      message.success(!currentValue ? '已开启交易' : '已关闭交易');
      fetchTokens();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const getSymbolColor = (symbol) => {
    const colors = {
      'BTC': '#F7931A',
      'ETH': '#627EEA',
      'USDT': '#26A17B',
      'AI': '#8B5CF6',
      'GPU': '#10B981',
      'BNB': '#F0B90B',
      'PLATFORM': '#F59E0B',
    };
    return colors[symbol] || '#666';
  };

  const columns = [
    {
      title: '代币',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      render: (symbol) => (
        <Space>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: getSymbolColor(symbol),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 12
          }}>
            {symbol ? symbol.slice(0, 2) : '??'}
          </div>
          <Tag color="gold" style={{ fontWeight: 'bold' }}>{symbol}</Tag>
        </Space>
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name) => name || '-'
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => (
        <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>
          ${price ? parseFloat(price).toFixed(4) : '0'}
        </span>
      )
    },
    {
      title: '行情显示',
      dataIndex: 'isViewable',
      key: 'isViewable',
      width: 100,
      render: (v, record) => (
        <Switch
          checked={v !== false}
          onChange={() => toggleViewable(record.symbol, v !== false)}
          size="small"
          checkedChildren={<EyeOutlined />}
          unCheckedChildren={<EyeInvisibleOutlined />}
        />
      )
    },
    {
      title: '可交易',
      dataIndex: 'isTradingEnabled',
      key: 'isTradingEnabled',
      width: 100,
      render: (v, record) => (
        <Switch
          checked={v !== false}
          onChange={() => toggleTrading(record.symbol, v !== false)}
          size="small"
        />
      )
    },
    {
      title: '最小交易量',
      dataIndex: 'minTradeAmount',
      key: 'minTradeAmount',
      width: 100,
      render: (v) => v || '-'
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v) => (
        <Tag color={v !== false ? 'green' : 'red'}>
          {v !== false ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => {
        const protectedTokens = ['USDT', 'BTC', 'ETH'];
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {!protectedTokens.includes(record.symbol) && (
              <Popconfirm
                title="确定删除此代币？"
                description="将删除所有关联数据（价格、交易对、用户资产、交易记录等）"
                onConfirm={() => handleDelete(record.symbol)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>🪙 代币管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加代币
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="代币总数" value={tokens.length} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="行情显示" 
              value={tokens.filter(t => t.isViewable !== false).length} 
              suffix="个" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="可交易" 
              value={tokens.filter(t => t.isTradingEnabled !== false).length} 
              suffix="个" 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="平台代币" 
              value={tokens.filter(t => t.isPlatformToken).length} 
              suffix="个" 
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={tokens}
          rowKey="symbol"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无代币' }}
        />
      </Card>

      {/* 添加代币弹窗 */}
      <Modal
        title="➕ 添加新代币"
        open={addVisible}
        onCancel={() => setAddVisible(false)}
        onOk={handleAddSubmit}
        okText="创建"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="symbol" 
                label="代币符号" 
                rules={[{ required: true, message: '请输入代币符号' }]}
              >
                <Input placeholder="如: GPU" maxLength={10} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="代币名称">
                <Input placeholder="如: GPU Token" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price" label="初始价格 ($)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} precision={8} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="minTradeAmount" label="最小交易量" initialValue={1}>
                <InputNumber style={{ width: '100%' }} min={0} precision={8} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isViewable" label="行情显示" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isTradingEnabled" label="可交易" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="代币描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑代币弹窗 */}
      <Modal
        title={`✏️ 编辑 ${currentToken?.symbol || ''}`}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="代币名称">
                <Input placeholder="代币名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price" label="价格 ($)">
                <InputNumber style={{ width: '100%' }} min={0} precision={8} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="minTradeAmount" label="最小交易量">
                <InputNumber style={{ width: '100%' }} min={0} precision={8} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="isViewable" label="行情显示" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="isTradingEnabled" label="可交易" valuePropName="checked">
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="代币描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
