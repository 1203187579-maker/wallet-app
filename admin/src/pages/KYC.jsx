import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Descriptions, message, Popconfirm, Image, Row, Col, Statistic, Alert, Switch, Tooltip } from 'antd';
import { EyeOutlined, CheckOutlined, CloseOutlined, SafetyCertificateOutlined, UserOutlined, RobotOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

export default function KYC() {
  const [loading, setLoading] = useState(true);
  const [kycList, setKycList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentKYC, setCurrentKYC] = useState(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    fetchKYCList();
    fetchAutoApproveConfig();
  }, [page, pageSize, statusFilter]);

  const fetchAutoApproveConfig = async () => {
    try {
      const res = await api.getSystemConfig();
      setAutoApprove(res.data?.kyc_auto_approve === 'true');
    } catch (error) {
      console.error('Failed to fetch auto approve config:', error);
    }
  };

  const handleToggleAutoApprove = async (checked) => {
    try {
      await api.updateSystemConfig('kyc_auto_approve', checked ? 'true' : 'false');
      setAutoApprove(checked);
      message.success(checked ? '已开启自动审核' : '已关闭自动审核');
    } catch (error) {
      message.error('操作失败');
    }
  };

  const fetchKYCList = async () => {
    setLoading(true);
    try {
      const res = await api.getKYCList({ page, pageSize, status: statusFilter });
      setKycList(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      console.error('Failed to fetch KYC list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (record) => {
    setCurrentKYC(record);
    setDetailVisible(true);
  };

  const handleApprove = async (id) => {
    try {
      await api.approveKYC(id);
      message.success('KYC已通过');
      fetchKYCList();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.error('请输入拒绝原因');
      return;
    }
    try {
      await api.rejectKYC(currentKYC.id, rejectReason);
      message.success('KYC已拒绝');
      setRejectVisible(false);
      setRejectReason('');
      fetchKYCList();
    } catch (error) {
      message.error('操作失败');
    }
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
      title: '用户昵称', 
      dataIndex: 'username',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>
    },
    { 
      title: '人脸照片', 
      dataIndex: 'faceImage',
      width: 80,
      render: (faceImage) => faceImage ? (
        <Image
          width={50}
          height={50}
          src={faceImage}
          style={{ borderRadius: 8, objectFit: 'cover' }}
          placeholder={<div style={{ width: 50, height: 50, background: '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserOutlined /></div>}
        />
      ) : <span style={{ color: '#999' }}>无</span>
    },
    { 
      title: '活体检测', 
      dataIndex: 'livenessActions',
      render: (actions) => actions?.length ? (
        <Space size={4}>
          {actions.map((action, idx) => (
            <Tag key={idx} color="blue">{action}</Tag>
          ))}
        </Space>
      ) : '-'
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      render: (status) => {
        const colors = { pending: 'orange', approved: 'green', rejected: 'red' };
        const texts = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
        return <Tag color={colors[status]}>{texts[status]}</Tag>;
      }
    },
    { 
      title: '提交时间', 
      dataIndex: 'createdAt',
      width: 180,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            审核
          </Button>
          {record.status === 'pending' && (
            <>
              <Popconfirm
                title="确定通过该KYC申请?"
                description="通过后用户将获得认证资格"
                onConfirm={() => handleApprove(record.id)}
              >
                <Button type="link" size="small" style={{ color: '#52c41a' }}>通过</Button>
              </Popconfirm>
              <Button 
                type="link" 
                size="small" 
                danger
                onClick={() => {
                  setCurrentKYC(record);
                  setRejectVisible(true);
                }}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>🛡️ KYC认证管理</h2>
      
      {/* 自动审核开关 */}
      <Card style={{ marginBottom: 16, borderRadius: 12, background: autoApprove ? '#fff7e6' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RobotOutlined style={{ fontSize: 24, color: '#F59E0B' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                自动审核模式
                <Tooltip title="开启后，用户提交KYC将自动通过审核。不推荐开启，建议人工审核以确保安全性。">
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
                </Tooltip>
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>
                {autoApprove ? '已开启 - 用户提交后自动通过' : '已关闭 - 需要人工审核'}
              </div>
            </div>
          </div>
          <Switch
            checked={autoApprove}
            onChange={handleToggleAutoApprove}
            checkedChildren="开启"
            unCheckedChildren="关闭"
          />
        </div>
      </Card>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="待审核"
              value={kycList.filter(k => k.status === 'pending').length}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="已通过"
              value={kycList.filter(k => k.status === 'approved').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="已拒绝"
              value={kycList.filter(k => k.status === 'rejected').length}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space>
          <span>状态筛选:</span>
          <Button type={statusFilter === '' ? 'primary' : 'default'} onClick={() => setStatusFilter('')}>
            全部
          </Button>
          <Button type={statusFilter === 'pending' ? 'primary' : 'default'} onClick={() => setStatusFilter('pending')}>
            待审核
          </Button>
          <Button type={statusFilter === 'approved' ? 'primary' : 'default'} onClick={() => setStatusFilter('approved')}>
            已通过
          </Button>
          <Button type={statusFilter === 'rejected' ? 'primary' : 'default'} onClick={() => setStatusFilter('rejected')}>
            已拒绝
          </Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={kycList}
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

      {/* 审核详情弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>📋 KYC审核</span>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          currentKYC?.status === 'pending' && (
            <>
              <Button key="reject" danger onClick={() => {
                setDetailVisible(false);
                setRejectVisible(true);
              }}>
                拒绝
              </Button>
              <Button 
                key="approve" 
                type="primary" 
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => {
                  handleApprove(currentKYC.id);
                  setDetailVisible(false);
                }}
              >
                通过审核
              </Button>
            </>
          ),
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {currentKYC && (
          <div>
            {currentKYC.status === 'pending' && (
              <Alert
                message="请仔细核对用户人脸照片，确保真实有效"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="用户名">{currentKYC.username}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentKYC.status === 'approved' ? 'green' : currentKYC.status === 'rejected' ? 'red' : 'orange'}>
                  {currentKYC.status === 'approved' ? '已通过' : currentKYC.status === 'rejected' ? '已拒绝' : '待审核'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="活体检测" span={2}>
                {currentKYC.livenessActions?.length ? (
                  <Space size={4}>
                    {currentKYC.livenessActions.map((action, idx) => (
                      <Tag key={idx} color="blue">{action}</Tag>
                    ))}
                  </Space>
                ) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间" span={2}>
                {currentKYC.createdAt ? new Date(currentKYC.createdAt).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              {currentKYC.rejectReason && (
                <Descriptions.Item label="拒绝原因" span={2}>
                  <span style={{ color: '#ff4d4f' }}>{currentKYC.rejectReason}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
            
            <h4 style={{ marginBottom: 12, marginTop: 16 }}>📷 人脸照片</h4>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              background: '#f5f5f5',
              borderRadius: 12,
              padding: 20
            }}>
              {currentKYC.faceImage ? (
                <Image
                  width={280}
                  height={350}
                  src={currentKYC.faceImage}
                  style={{ borderRadius: 16, objectFit: 'cover' }}
                  placeholder={
                    <div style={{ 
                      width: 280, 
                      height: 350, 
                      background: '#e0e0e0', 
                      borderRadius: 16, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      <UserOutlined style={{ fontSize: 48, color: '#999' }} />
                      <span style={{ color: '#999' }}>加载中...</span>
                    </div>
                  }
                />
              ) : (
                <div style={{ 
                  width: 280, 
                  height: 350, 
                  background: '#e0e0e0', 
                  borderRadius: 16, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <UserOutlined style={{ fontSize: 48, color: '#999' }} />
                  <span style={{ color: '#999' }}>暂无人脸照片</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 拒绝原因弹窗 */}
      <Modal
        title="拒绝KYC申请"
        open={rejectVisible}
        onCancel={() => {
          setRejectVisible(false);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
      >
        <p style={{ marginBottom: 12 }}>请输入拒绝原因（将显示给用户）:</p>
        <textarea
          style={{
            width: '100%',
            minHeight: 100,
            padding: 12,
            borderRadius: 8,
            border: '1px solid #d9d9d9',
            fontSize: 14,
            resize: 'vertical'
          }}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="例如：人脸照片不清晰，请重新拍摄..."
        />
      </Modal>
    </div>
  );
}
