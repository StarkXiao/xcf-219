import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Modal,
  Form,
  Row,
  Col,
  Statistic,
  App as AntdApp,
  Typography,
  Input,
  InputNumber,
  Progress,
  Alert,
  Tooltip,
  Divider,
  Descriptions,
  Rate
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  PlayCircleOutlined,
  PaperClipOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import {
  getReviewTasks,
  getReviewTask,
  startReviewTask,
  submitReviewTask,
  getExperts
} from '../api/expertReview';
import type {
  ReviewTask,
  TaskStatus,
  Expert,
  ScoringCriterion,
  ScoreRecord
} from '../types/expertReview';
import { TaskStatusMap, TaskStatusColorMap } from '../types/expertReview';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ExpertScoring: React.FC = () => {
  const { message, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);

  const [expertFilter, setExpertFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<ReviewTask | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [scores, setScores] = useState<Record<number, { score: number; comment: string }>>({});
  const [overallComment, setOverallComment] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [anonymous, setAnonymous] = useState(true);

  const fetchAll = async () => {
    try {
      const res = await getExperts();
      if (res.success && res.data) setExperts(res.data as unknown as Expert[]);
    } catch (e) { /* ignore */ }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (expertFilter !== 'all') params.expert_id = expertFilter;
      const res = await getReviewTasks(params);
      if (res.success && res.data) setTasks(res.data);
    } catch (e) {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchData();
  }, []);

  const handleOpenReview = async (task: ReviewTask) => {
    try {
      const res = await getReviewTask(task.id);
      if (res.success && res.data) {
        const data = res.data;
        setCurrentTask(data);
        setCriteria(data.criteria || []);
        setAnonymous(!!data.is_anonymous);

        const initialScores: Record<number, { score: number; comment: string }> = {};
        (data.scores || []).forEach((s: ScoreRecord) => {
          initialScores[s.criterion_id] = {
            score: s.score,
            comment: s.comment || ''
          };
        });
        (data.criteria || []).forEach((c: ScoringCriterion) => {
          if (!initialScores[c.id]) {
            initialScores[c.id] = { score: 0, comment: '' };
          }
        });

        setScores(initialScores);
        setOverallComment(data.review_comment || '');
        setReviewOpen(true);

        if (data.status === 'pending' || data.status === 'assigned') {
          await startReviewTask(task.id);
          fetchData();
        }
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '获取评审详情失败');
    }
  };

  const handleSubmit = async () => {
    if (!currentTask) return;

    const allCriteria = criteria || [];
    for (const c of allCriteria) {
      const s = scores[c.id];
      if (!s || s.score < 0 || s.score > c.max_score) {
        message.error(`请为 [${c.name}] 填写合法分数 (0-${c.max_score})`);
        return;
      }
    }

    const scoreList = allCriteria.map(c => ({
      criterion_id: c.id,
      score: scores[c.id]?.score || 0,
      comment: scores[c.id]?.comment
    }));

    setSubmitLoading(true);
    try {
      const res = await submitReviewTask(currentTask.id, {
        scores: scoreList,
        review_comment: overallComment
      });
      if (res.success && res.data) {
        message.success(`评审提交成功！总评分：${res.data.total_score.toFixed(2)}`);
        setReviewOpen(false);
        fetchData();
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '提交失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const totalScore = criteria.reduce((sum, c) => {
    return sum + ((scores[c.id]?.score || 0) * c.weight);
  }, 0);
  const maxTotalScore = criteria.reduce((sum, c) => sum + c.max_score * c.weight, 0);

  const submittedCount = tasks.filter(t => t.status === 'submitted' || t.status === 'completed').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;

  const columns = [
    {
      title: '申报项目',
      dataIndex: 'declaration_title',
      key: 'declaration',
      width: 240,
      render: (v: string, r: ReviewTask) => (
        <div>
          <Text strong ellipsis style={{ maxWidth: 240 }}>{v}</Text>
          <div style={{ fontSize: 12 }}>
            <Text type="secondary">{r.company} - {r.applicant}</Text>
          </div>
        </div>
      )
    },
    {
      title: '关联指南',
      dataIndex: 'guideline_title',
      key: 'guideline',
      width: 160,
      ellipsis: true,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-'
    },
    {
      title: '所属分组',
      dataIndex: 'group_name',
      key: 'group',
      width: 150,
      ellipsis: true
    },
    {
      title: anonymous ? '匿名专家' : '评审专家',
      dataIndex: 'expert_name',
      key: 'expert',
      width: 120,
      render: (v: string, r: ReviewTask) => (
        <Space>
          {anonymous && <EyeInvisibleOutlined />}
          <span>{anonymous ? `专家${r.expert_id}` : v}</span>
        </Space>
      )
    },
    {
      title: '专家领域',
      dataIndex: 'expert_field',
      key: 'field',
      width: 100,
      render: (v: string) => v ? <Tag color="purple">{v}</Tag> : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: TaskStatus) => (
        <Tag color={TaskStatusColorMap[v]}>{TaskStatusMap[v]}</Tag>
      )
    },
    {
      title: '得分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      render: (v: number | null) => v !== null ? (
        <Text strong style={{ color: v >= 75 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f' }}>
          {v.toFixed(2)}
        </Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '分配时间',
      dataIndex: 'assigned_at',
      key: 'assigned',
      width: 150,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: ReviewTask) => {
        const canReview = r.status !== 'submitted' && r.status !== 'completed';
        return (
          <Space size="small">
            <Tooltip title={canReview ? '开始/继续评审' : '查看评审'}>
              <Button
                type="link"
                size="small"
                icon={canReview ? (r.status === 'in_progress' ? <SendOutlined /> : <PlayCircleOutlined />) : <EyeOutlined />}
                onClick={() => handleOpenReview(r)}
              >
                {canReview ? (r.status === 'in_progress' ? '继续评审' : '开始评审') : '查看'}
              </Button>
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Statistic
                title="评审任务总数"
                value={tasks.length}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="评审中"
                value={inProgressCount}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="已提交"
                value={submittedCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>
        </Card>

        <Card
          title="评审任务列表"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            </Space>
          }
        >
          <Space style={{ marginBottom: 16 }} wrap>
            <Select
              value={expertFilter}
              onChange={setExpertFilter}
              style={{ width: 200 }}
              placeholder="选择专家"
              allowClear
              onClear={() => setExpertFilter('all')}
            >
              <Option value="all">全部专家</Option>
              {experts.map(e => (
                <Option key={e.id} value={String(e.id)}>
                  {anonymous ? `专家${e.id}` : e.name} [{e.field || ''}]
                </Option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(v: TaskStatus | 'all') => setStatusFilter(v)}
              style={{ width: 180 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待分配</Option>
              <Option value="assigned">已分配</Option>
              <Option value="in_progress">评审中</Option>
              <Option value="submitted">已提交</Option>
              <Option value="completed">已完成</Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>搜索</Button>
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={tasks}
            columns={columns}
            scroll={{ x: 1400 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个任务`
            }}
          />
        </Card>
      </Space>

      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>专家评审{anonymous ? '（匿名模式）' : ''}</span>
          </Space>
        }
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        footer={
          currentTask?.status === 'submitted' || currentTask?.status === 'completed'
            ? [<Button key="close" onClick={() => setReviewOpen(false)}>关闭</Button>]
            : [
              <Button key="cancel" onClick={() => setReviewOpen(false)}>取消</Button>,
              <Button
                key="submit"
                type="primary"
                icon={<SendOutlined />}
                loading={submitLoading}
                onClick={handleSubmit}
              >
                提交评审
              </Button>
            ]
        }
        width={900}
        destroyOnClose
      >
        {currentTask && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message={
                currentTask.status === 'submitted' || currentTask.status === 'completed'
                  ? '此评审已提交，以下为历史评审内容'
                  : '请客观公正地根据各项指标进行评分，填写详细的评审意见'
              }
            />

            <Descriptions bordered column={2} size="small" title="申报项目信息">
              <Descriptions.Item label="项目名称" span={2}>
                <Text strong>{currentTask.declaration_title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="申报单位">{currentTask.company}</Descriptions.Item>
              <Descriptions.Item label="申请人">{currentTask.applicant}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{currentTask.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{currentTask.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属指南" span={2}>
                {currentTask.guideline_title || <Text type="secondary">-</Text>}
              </Descriptions.Item>
            </Descriptions>

            {currentTask.declaration_content && (
              <Card size="small" title="项目内容摘要" type="inner">
                <Paragraph ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}>
                  {currentTask.declaration_content}
                </Paragraph>
              </Card>
            )}

            {currentTask.attachments && currentTask.attachments.length > 0 && (
              <Card size="small" title="附件材料" type="inner">
                {currentTask.attachments.map(a => (
                  <Space key={a.id}>
                    <PaperClipOutlined />
                    <a>{a.original_name}</a>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({((a.file_size || 0) / 1024 / 1024).toFixed(2)} MB)
                    </Text>
                  </Space>
                ))}
              </Card>
            )}

            <Card
              size="small"
              type="inner"
              title={
                <Space>
                  <span>评分项</span>
                  <Tag color="orange">
                    总分: {totalScore.toFixed(2)} / {maxTotalScore.toFixed(2)}
                  </Tag>
                  <Progress
                    percent={maxTotalScore ? Math.round((totalScore / maxTotalScore) * 100) : 0}
                    size="small"
                    style={{ width: 200 }}
                  />
                </Space>
              }
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {criteria.map(c => (
                  <div key={c.id} style={{ padding: '12px', background: '#fafafa', borderRadius: 8 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Text strong>{c.name}</Text>
                        <Tag color="blue">权重 {(c.weight * 100).toFixed(0)}%</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>满分 {c.max_score}</Text>
                      </Space>
                      <Space>
                        <Rate
                          allowHalf
                          count={5}
                          value={scores[c.id]?.score ? (scores[c.id].score / c.max_score) * 5 : 0}
                          disabled={currentTask.status === 'submitted' || currentTask.status === 'completed'}
                          onChange={(v) => setScores(prev => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] || { comment: '' }), score: Math.round((v * c.max_score / 5) * 100) / 100 }
                          }))}
                        />
                        <InputNumber
                          min={0}
                          max={c.max_score}
                          step={0.5}
                          value={scores[c.id]?.score ?? 0}
                          disabled={currentTask.status === 'submitted' || currentTask.status === 'completed'}
                          style={{ width: 100 }}
                          onChange={(v) => setScores(prev => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] || { comment: '' }), score: v ?? 0 }
                          }))}
                        />
                      </Space>
                    </Space>
                    {c.description && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', margin: '4px 0 8px' }}>
                        {c.description}
                      </Text>
                    )}
                    <TextArea
                      rows={2}
                      placeholder="请填写该项评分意见（可选）..."
                      value={scores[c.id]?.comment || ''}
                      disabled={currentTask.status === 'submitted' || currentTask.status === 'completed'}
                      onChange={e => setScores(prev => ({
                        ...prev,
                        [c.id]: { ...(prev[c.id] || { score: 0 }), comment: e.target.value }
                      }))}
                    />
                    <Divider style={{ margin: '12px 0 0' }} />
                    <div style={{ textAlign: 'right' }}>
                      <Text type="secondary">
                        该项加权得分：
                        <Text strong style={{ color: '#1890ff' }}>
                          {((scores[c.id]?.score || 0) * c.weight).toFixed(2)}
                        </Text>
                        / {(c.max_score * c.weight).toFixed(2)}
                      </Text>
                    </div>
                  </div>
                ))}
              </Space>
            </Card>

            <Form.Item
              label="综合评审意见"
              style={{ marginBottom: 0 }}
            >
              <TextArea
                rows={4}
                placeholder="请填写对本项目的整体评价、优点、不足及改进建议..."
                value={overallComment}
                disabled={currentTask.status === 'submitted' || currentTask.status === 'completed'}
                onChange={e => setOverallComment(e.target.value)}
              />
            </Form.Item>

            <Alert
              type={totalScore >= 75 ? 'success' : totalScore >= 60 ? 'warning' : 'error'}
              showIcon
              message={
                <Space>
                  <span>综合评价：</span>
                  <Text strong style={{ fontSize: 16 }}>
                    {totalScore.toFixed(2)} 分
                  </Text>
                  <span>
                    {totalScore >= 85 ? '（强烈推荐立项）'
                      : totalScore >= 75 ? '（推荐立项）'
                        : totalScore >= 60 ? '（有条件推荐）'
                          : '（不予推荐）'}
                  </span>
                </Space>
              }
              description="本评价为各项指标按权重计算的结果，仅供参考"
            />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ExpertScoring;
