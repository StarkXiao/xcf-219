import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Progress, List, Tag, Button, Empty } from 'antd';
import {
  FileTextOutlined,
  FormOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  StarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDeclarations } from '../api/declarations';
import { getGuidelines } from '../api/guidelines';
import { getPolicyMatchStats } from '../api/policy-match';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration, Guideline, PolicyMatchStats } from '../types';

function Dashboard() {
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [policyMatchStats, setPolicyMatchStats] = useState<PolicyMatchStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [decRes, guideRes, statsRes] = await Promise.all([
        getDeclarations(),
        getGuidelines(),
        getPolicyMatchStats()
      ]);
      if (decRes.success) setDeclarations(decRes.data || []);
      if (guideRes.success) setGuidelines(guideRes.data || []);
      if (statsRes.success) setPolicyMatchStats(statsRes.data || null);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  const stats = {
    total: declarations.length,
    draft: declarations.filter(d => d.status === 'draft').length,
    inProgress: declarations.filter(d => !['draft', 'approved', 'rejected'].includes(d.status)).length,
    approved: declarations.filter(d => d.status === 'approved').length,
    rejected: declarations.filter(d => d.status === 'rejected').length
  };

  const recentDeclarations = declarations.slice(0, 5);

  const topGuidelines = policyMatchStats?.top_guidelines || [];
  const matchRate = (policyMatchStats?.total_matches ?? 0) > 0
    ? Math.round(((policyMatchStats?.total_selections ?? 0) / (policyMatchStats?.total_matches ?? 1)) * 100)
    : 0;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">系统概览</h2>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="申报总数"
              value={stats.total}
              prefix={<FormOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="草稿数量"
              value={stats.draft}
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="审批中"
              value={stats.inProgress}
              prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="已立项"
              value={stats.approved}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="智能匹配次数"
              value={policyMatchStats?.total_matches || 0}
              prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="用户采纳数"
              value={policyMatchStats?.total_selections || 0}
              prefix={<RiseOutlined style={{ color: '#13c2c2' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="平均匹配分"
              value={policyMatchStats?.avg_top_score || 0}
              suffix="分"
              precision={1}
              prefix={<StarOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="采纳率"
              value={matchRate}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card
            title="热门政策推荐排行"
            extra={<Button type="link" onClick={() => navigate('/guidelines')}>查看更多 <ArrowRightOutlined /></Button>}
          >
            {topGuidelines.length > 0 ? (
              <List
                dataSource={topGuidelines.slice(0, 5)}
                renderItem={(item, index) => (
                  <List.Item key={item.guideline_id}>
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: index < 3 ? '#fa8c16' : '#d9d9d9',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 'bold'
                        }}>
                          {index + 1}
                        </div>
                      }
                      title={item.title}
                      description={
                        <div>
                          <Tag color="blue">匹配 {item.match_count} 次</Tag>
                          <Tag color="green">采纳 {item.selected_count} 次</Tag>
                          <span style={{ color: '#999', marginLeft: 8 }}>
                            平均分: {item.avg_score?.toFixed(1) || 0}
                          </span>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无匹配数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="申报指南"
            extra={<Button type="link" onClick={() => navigate('/guidelines')}>查看更多 <ArrowRightOutlined /></Button>}
          >
            <List
              dataSource={guidelines.slice(0, 5)}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={item.title}
                    description={
                      <div>
                        <Tag color="blue">{item.category}</Tag>
                        <span style={{ color: '#999', marginLeft: 8 }}>
                          截止日期: {item.deadline || '长期有效'}
                        </span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            title="最新申报"
            extra={<Button type="link" onClick={() => navigate('/declarations')}>查看更多 <ArrowRightOutlined /></Button>}
          >
            <List
              grid={{ gutter: 16, column: 2 }}
              dataSource={recentDeclarations}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={<span onClick={() => navigate(`/declarations/${item.id}`)} style={{ cursor: 'pointer', color: '#1890ff' }}>{item.title}</span>}
                    description={
                      <div>
                        <span style={{ marginRight: 16 }}>申请人: {item.applicant}</span>
                        <Tag color={StatusColorMap[item.status as keyof typeof StatusColorMap]}>
                          {StatusMap[item.status]}
                        </Tag>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="审批进度统计">
            <Row gutter={[32, 16]}>
              <Col span={8}>
                <div style={{ marginBottom: 8 }}>草稿</div>
                <Progress percent={stats.total > 0 ? Math.round(stats.draft / stats.total * 100) : 0} status="normal" />
              </Col>
              <Col span={8}>
                <div style={{ marginBottom: 8 }}>审批中</div>
                <Progress percent={stats.total > 0 ? Math.round(stats.inProgress / stats.total * 100) : 0} status="active" />
              </Col>
              <Col span={8}>
                <div style={{ marginBottom: 8 }}>已立项</div>
                <Progress percent={stats.total > 0 ? Math.round(stats.approved / stats.total * 100) : 0} status="success" />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
