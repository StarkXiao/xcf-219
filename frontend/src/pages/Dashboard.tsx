import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Progress,
  List,
  Tag,
  Button,
  Segmented,
  Space,
  Empty,
  Badge,
  Tooltip,
  Alert
} from 'antd';
import {
  FileTextOutlined,
  FormOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  EyeOutlined,
  WarningOutlined,
  CalendarOutlined,
  BellOutlined,
  UserOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDeclarations, getTodoKanbanSummary } from '../api/declarations';
import { getGuidelines } from '../api/guidelines';
import { StatusMap, StatusColorMap } from '../types';
import type {
  Declaration,
  Guideline,
  TodoKanbanSummary as TodoKanbanSummaryType,
  TodoKanbanDeclaration,
  TodoKanbanDeadline
} from '../types';

function Dashboard() {
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [kanbanData, setKanbanData] = useState<TodoKanbanSummaryType | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadKanbanData();
  }, [currentRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [decRes, guideRes] = await Promise.all([
        getDeclarations(),
        getGuidelines()
      ]);
      if (decRes.success) setDeclarations(decRes.data || []);
      if (guideRes.success) setGuidelines(guideRes.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  const loadKanbanData = async () => {
    setKanbanLoading(true);
    try {
      const res = await getTodoKanbanSummary({ role: currentRole });
      if (res.success) {
        setKanbanData(res.data || null);
      }
    } catch (error) {
      console.error('加载待处理事项失败:', error);
    }
    setKanbanLoading(false);
  };

  const stats = {
    total: declarations.length,
    draft: declarations.filter(d => d.status === 'draft').length,
    inProgress: declarations.filter(d => !['draft', 'approved', 'rejected'].includes(d.status)).length,
    approved: declarations.filter(d => d.status === 'approved').length,
    rejected: declarations.filter(d => d.status === 'rejected').length
  };

  const recentDeclarations = declarations.slice(0, 5);

  const renderDeclarationItem = (item: TodoKanbanDeclaration, showTimeout?: boolean) => (
    <List.Item
      key={item.id}
      style={{ paddingLeft: 12, paddingRight: 12 }}
      onClick={() => navigate(`/declarations/${item.id}`)}
    >
      <List.Item.Meta
        avatar={
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#e6f7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileTextOutlined style={{ color: '#1890ff' }} />
          </div>
        }
        title={
          <Space size={8}>
            <span
              style={{
                cursor: 'pointer',
                color: '#1890ff',
                fontWeight: 500,
                fontSize: 14
              }}
            >
              {item.title}
            </span>
            {item.step_name && (
              <Tag color="geekblue" style={{ margin: 0 }}>
                {item.step_name}
              </Tag>
            )}
            {showTimeout && item.timeout_days && (
              <Tag color="red" icon={<WarningOutlined />} style={{ margin: 0 }}>
                超时 {item.timeout_days} 天
              </Tag>
            )}
          </Space>
        }
        description={
          <Space size={16} wrap>
            <span>
              <UserOutlined style={{ marginRight: 4, color: '#999' }} />
              {item.applicant}
            </span>
            <span style={{ color: '#999' }}>
              {item.company}
            </span>
            <Tag color={StatusColorMap[item.status as keyof typeof StatusColorMap] || 'default'}>
              {StatusMap[item.status] || item.status}
            </Tag>
            {item.step_role && (
              <span style={{ color: '#999' }}>
                <AuditOutlined style={{ marginRight: 4 }} />
                {item.step_role}
              </span>
            )}
            <span style={{ color: '#999' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {new Date(item.created_at).toLocaleDateString('zh-CN')}
            </span>
          </Space>
        }
      />
      <Button
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/declarations/${item.id}`);
        }}
      >
        处理
      </Button>
    </List.Item>
  );

  const renderDeadlineItem = (item: TodoKanbanDeadline) => (
    <List.Item
      key={item.id}
      style={{ paddingLeft: 12, paddingRight: 12 }}
      onClick={() => navigate(`/guidelines`)}
    >
      <List.Item.Meta
        avatar={
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: item.is_overdue ? '#fff1f0' : item.is_urgent ? '#fff7e6' : '#f6ffed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarOutlined style={{
              color: item.is_overdue ? '#ff4d4f' : item.is_urgent ? '#faad14' : '#52c41a'
            }} />
          </div>
        }
        title={
          <Space size={8}>
            <span
              style={{
                cursor: 'pointer',
                color: '#1890ff',
                fontWeight: 500,
                fontSize: 14
              }}
            >
              {item.title}
            </span>
            {item.is_overdue && (
              <Tag color="red" icon={<ExclamationCircleOutlined />} style={{ margin: 0 }}>
                已截止
              </Tag>
            )}
            {!item.is_overdue && item.is_urgent && (
              <Tag color="orange" icon={<BellOutlined />} style={{ margin: 0 }}>
                即将截止
              </Tag>
            )}
          </Space>
        }
        description={
          <Space size={16} wrap>
            <Tag color="blue" style={{ margin: 0 }}>{item.category}</Tag>
            <span style={{ color: item.is_overdue ? '#ff4d4f' : item.is_urgent ? '#faad14' : '#666' }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              截止: {item.deadline}
            </span>
            <span style={{ color: '#999' }}>
              {item.is_overdue
                ? `已超过 ${Math.abs(item.days_remaining)} 天`
                : `剩余 ${item.days_remaining} 天`}
            </span>
            <span style={{ color: '#999' }}>
              <FormOutlined style={{ marginRight: 4 }} />
              草稿: {item.draft_count}
            </span>
            <span style={{ color: '#999' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              进行中: {item.related_count}
            </span>
          </Space>
        }
      />
    </List.Item>
  );

  const currentCounts = kanbanData?.counts_by_role?.[currentRole] || {
    pending_initial: 0,
    pending_re: 0,
    timeout: 0,
    upcoming: 0
  };

  return (
    <div>
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <h2 className="page-title" style={{ margin: 0 }}>系统概览</h2>
        <Space size={12} align="center" wrap>
          <span style={{ color: '#666' }}>
            <AuditOutlined style={{ marginRight: 6 }} />
            按角色筛选:
          </span>
          <Segmented
            options={kanbanData?.role_options || [
              { value: 'all', label: '全部角色' },
              { value: 'chushen', label: '初审角色' },
              { value: 'fushen', label: '复审角色' },
              { value: 'zhong', label: '终审/领导角色' }
            ]}
            value={currentRole}
            onChange={(val) => setCurrentRole(val as string)}
          />
        </Space>
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
        <Col xs={24} sm={24} md={12} lg={12} xl={6}>
          <Card
            loading={kanbanLoading}
            style={{ height: '100%' }}
            title={
              <Space>
                <Badge count={currentCounts.pending_initial} offset={[0, 2]}>
                  <AuditOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                </Badge>
                <span>待初审</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/declarations?status=submitted')}
              >
                全部 <ArrowRightOutlined />
              </Button>
            }
            styles={{ body: { padding: 0 } }}
          >
            {kanbanData?.pending_initial_review && kanbanData.pending_initial_review.length > 0 ? (
              <List
                size="small"
                dataSource={kanbanData!.pending_initial_review}
                renderItem={(item) => renderDeclarationItem(item)}
                style={{ maxHeight: 360, overflowY: 'auto' }}
              />
            ) : (
              <Empty
                description="暂无待初审单据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={24} md={12} lg={12} xl={6}>
          <Card
            loading={kanbanLoading}
            style={{ height: '100%' }}
            title={
              <Space>
                <Badge count={currentCounts.pending_re} offset={[0, 2]}>
                  <CheckCircleOutlined style={{ color: '#722ed1', fontSize: 16 }} />
                </Badge>
                <span>待复审</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/declarations?status=first_reviewed')}
              >
                全部 <ArrowRightOutlined />
              </Button>
            }
            styles={{ body: { padding: 0 } }}
          >
            {kanbanData?.pending_re_review && kanbanData.pending_re_review.length > 0 ? (
              <List
                size="small"
                dataSource={kanbanData!.pending_re_review}
                renderItem={(item) => renderDeclarationItem(item)}
                style={{ maxHeight: 360, overflowY: 'auto' }}
              />
            ) : (
              <Empty
                description="暂无待复审单据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={24} md={12} lg={12} xl={6}>
          <Card
            loading={kanbanLoading}
            style={{ height: '100%' }}
            title={
              <Space>
                <Badge count={currentCounts.timeout} offset={[0, 2]} color="#ff4d4f">
                  <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                </Badge>
                <span style={{ color: currentCounts.timeout > 0 ? '#ff4d4f' : undefined }}>
                  超时单据
                </span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/approval')}
              >
                处理 <ArrowRightOutlined />
              </Button>
            }
            styles={{ body: { padding: 0 } }}
          >
            {kanbanData?.timeout_declarations && kanbanData.timeout_declarations.length > 0 ? (
              <List
                size="small"
                dataSource={kanbanData!.timeout_declarations}
                renderItem={(item) => renderDeclarationItem(item, true)}
                style={{ maxHeight: 360, overflowY: 'auto' }}
              />
            ) : (
              <Empty
                description="暂无超时单据，很棒！"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={24} md={12} lg={12} xl={6}>
          <Card
            loading={kanbanLoading}
            style={{ height: '100%' }}
            title={
              <Space>
                <Badge count={currentCounts.upcoming} offset={[0, 2]} color="#faad14">
                  <CalendarOutlined style={{ color: '#faad14', fontSize: 16 }} />
                </Badge>
                <span>近期截止申报</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/guidelines')}
              >
                全部 <ArrowRightOutlined />
              </Button>
            }
            styles={{ body: { padding: 0 } }}
          >
            {kanbanData?.upcoming_deadlines && kanbanData.upcoming_deadlines.length > 0 ? (
              <List
                size="small"
                dataSource={kanbanData!.upcoming_deadlines}
                renderItem={(item) => renderDeadlineItem(item)}
                style={{ maxHeight: 360, overflowY: 'auto' }}
              />
            ) : (
              <Empty
                description="暂无近期截止项目"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {kanbanData && kanbanData.counts_by_role && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Alert
              message={
                <Space size={24} wrap>
                  {kanbanData.role_options.map(opt => {
                    const counts = kanbanData.counts_by_role[opt.value] || {};
                    const isActive = currentRole === opt.value;
                    return (
                      <Tooltip key={opt.value} title={`点击切换到${opt.label}视角`}>
                        <Tag
                          color={isActive ? 'blue' : 'default'}
                          style={{
                            cursor: 'pointer',
                            padding: '4px 12px',
                            fontSize: 13,
                            border: isActive ? '1px solid #1890ff' : undefined,
                            fontWeight: isActive ? 500 : undefined
                          }}
                          onClick={() => setCurrentRole(opt.value)}
                        >
                          {opt.label}
                          <span style={{ marginLeft: 8, opacity: 0.85 }}>
                            初{counts.pending_initial || 0} ·
                            复{counts.pending_re || 0} ·
                            <span style={{ color: counts.timeout > 0 ? '#ff4d4f' : undefined }}>
                              {' '}超时{counts.timeout || 0}
                            </span>
                          </span>
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </Space>
              }
              type="info"
              showIcon={false}
              style={{
                background: '#fafafa',
                border: '1px solid #e8e8e8'
              }}
            />
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
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
        <Col span={12}>
          <Card
            title="最新申报"
            extra={<Button type="link" onClick={() => navigate('/declarations')}>查看更多 <ArrowRightOutlined /></Button>}
          >
            <List
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