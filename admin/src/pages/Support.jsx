import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Card, Tag, Space, Button, Modal, message, Input, Switch, 
  Avatar, List, Badge, Empty, Spin, Divider, Typography 
} from 'antd';
import { 
  MessageOutlined, RobotOutlined, UserOutlined, 
  SendOutlined, ArrowLeftOutlined, SearchOutlined 
} from '@ant-design/icons';
import * as api from '../utils/api';

const { TextArea } = Input;
const { Text, Title } = Typography;

export default function Support() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  
  // 聊天窗口状态
  const [chatVisible, setChatVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  // AI设置
  const [aiAutoReply, setAiAutoReply] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    fetchConversations();
    fetchSettings();
  }, [page, pageSize]);

  useEffect(() => {
    if (chatVisible && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatVisible]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.getSupportConversations({ page, pageSize, search: searchText });
      if (res.success) {
        setConversations(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.getSupportSettings();
      if (res.success) {
        setAiAutoReply(res.data.aiAutoReply);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchMessages = async (userId) => {
    setMessagesLoading(true);
    try {
      const res = await api.getSupportMessages(userId);
      if (res.success) {
        setMessages(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleOpenChat = (record) => {
    setCurrentUser(record);
    setChatVisible(true);
    fetchMessages(record.userId);
    // 刷新列表以清除未读计数
    fetchConversations();
  };

  const handleCloseChat = () => {
    setChatVisible(false);
    setCurrentUser(null);
    setMessages([]);
    setInputMessage('');
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await api.sendSupportMessage(currentUser.userId, inputMessage.trim());
      if (res.success) {
        setMessages(prev => [...prev, res.data]);
        setInputMessage('');
      } else {
        message.error('发送失败');
      }
    } catch (error) {
      message.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleAiAutoReplyChange = async (checked) => {
    setSettingsLoading(true);
    try {
      const res = await api.updateSupportSettings({ aiAutoReply: checked });
      if (res.success) {
        setAiAutoReply(checked);
        message.success(checked ? 'AI自动回复已开启' : 'AI自动回复已关闭');
      } else {
        message.error('设置失败');
      }
    } catch (error) {
      message.error('设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns = [
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      render: (user) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#F59E0B' }}>
            {user?.nickname?.[0] || user?.phone?.slice(-2) || 'U'}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{user?.nickname || '未设置昵称'}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{user?.phone}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '钱包地址',
      dataIndex: 'walletAddress',
      key: 'walletAddress',
      width: 180,
      render: (address) => (
        address ? (
          <span 
            style={{ fontSize: 12, fontFamily: 'monospace', color: '#1890ff', cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(address);
              message.success('已复制');
            }}
          >
            {address.slice(0, 8)}...{address.slice(-6)}
          </span>
        ) : '-'
      ),
    },
    {
      title: '最后消息',
      dataIndex: 'lastMessage',
      key: 'lastMessage',
      width: 300,
      render: (text, record) => (
        <div style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          maxWidth: 280,
        }}>
          {record.lastMessageType === 'user' ? (
            <Tag color="blue" style={{ marginRight: 4 }}>用户</Tag>
          ) : record.lastMessageType === 'ai' ? (
            <Tag color="purple" style={{ marginRight: 4 }}>AI</Tag>
          ) : (
            <Tag color="green" style={{ marginRight: 4 }}>客服</Tag>
          )}
          {text}
        </div>
      ),
    },
    {
      title: '最后消息时间',
      dataIndex: 'lastMessageTime',
      key: 'lastMessageTime',
      width: 150,
      render: (time) => formatTime(time),
    },
    {
      title: '未读',
      dataIndex: 'unreadCount',
      key: 'unreadCount',
      width: 80,
      render: (count) => (
        count > 0 ? (
          <Badge count={count} style={{ backgroundColor: '#F59E0B' }} />
        ) : (
          <span style={{ color: '#999' }}>0</span>
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="primary" 
          icon={<MessageOutlined />}
          onClick={() => handleOpenChat(record)}
          style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
        >
          回复
        </Button>
      ),
    },
  ];

  const renderMessageItem = (msg) => {
    const isUser = msg.senderType === 'user';
    const isAi = msg.senderType === 'ai';

    return (
      <div 
        key={msg.id} 
        style={{ 
          display: 'flex', 
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16,
        }}
      >
        <div style={{ 
          maxWidth: '70%',
          display: 'flex',
          flexDirection: isUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
        }}>
          <Avatar 
            size={36}
            style={{ 
              backgroundColor: isUser ? '#F59E0B' : isAi ? '#8B5CF6' : '#22C55E',
              margin: isUser ? '0 0 0 8px' : '0 8px 0 0',
            }}
          >
            {isUser ? '我' : isAi ? <RobotOutlined /> : '客'}
          </Avatar>
          <div>
            {!isUser && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isAi ? 'AI助手' : '客服'}
              </Text>
            )}
            <div 
              style={{ 
                padding: '10px 14px',
                borderRadius: 12,
                backgroundColor: isUser ? '#F59E0B' : isAi ? '#F3E8FF' : '#DCFCE7',
                color: isUser ? '#fff' : '#333',
              }}
            >
              {msg.message}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatTime(msg.createdAt)}
            </Text>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>💬 客服管理</h2>
      
      {/* AI设置卡片 */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space size="large">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ fontSize: 20, color: '#8B5CF6' }} />
            <span style={{ fontWeight: 500 }}>AI自动回复</span>
            <Switch 
              checked={aiAutoReply}
              onChange={handleAiAutoReplyChange}
              loading={settingsLoading}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </div>
          <Text type="secondary">
            开启后，用户发送消息将自动由AI助手回复常见问题
          </Text>
        </Space>
      </Card>

      {/* 对话列表 */}
      <Card style={{ borderRadius: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="搜索用户名或手机号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
              onPressEnter={() => { setPage(1); fetchConversations(); }}
            />
            <Button type="primary" onClick={() => { setPage(1); fetchConversations(); }}>
              搜索
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={conversations}
          rowKey="userId"
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

      {/* 聊天弹窗 */}
      <Modal
        title={
          <Space>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#F59E0B' }}>
              {currentUser?.user?.nickname?.[0] || 'U'}
            </Avatar>
            <span>{currentUser?.user?.nickname || currentUser?.user?.phone || '用户'}</span>
          </Space>
        }
        open={chatVisible}
        onCancel={handleCloseChat}
        footer={null}
        width={600}
        centered
      >
        <div style={{ height: 400, overflow: 'auto', padding: '16px 0' }}>
          {messagesLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : messages.length === 0 ? (
            <Empty description="暂无消息记录" />
          ) : (
            messages.map(renderMessageItem)
          )}
          <div ref={messagesEndRef} />
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            placeholder="输入回复内容..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            autoSize={{ minRows: 1, maxRows: 3 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={sending}
            style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
          >
            发送
          </Button>
        </div>
      </Modal>
    </div>
  );
}
