import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Modal, Row, Col, Statistic, Tree, InputNumber, message, Alert, Tabs, Popconfirm, Input } from 'antd';
import { TeamOutlined, UserOutlined, GiftOutlined, EyeOutlined, SettingOutlined, SaveOutlined, TrophyOutlined, CrownOutlined } from '@ant-design/icons';
import * as api from '../utils/api';

export default function Referrals() {
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState({});
  const [treeVisible, setTreeVisible] = useState(false);
  const [referralTree, setReferralTree] = useState([]);
  
  // L层级配置
  const [configVisible, setConfigVisible] = useState(false);
  const [referralConfig, setReferralConfig] = useState([]);
  const [maxLevel, setMaxLevel] = useState(10);
  const [configLoading, setConfigLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('level');
  
  // S等级配置
  const [levelConfig, setLevelConfig] = useState([]);
  const [levelLoading, setLevelLoading] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);

  useEffect(() => {
    fetchReferralStats();
  }, [page, pageSize]);

  const fetchReferralStats = async () => {
    setLoading(true);
    try {
      const res = await api.getReferralStats({ page, pageSize });
      setReferrals(res.data?.list || []);
      setTotal(res.data?.total || 0);
      setStats(res.data?.stats || {});
    } catch (error) {
      console.error('Failed to fetch referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await api.getReferralConfig();
      setReferralConfig(res.data?.config || []);
      setMaxLevel(res.data?.maxLevel || 10);
    } catch (error) {
      console.error('Failed to fetch referral config:', error);
      message.error('获取返佣配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchLevelConfig = async () => {
    setLevelLoading(true);
    try {
      const res = await api.getLevelConfig();
      setLevelConfig(res.data?.levels || []);
    } catch (error) {
      console.error('Failed to fetch level config:', error);
      message.error('获取等级配置失败');
    } finally {
      setLevelLoading(false);
    }
  };

  const handleViewTree = (record) => {
    const treeData = buildTreeData(record);
    setReferralTree(treeData);
    setTreeVisible(true);
  };

  const handleOpenConfig = () => {
    fetchReferralConfig();
    fetchLevelConfig();
    setConfigVisible(true);
  };

  // L层级配置操作
  const handleMaxLevelChange = async (value) => {
    if (value < 1 || value > 20) {
      message.warning('层级数必须在 1-20 之间');
      return;
    }
    setMaxLevel(value);
    
    const newConfig = [];
    for (let level = 1; level <= value; level++) {
      const existing = referralConfig.find(c => c.level === level);
      if (existing) {
        newConfig.push(existing);
      } else {
        const defaultRate = Math.max(0.1, 0.1 - (level - 1) * 0.01);
        newConfig.push({
          id: null,
          level: level,
          reward_rate: defaultRate,
          required_direct_count: level,
        });
      }
    }
    setReferralConfig(newConfig);
  };

  const handleConfigChange = (level, field, value) => {
    setReferralConfig(prev => 
      prev.map(item => 
        item.level === level 
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      await api.updateReferralMaxLevel(maxLevel);
      
      for (const config of referralConfig) {
        if (config.id) {
          await api.updateReferralConfig(config.level, {
            reward_rate: config.reward_rate,
            required_direct_count: config.required_direct_count,
          });
        }
      }
      
      message.success('配置保存成功');
      setConfigVisible(false);
    } catch (error) {
      console.error('Failed to save referral config:', error);
      message.error('保存配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // S等级配置操作
  const handleLevelChange = (id, field, value) => {
    setLevelConfig(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const handleSaveLevel = async (record) => {
    try {
      await api.updateLevelConfig(record.id, {
        level_name: record.level_name,
        min_team_stake: record.min_team_stake,
        big_zone_rate: record.big_zone_rate,
        small_zone_rate: record.small_zone_rate,
      });
      message.success('等级配置已保存');
      setEditingLevel(null);
    } catch (error) {
      console.error('Failed to save level config:', error);
      message.error('保存失败');
    }
  };

  const handleAddLevel = async () => {
    try {
      const newLevelName = `S${levelConfig.length + 1}`;
      await api.createLevelConfig({
        level_name: newLevelName,
        min_team_stake: 0,
        big_zone_rate: 0,
        small_zone_rate: 0,
      });
      message.success('等级已添加');
      fetchLevelConfig();
    } catch (error) {
      console.error('Failed to add level:', error);
      message.error('添加失败');
    }
  };

  const handleDeleteLevel = async (id) => {
    try {
      await api.deleteLevelConfig(id);
      message.success('等级已删除');
      fetchLevelConfig();
    } catch (error) {
      console.error('Failed to delete level:', error);
      message.error('删除失败');
    }
  };

  const buildTreeData = (user) => {
    if (!user.referrals || user.referrals.length === 0) {
      return [];
    }
    return user.referrals.map(ref => ({
      title: `${ref.username} (Level ${ref.level})`,
      key: ref.id,
      icon: <UserOutlined />,
      children: buildTreeData(ref),
    }));
  };

  // L层级配置表格列
  const levelConfigColumns = [
    {
      title: '层级',
      dataIndex: 'level',
      width: 80,
      render: (level) => <Tag color="blue">L{level}</Tag>
    },
    {
      title: '返佣比例 (%)',
      dataIndex: 'reward_rate',
      width: 150,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          step={0.1}
          precision={2}
          value={parseFloat(value) * 100}
          onChange={(v) => handleConfigChange(record.level, 'reward_rate', v / 100)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '所需直推人数',
      dataIndex: 'required_direct_count',
      width: 150,
      render: (value, record) => (
        <InputNumber
          min={1}
          max={100}
          value={value}
          onChange={(v) => handleConfigChange(record.level, 'required_direct_count', v)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '说明',
      render: (_, record) => (
        <span style={{ color: '#666' }}>
          直推 {record.required_direct_count} 人解锁，奖励质押金额的 {(parseFloat(record.reward_rate) * 100).toFixed(1)}%
        </span>
      )
    },
  ];

  // S等级配置表格列
  const gradeConfigColumns = [
    {
      title: '等级',
      dataIndex: 'level_name',
      width: 100,
      render: (name) => {
        const colors = {
          'S1': '#87d068',
          'S2': '#108ee9',
          'S3': '#2db7f5',
          'S4': '#722ed1',
          'S5': '#eb2f96',
          'S6': '#f50',
        };
        return <Tag color={colors[name] || 'blue'} style={{ fontSize: 14, fontWeight: 'bold' }}>{name}</Tag>;
      }
    },
    {
      title: '升级门槛（团队质押）',
      dataIndex: 'min_team_stake',
      width: 180,
      render: (value, record) => editingLevel === record.id ? (
        <InputNumber
          min={0}
          value={parseFloat(value)}
          onChange={(v) => handleLevelChange(record.id, 'min_team_stake', v)}
          style={{ width: '100%' }}
          addonAfter="万"
        />
      ) : (
        <span style={{ fontWeight: 'bold', color: '#F59E0B' }}>{parseFloat(value).toLocaleString()} 万</span>
      )
    },
    {
      title: '大区比例 (%)',
      dataIndex: 'big_zone_rate',
      width: 130,
      render: (value, record) => editingLevel === record.id ? (
        <InputNumber
          min={0}
          max={100}
          step={1}
          value={parseFloat(value) * 100}
          onChange={(v) => handleLevelChange(record.id, 'big_zone_rate', v / 100)}
          style={{ width: '100%' }}
        />
      ) : (
        <span style={{ color: '#52c41a' }}>{(parseFloat(value) * 100).toFixed(0)}%</span>
      )
    },
    {
      title: '小区比例 (%)',
      dataIndex: 'small_zone_rate',
      width: 130,
      render: (value, record) => editingLevel === record.id ? (
        <InputNumber
          min={0}
          max={100}
          step={1}
          value={parseFloat(value) * 100}
          onChange={(v) => handleLevelChange(record.id, 'small_zone_rate', v / 100)}
          style={{ width: '100%' }}
        />
      ) : (
        <span style={{ color: '#1890ff' }}>{(parseFloat(value) * 100).toFixed(0)}%</span>
      )
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          {editingLevel === record.id ? (
            <>
              <Button type="link" size="small" onClick={() => handleSaveLevel(record)}>保存</Button>
              <Button type="link" size="small" onClick={() => setEditingLevel(null)}>取消</Button>
            </>
          ) : (
            <>
              <Button type="link" size="small" onClick={() => setEditingLevel(record.id)}>编辑</Button>
              <Popconfirm title="确定删除该等级？" onConfirm={() => handleDeleteLevel(record.id)}>
                <Button type="link" size="small" danger>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    },
  ];

  const columns = [
    { 
      title: '钱包地址', 
      dataIndex: 'walletAddress',
      width: 200,
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
      title: '推荐码', 
      dataIndex: 'referralCode',
      render: (code) => <Tag color="blue">{code}</Tag>
    },
    { 
      title: '直推人数', 
      dataIndex: 'directCount',
      render: (count) => <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>{count || 0}</span>
    },
    { 
      title: '解锁层级', 
      dataIndex: 'unlockedLevel',
      render: (level) => {
        if (!level || level === 0) return <Tag color="default">未解锁</Tag>;
        const colors = ['gold', 'orange', 'green', 'cyan', 'blue', 'purple', 'magenta', 'red', 'volcano', 'geekblue'];
        return <Tag color={colors[Math.min(level - 1, 9)]}>L1-L{level}</Tag>;
      }
    },
    { 
      title: '团队人数', 
      dataIndex: 'teamCount',
      render: (count) => <span style={{ color: '#52c41a' }}>{count || 0}</span>
    },
    { 
      title: '累计奖励 (GPU)', 
      dataIndex: 'totalReward',
      render: (reward) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{reward || '0.00000000'}</span>
    },
    { 
      title: '注册时间', 
      dataIndex: 'createdAt',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          size="small" 
          icon={<EyeOutlined />}
          onClick={() => handleViewTree(record)}
        >
          查看推广树
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>👥 推广体系管理</h2>
        <Button 
          type="primary" 
          icon={<SettingOutlined />}
          onClick={handleOpenConfig}
        >
          返佣配置
        </Button>
      </div>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="推广用户总数"
              value={stats.totalPromoters || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="总推广人数"
              value={stats.totalReferrals || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="发放奖励总额"
              value={stats.totalRewards || 0}
              suffix="GPU"
              valueStyle={{ color: '#F59E0B' }}
              prefix={<GiftOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 12 }}>
            <Statistic
              title="平均推广人数"
              value={stats.avgReferrals || 0}
              suffix="人/推广者"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>📊 推广排行</span>}
        style={{ marginBottom: 16, borderRadius: 12 }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🥇</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                {stats.topPromoters?.[0]?.username || '-'}
              </div>
              <Tag color="gold">{stats.topPromoters?.[0]?.directCount || 0} 人</Tag>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🥈</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                {stats.topPromoters?.[1]?.username || '-'}
              </div>
              <Tag color="silver">{stats.topPromoters?.[1]?.directCount || 0} 人</Tag>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🥉</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                {stats.topPromoters?.[2]?.username || '-'}
              </div>
              <Tag color="orange">{stats.topPromoters?.[2]?.directCount || 0} 人</Tag>
            </div>
          </Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={referrals}
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

      {/* 推广树弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>🌳 推广树</span>}
        open={treeVisible}
        onCancel={() => setTreeVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTreeVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {referralTree.length > 0 ? (
          <Tree
            showIcon
            defaultExpandAll
            treeData={referralTree}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无下线用户
          </div>
        )}
      </Modal>

      {/* 返佣配置弹窗 */}
      <Modal
        title={<span style={{ fontSize: 18 }}>⚙️ 返佣配置</span>}
        open={configVisible}
        onCancel={() => setConfigVisible(false)}
        footer={null}
        width={900}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'level',
              label: <span><CrownOutlined /> 等级配置 (S1-S6)</span>,
              children: (
                <div>
                  <Alert
                    message="等级配置说明（极差模式）"
                    description={
                      <div>
                        <p style={{ marginBottom: 8 }}><strong>升级门槛</strong>：团队质押总额达到指定金额自动升级</p>
                        <p style={{ marginBottom: 8 }}><strong>大区</strong>：团队中业绩最大的一条线</p>
                        <p style={{ marginBottom: 8 }}><strong>小区</strong>：团队中除大区外的所有线总和</p>
                        <p style={{ marginBottom: 8 }}><strong>对碰奖励</strong>：min(大区, 小区) × 比例</p>
                        <p style={{ marginBottom: 0 }}><strong>极差制</strong>：上级只能拿与下级的比例差，下级等级≥上级则上级拿不到</p>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  
                  <div style={{ marginBottom: 16 }}>
                    <Button type="dashed" onClick={handleAddLevel} icon={<CrownOutlined />}>
                      添加等级
                    </Button>
                  </div>
                  
                  <Table
                    columns={gradeConfigColumns}
                    dataSource={levelConfig}
                    rowKey="id"
                    pagination={false}
                    loading={levelLoading}
                    size="middle"
                  />
                </div>
              )
            },
            {
              key: 'layer',
              label: <span><TeamOutlined /> 层级配置 (L1-L10)</span>,
              children: (
                <div>
                  <Alert
                    message="层级配置说明"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        <li><strong>层级数</strong>：设置最大返佣层级（1-20层）</li>
                        <li><strong>返佣比例</strong>：用户质押时，上级获得的GPU奖励比例</li>
                        <li><strong>所需直推人数</strong>：解锁该层级所需的直推人数</li>
                        <li><strong>示例</strong>：直推3人，解锁L1-L3，可获得1-3层的返佣奖励</li>
                      </ul>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  
                  <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 'bold' }}>最大层级数：</span>
                    <InputNumber
                      min={1}
                      max={20}
                      value={maxLevel}
                      onChange={handleMaxLevelChange}
                      style={{ width: 100 }}
                    />
                    <span style={{ color: '#999' }}>(1-20层)</span>
                  </div>

                  <Table
                    columns={levelConfigColumns}
                    dataSource={referralConfig}
                    rowKey="level"
                    pagination={false}
                    size="small"
                    scroll={{ y: 350 }}
                  />
                  
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Button type="primary" icon={<SaveOutlined />} loading={configLoading} onClick={handleSaveConfig}>
                      保存层级配置
                    </Button>
                  </div>
                </div>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
}
