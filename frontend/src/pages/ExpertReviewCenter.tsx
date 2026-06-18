import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Divider,
  List,
  Progress,
  App as AntdApp,
  Typography
} from 'antd';
import {
  TeamOutlined,
  SolutionOutlined,
  FileTextOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  UserOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getExpertReviewStats } from '../api/expertReview';
import type { ExpertReviewStats, Recommendation } from '../types/expertReview';
import { RecommendationMap, RecommendationColorMap } from '../types/expertReview';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ExpertReviewCenter: React.FC = () => {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ExpertReviewStats | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await getExpertReviewStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (e: any) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const recommendationKeys: Recommendation[] = [
    'strongly_recommend',
    'recommend',
    'conditionally_recommend',
    'not_recommend',
    'pending'
  ];

  const progressPercent = stats?.task_total
    ? Math.round(((stats.task_submitted + stats.task_in_progress) / stats.task_total) * 100)
    : 0;

  const activityColumns = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => <Tag color="blue">{v}</Tag>
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail'
    },
    {
      title: '操作人',
      dataIndex: 'user',
      key: 'user',
      render: (v: string) => (
        <Space>
          <UserOutlined />
          {v || '系统'}
        </Space>
      )
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>专家评审中心</Title>
              <Text type="secondary">
                支持申报分组派单、匿名评分、评审意见汇总、结果回写审批流及全链路操作审计
              </Text>
            </div>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/expert-review/experts')}>
              <Statistic
                title="专家总数"
                value={stats?.expert_total || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
                suffix={<span style={{ fontSize: 14, color: '#52c41a' }}>
                  活跃 {stats?.expert_active || 0}
                </span>}
              />
              <Divider style={{ margin: '12px 0' }} />
              <Space>
                <Text type="secondary">专家管理</Text>
                <ArrowRightOutlined />
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/expert-review/groups')}>
              <Statistic
                title="评审分组"
                value={stats?.group_total || 0}
                prefix={<SolutionOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
              <Divider style={{ margin: '12px 0' }} />
              <Space>
                <Text type="secondary">分组派单</Text>
                <ArrowRightOutlined />
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/expert-review/scoring')}>
              <Statistic
                title="评审任务"
                value={stats?.task_total || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
              <Divider style={{ margin: '12px 0' }} />
              <Space split={<Divider type="vertical" style={{ margin: 0 }} />}>
                <Space>
                  <ClockCircleOutlined style={{ color: '#1890ff' }} />
                  <span>待评审 {stats?.task_pending || 0}</span>
                </Space>
                <Space>
                  <AuditOutlined style={{ color: '#faad14' }} />
                  <span>进行中 {stats?.task_in_progress || 0}</span>
                </Space>
              </Space>
              <Divider style={{ margin: '8px 0' }} />
              <Space>
                <Text type="secondary">专家评分</Text>
                <ArrowRightOutlined />
              </Space>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/expert-review/summaries')}>
              <Statistic
                title="评审汇总"
                value={stats?.summary_total || 0}
                prefix={<AuditOutlined />}
                valueStyle={{ color: '#52c41a' }}
                suffix={<span style={{ fontSize: 14, color: '#1890ff' }}>
                  已回写 {stats?.summary_written || 0}
                </span>}
              />
              <Divider style={{ margin: '12px 0' }} />
              <Space>
                <Text type="secondary">意见汇总 & 回写审批</Text>
                <ArrowRightOutlined />
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card
              title="评审进度总览"
              extra={
                <Text type="secondary">
                  总任务数: {stats?.task_total || 0}
                </Text>
              }
            >
              <div style={{ marginBottom: 24 }}>
                <Space style={{ marginBottom: 8 }}>
                  <span>完成进度</span>
                  <span style={{ fontWeight: 'bold' }}>{progressPercent}%</span>
                </Space>
                <Progress percent={progressPercent} status="active" />
              </div>

              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card size="small" type="inner">
                    <Statistic
                      title="待分配/已分配"
                      value={stats?.task_pending || 0}
                      valueStyle={{ fontSize: 20, color: '#8c8c8c' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" type="inner">
                    <Statistic
                      title="评审中"
                      value={stats?.task_in_progress || 0}
                      valueStyle={{ fontSize: 20, color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" type="inner">
                    <Statistic
                      title="已提交"
                      value={stats?.task_submitted || 0}
                      valueStyle={{ fontSize: 20, color: '#52c41a' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Title level={5} style={{ marginTop: 0 }}>推荐结论分布</Title>
              <List
                dataSource={recommendationKeys}
                renderItem={(key) => {
                  const count = stats?.recommendation_distribution?.[key] || 0;
                  const total = stats?.summary_total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <List.Item key={key}>
                      <Space style={{ width: '100%' }} align="center">
                        <Tag color={RecommendationColorMap[key]} style={{ minWidth: 100, textAlign: 'center' }}>
                          {RecommendationMap[key]}
                        </Tag>
                        <Progress percent={pct} showInfo={false} style={{ flex: 1, marginRight: 16 }} />
                        <Text strong>{count}</Text>
                        <Text type="secondary">({pct}%)</Text>
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card title="专家领域分布">
                {stats?.field_distribution?.length ? (
                  <List
                    dataSource={stats.field_distribution}
                    renderItem={(item) => {
                      const total = stats?.expert_active || 1;
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <List.Item key={item.field}>
                          <Space style={{ width: '100%' }} align="center">
                            <Tag color="purple" style={{ minWidth: 100 }}>
                              {item.field}
                            </Tag>
                            <Progress percent={pct} showInfo={false} style={{ flex: 1 }} />
                            <Text strong>{item.count}人</Text>
                          </Space>
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <Text type="secondary">暂无数据</Text>
                )}
              </Card>

              <Card
                title="快速入口"
                size="small"
              >
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Button
                      type="primary"
                      icon={<TeamOutlined />}
                      block
                      onClick={() => navigate('/expert-review/experts')}
                    >
                      专家库
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      icon={<SolutionOutlined />}
                      block
                      onClick={() => navigate('/expert-review/groups')}
                    >
                      分组派单
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      icon={<SendOutlined />}
                      block
                      onClick={() => navigate('/expert-review/scoring')}
                    >
                      专家评分
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      icon={<CheckCircleOutlined />}
                      block
                      onClick={() => navigate('/expert-review/summaries')}
                    >
                      结果汇总
                    </Button>
                  </Col>
                </Row>
              </Card>
            </Space>
          </Col>
        </Row>

        <Card
          title="最近操作审计日志"
          extra={<Button type="link" onClick={() => navigate('/logs')}>查看全部</Button>}
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={stats?.recent_activities || []}
            columns={activityColumns}
            pagination={{ pageSize: 8 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ExpertReviewCenter;
