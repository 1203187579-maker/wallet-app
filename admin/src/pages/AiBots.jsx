import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons';

const API_BASE = '/api/v1/admin/ai-bots';

export default function AiBots() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [form] = Form.useForm();

  const fetchBots = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(API_BASE, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setBots(data.data || []);
      }
    } catch (error) {
      message.error('获取AI机器人列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleAdd = () => {
    setEditingBot(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, systemPrompt: '' });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingBot(record);
    // 将数组转为逗号分隔的字符串
    const formValues = {
      ...record,
      triggerKeywords: record.triggerKeywords?.join(', ') || '',
    };
    form.setFieldsValue(formValues);
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
        fetchBots();
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
      const url = editingBot ? `${API_BASE}/${editingBot.id}` : API_BASE;
      const method = editingBot ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      if (data.success) {
        message.success(editingBot ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchBots();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });
      const data = await response.json();
      if (data.success) {
        message.success('状态更新成功');
        fetchBots();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '机器人名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <RobotOutlined style={{ color: '#F59E0B' }} />
          {text}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '调用关键词',
      dataIndex: 'triggerKeywords',
      key: 'triggerKeywords',
      render: (keywords) => (
        <Space size={[0, 4]} wrap>
          {(keywords || []).map((k, i) => (
            <Tag key={i} color="orange">{k}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active, record) => (
        <Switch
          checked={active}
          onChange={(checked) => handleToggleActive(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
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
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个AI机器人吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="AI机器人管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
          >
            新增机器人
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={bots}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingBot ? '编辑AI机器人' : '新增AI机器人'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="机器人名称"
            rules={[{ required: true, message: '请输入机器人名称' }]}
          >
            <Input placeholder="例如：智能助手" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="机器人功能描述" rows={2} />
          </Form.Item>

          <Form.Item
            name="triggerKeywords"
            label="触发关键词"
            rules={[{ required: true, message: '请输入触发关键词' }]}
            extra="多个关键词用逗号分隔，用户发送包含这些关键词的消息时会触发机器人"
          >
            <Input placeholder="例如：@AI,机器人,小助手" />
          </Form.Item>

          <Form.Item
            name="systemPrompt"
            label="系统提示词"
            rules={[{ required: true, message: '请输入系统提示词' }]}
          >
            <Input.TextArea
              placeholder="机器人的行为指令，例如：你是一个友好的AI助手..."
              rows={4}
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
              >
                {editingBot ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
