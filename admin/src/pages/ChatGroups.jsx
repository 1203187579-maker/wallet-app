import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  message,
  Popconfirm,
  Tag,
  Input,
  DatePicker,
  Descriptions,
  Statistic,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  EyeOutlined,
  HistoryOutlined,
  ExpandOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const API_BASE = '/api/v1/admin/chat-groups';

export default function ChatGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [expandLogVisible, setExpandLogVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandLogs, setExpandLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPagination, setLogsPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalMembers: 0,
    totalExpandCount: 0,
    totalAiSpent: '0.00',
    todayGroups: 0,
  });

  const fetchGroups = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(searchText && { search: searchText }),
      });
      
      const response = await fetch(`${API_BASE}?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setGroups(data.data?.groups || []);
        setPagination(prev => ({
          ...prev,
          current: page,
          pageSize,
          total: data.data?.total || 0,
        }));
      }
    } catch (error) {
      message.error('获取群组列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  const fetchExpandLogs = async (groupId, page = 1, pageSize = 10) => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      const response = await fetch(`${API_BASE}/${groupId}/expand-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setExpandLogs(data.data?.logs || []);
        setLogsPagination(prev => ({
          ...prev,
          current: page,
          pageSize,
          total: data.data?.total || 0,
        }));
      }
    } catch (error) {
      message.error('获取扩容日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchStats();
  }, []);

  const handleSearch = () => {
    fetchGroups(1, pagination.pageSize);
  };

  const handleDismiss = async (groupId, groupName) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        message.success(`群组 ${groupName} 已解散`);
        fetchGroups(pagination.current, pagination.pageSize);
        fetchStats();
      } else {
        message.error(data.message || '解散失败');
      }
    } catch (error) {
      message.error('解散失败');
    }
  };

  const handleViewExpandLogs = (group) => {
    setSelectedGroup(group);
    setExpandLogVisible(true);
    fetchExpandLogs(group.id, 1, 10);
  };

  const handleTableChange = (pag) => {
    fetchGroups(pag.current, pag.pageSize);
  };

  const handleLogsTableChange = (pag) => {
    fetchExpandLogs(selectedGroup.id, pag.current, pag.pageSize);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      ellipsis: true,
    },
    {
      title: '群组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.avatarUrl ? (
            <img 
              src={record.avatarUrl} 
              alt="" 
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              background: '#F59E0B20', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <TeamOutlined style={{ color: '#F59E0B' }} />
            </div>
          )}
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '群主',
      dataIndex: 'owner',
      key: 'owner',
      render: (owner) => (
        <Space>
          <UserOutlined />
          {owner?.nickname || owner?.phone || '未知'}
        </Space>
      ),
    },
    {
      title: '成员数',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 100,
      render: (count) => <Tag color="blue">{count || 0} 人</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 100,
      render: (isPublic) => (
        <Tag color={isPublic ? 'green' : 'orange'}>
          {isPublic ? '公开' : '私密'}
        </Tag>
      ),
    },
    {
      title: '简介',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<HistoryOutlined />}
            onClick={() => handleViewExpandLogs(record)}
          >
            扩容记录
          </Button>
          <Popconfirm
            title="确定要解散该群组吗？"
            description="解散后所有成员将被移出，消息将被删除"
            onConfirm={() => handleDismiss(record.id, record.name)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              解散
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logsColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      ellipsis: true,
    },
    {
      title: '操作用户',
      dataIndex: 'user',
      key: 'user',
      render: (user) => user?.nickname || user?.phone || '未知',
    },
    {
      title: '扩容人数',
      dataIndex: 'expandCount',
      key: 'expandCount',
      width: 120,
      render: (val) => <span style={{ color: '#F59E0B', fontWeight: 500 }}>+{val} 人</span>,
    },
    {
      title: '消耗AI',
      dataIndex: 'aiCost',
      key: 'aiCost',
      width: 120,
      render: (val) => (
        <Space>
          <DollarOutlined style={{ color: '#F59E0B' }} />
          <span style={{ fontWeight: 500 }}>{parseFloat(val || 0).toFixed(2)}</span>
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic 
              title="总群数" 
              value={stats.totalGroups} 
              prefix={<TeamOutlined style={{ color: '#F59E0B' }} />}
              valueStyle={{ color: '#F59E0B' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="总成员数" 
              value={stats.totalMembers} 
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="扩容总次数" 
              value={stats.totalExpandCount} 
              prefix={<ExpandOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="扩容总花费" 
              value={stats.totalAiSpent} 
              suffix="AI"
              prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="今日新建" 
              value={stats.todayGroups} 
              prefix={<TeamOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="平均群成员" 
              value={stats.totalGroups > 0 ? Math.round(stats.totalMembers / stats.totalGroups) : 0}
              suffix="人/群"
            />
          </Card>
        </Col>
      </Row>

      {/* 群组列表 */}
      <Card
        title="群组管理"
        extra={
          <Space>
            <Input
              placeholder="搜索群组名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>

      {/* 扩容日志弹窗 */}
      <Modal
        title={
          <Space>
            <HistoryOutlined style={{ color: '#F59E0B' }} />
            扩容记录 - {selectedGroup?.name}
          </Space>
        }
        open={expandLogVisible}
        onCancel={() => setExpandLogVisible(false)}
        footer={null}
        width={900}
      >
        {selectedGroup && (
          <>
            <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="群ID">{selectedGroup.id}</Descriptions.Item>
              <Descriptions.Item label="当前成员">{selectedGroup.memberCount || 0} 人</Descriptions.Item>
              <Descriptions.Item label="群主">{selectedGroup.owner?.nickname || '未知'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedGroup.isPublic ? 'green' : 'orange'}>
                  {selectedGroup.isPublic ? '公开' : '私密'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <Table
              columns={logsColumns}
              dataSource={expandLogs}
              rowKey="id"
              loading={logsLoading}
              pagination={logsPagination}
              onChange={handleLogsTableChange}
              size="small"
              locale={{ emptyText: '暂无扩容记录' }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
