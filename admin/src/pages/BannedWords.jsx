import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tag,
  Select,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  StopOutlined,
} from '@ant-design/icons';

const API_BASE = '/api/v1/admin/banned-words';

export default function BannedWords() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchWords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(API_BASE, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setWords(data.data || []);
      }
    } catch (error) {
      message.error('获取违禁词列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    form.setFieldsValue({ type: 'keyword' });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        message.success('删除成功');
        fetchWords();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      if (data.success) {
        message.success('添加成功');
        setModalVisible(false);
        fetchWords();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      keyword: 'red',
      regex: 'orange',
      sensitive: 'volcano',
    };
    return colors[type] || 'default';
  };

  const getTypeName = (type) => {
    const names = {
      keyword: '关键词',
      regex: '正则表达式',
      sensitive: '敏感词',
    };
    return names[type] || type;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '违禁词',
      dataIndex: 'word',
      key: 'word',
      render: (text) => (
        <Space>
          <StopOutlined style={{ color: '#EF4444' }} />
          <span style={{ fontFamily: 'monospace' }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color={getTypeColor(type)}>{getTypeName(type)}</Tag>
      ),
    },
    {
      title: '替换文本',
      dataIndex: 'replaceText',
      key: 'replaceText',
      render: (text) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个违禁词吗？"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="违禁词管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
          >
            添加违禁词
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={words}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="添加违禁词"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="word"
            label="违禁词"
            rules={[{ required: true, message: '请输入违禁词' }]}
          >
            <Input placeholder="输入需要屏蔽的词或正则表达式" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="keyword">关键词（精确匹配）</Select.Option>
              <Select.Option value="regex">正则表达式</Select.Option>
              <Select.Option value="sensitive">敏感词</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="replaceText"
            label="替换文本"
            extra="用户发送包含违禁词的消息时，将被替换为此文本（可选）"
          >
            <Input placeholder="例如：***" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
              >
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
