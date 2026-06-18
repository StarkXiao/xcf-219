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
  Progress,
  Alert,
  Tooltip,
  Divider,
  Descriptions,
  List,
  Avatar,
  Empty,
  Segmented
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SendOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  AuditOutlined,
  CommentOutlined,
  BarChartOutlined,
  ArrowRightOutlined,
  EyeInvisibleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import {
  getReviewSummaries,
  getReviewSummary,
  updateSummaryComment,
  writeToWorkflow,
  getReviewGroups
} from '../api/expertReview';
import type {
  ReviewSummary,
  Recommendation,
  ReviewGroup
} from '../types/expertReview';
import {
  RecommendationMap,
  RecommendationColorMap,
  GroupStatusMap,
  GroupStatusColorMap
} from '../types/expertReview';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ReviewSummaryPage: React.FC = () => {
  const { message, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<ReviewSummary[]>([]);
  const [groups, setGroups] = useState<ReviewGroup[]>([]);

  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [recommendFilter, setRecommendFilter] = useState<Recommendation | 'all'>('all');
  const [writeStatusFilter, setWriteStatusFilter] = useState<'all' | 'written' | 'pending'>('all');
  const [keyword, setKeyword] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [currentSummary, setCurrentSummary] = useState<ReviewSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [form] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  const [writeLoading, setWriteLoading] = useState<Record<number, boolean>>({});

  const fetchAll = async () => {
    try {
      const gRes = await getReviewGroups();
      if (gRes.success && gRes.data) setGroups(gRes.data);
    } catch (e) { /* ignore */ }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (groupFilter !== 'all') params.group_id = groupFilter;
      if (recommendFilter !== 'all') params.recommendation = recommendFilter;
      const res = await getReviewSummaries(params);
      if (res.success && res.data) {
        let data: ReviewSummary[] = res.data;
        if (writeStatusFilter === 'written') {
          data = data.filter((s: ReviewSummary) => s.workflow_written === 1);
        } else if (writeStatusFilter === 'pending') {
          data = data.filter((s: ReviewSummary) => s.workflow_written === 0);
        }
        if (keyword) {
          const kw = keyword.toLowerCase();
          data = data.filter((s: ReviewSummary) =>
            (s.declaration_title || '').toLowerCase().includes(kw) ||
            (s.applicant || '').toLowerCase().includes(kw) ||
            (s.company || '').toLowerCase().includes(kw)
          );
        }
        setSummaries(data);
      }
    } catch (e) {
      message.error('获取汇总列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchData();
  }, []);

  const handleViewDetail = async (s: ReviewSummary) => {
    setDetailLoading(true);
    try {
      const res = await getReviewSummary(s.declaration_id);
      if (res.success && res.data) {
        setCurrentSummary(res.data);
        setDetailOpen(true);
      }
    } catch (e) {
      message.error('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditComment = (s: ReviewSummary) => {
    form.setFieldsValue({
      final_recommendation: s.final_recommendation || 'pending',
      final_comment: s.final_comment || ''
    });
    setCurrentSummary(s);
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!currentSummary) return;
    try {
      const values = await form.validateFields();
      setEditLoading(true);
      const res = await updateSummaryComment(currentSummary.declaration_id, values);
      if (res.success) {
        message.success('意见更新成功');
        setEditOpen(false);
        fetchData();
        if (detailOpen) handleViewDetail(currentSummary);
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '更新失败');
    } finally {
      setEditLoading(false);
    }
  };

  const handleWriteToWorkflow = async (s: ReviewSummary) => {
    if (s.submitted_count < s.expert_count) {
      modal.confirm({
        title: '评审未完成确认',
        icon: <WarningOutlined />,
        content: `当前仅完成 ${s.submitted_count}/${s.expert_count} 份评审，确定要将结果写入审批流吗？`,
        okText: '确定写入',
        cancelText: '取消',
        onOk: async () => {
          await doWrite(s);
        }
      });
    } else {
      await doWrite(s);
    }
  };

  const doWrite = async (s: ReviewSummary) => {
    setWriteLoading(prev => ({ ...prev, [s.id]: true }));
    try {
      const res = await writeToWorkflow(s.declaration_id);
      if (res.success && res.data) {
        message.success(`已写入审批流：状态从 ${res.data.previous_status} 变更为 ${res.data.new_status}`);
        fetchData();
        if (detailOpen) handleViewDetail(s);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '写入失败');
    } finally {
      setWriteLoading(prev => ({ ...prev, [s.id]: false }));
    }
  };

  const avgScore = summaries.length
    ? (summaries.reduce((acc, s) => acc + (s.avg_total_score || 0), 0) / summaries.length).toFixed(2)
    : '0.00';

  const columns = [
    {
      title: '申报项目',
      dataIndex: 'declaration_title',
      key: 'declaration',
      width: 240,
      render: (v: string, r: ReviewSummary) => (
        <div>
          <Text strong ellipsis style={{ maxWidth: 240 }}>{v}</Text>
          <div style={{ fontSize: 12 }}>
            <Text type="secondary">{r.company} - {r.applicant}</Text>
          </div>
        </div>
      )
    },
    {
      title: '所属分组',
      dataIndex: 'group_name',
      key: 'group',
      width: 140,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '评审进度',
      key: 'progress',
      width: 150,
      render: (_: any, r: ReviewSummary) => {
        const pct = r.expert_count ? Math.round((r.submitted_count / r.expert_count) * 100) : 0;
        return (
          <Tooltip title={`${r.submitted_count}/${r.expert_count} 位专家已完成`}>
            <Progress percent={pct} size="small" status={r.submitted_count === r.expert_count ? 'success' : 'active'} />
          </Tooltip>
        );
      }
    },
    {
      title: '平均分',
      dataIndex: 'avg_total_score',
      key: 'avg',
      width: 100,
      render: (v: number | null) => v !== null ? (
        <Text strong style={{ color: v >= 75 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f' }}>
          {v.toFixed(2)}
        </Text>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '分数区间',
      key: 'range',
      width: 130,
      render: (_: any, r: ReviewSummary) => (
        r.min_total_score !== null && r.max_total_score !== null ? (
          <Text>
            {r.min_total_score.toFixed(1)} ~ {r.max_total_score.toFixed(1)}
          </Text>
        ) : <Text type="secondary">-</Text>
      )
    },
    {
      title: '最终推荐',
      dataIndex: 'final_recommendation',
      key: 'recommendation',
      width: 120,
      render: (v: Recommendation | null) => v ? (
        <Tag color={RecommendationColorMap[v]}>{RecommendationMap[v]}</Tag>
      ) : <Tag color="default">待确定</Tag>
    },
    {
      title: '审批流',
      dataIndex: 'workflow_written',
      key: 'workflow',
      width: 100,
      render: (v: number, r: ReviewSummary) => v === 1 ? (
        <Tooltip title={r.written_at ? `写入时间: ${dayjs(r.written_at).format('YYYY-MM-DD HH:mm')}` : '已写入'}>
          <Tag icon={<CheckCircleOutlined />} color="success">已回写</Tag>
        </Tooltip>
      ) : (
        <Tag icon={<SendOutlined />} color="warning">待回写</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, r: ReviewSummary) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
            查看详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CommentOutlined />}
            onClick={() => openEditComment(r)}
          >
            评定意见
          </Button>
          {r.workflow_written === 0 && (
            <Button
              type="link"
              size="small"
              icon={<ArrowRightOutlined />}
              loading={writeLoading[r.id]}
              onClick={() => handleWriteToWorkflow(r)}
            >
              回写审批
            </Button>
          )}
        </Space>
      )
    }
  ];

  const getScoreLevel = (score: number) => {
    if (score >= 85) return { level: '强烈推荐', color: '#52c41a' };
    if (score >= 75) return { level: '推荐立项', color: '#52c41a' };
    if (score >= 60) return { level: '有条件推荐', color: '#faad14' };
    return { level: '不予推荐', color: '#ff4d4f' };
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Row gutter={16}>
            <Col xs={24} sm={6}>
              <Statistic
                title="评审汇总总数"
                value={summaries.length}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="平均总得分"
                value={avgScore}
                suffix="/ 100"
                prefix={<AuditOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="已回写审批流"
                value={summaries.filter(s => s.workflow_written === 1).length}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="待回写"
                value={summaries.filter(s => s.workflow_written === 0).length}
                prefix={<SendOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
          </Row>
        </Card>

        <Card
          title="评审意见汇总"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            </Space>
          }
        >
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索项目名称/单位/申请人"
              allowClear
              style={{ width: 240 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={fetchData}
            />
            <Select
              value={groupFilter}
              onChange={setGroupFilter}
              style={{ width: 180 }}
              allowClear
              placeholder="选择评审分组"
              onClear={() => setGroupFilter('all')}
            >
              <Option value="all">全部分组</Option>
              {groups.map(g => (
                <Option key={g.id} value={String(g.id)}>{g.name}</Option>
              ))}
            </Select>
            <Select
              value={recommendFilter}
              onChange={(v: Recommendation | 'all') => setRecommendFilter(v)}
              style={{ width: 160 }}
            >
              <Option value="all">全部推荐</Option>
              <Option value="strongly_recommend">强烈推荐</Option>
              <Option value="recommend">推荐立项</Option>
              <Option value="conditionally_recommend">有条件推荐</Option>
              <Option value="not_recommend">不予推荐</Option>
              <Option value="pending">待确定</Option>
            </Select>
            <Segmented
              value={writeStatusFilter}
              onChange={(v) => setWriteStatusFilter(v as any)}
              options={[
                { label: '全部', value: 'all' },
                { label: '已回写', value: 'written' },
                { label: '待回写', value: 'pending' }
              ]}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>搜索</Button>
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={summaries}
            columns={columns}
            scroll={{ x: 1400 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条汇总记录`
            }}
          />
        </Card>
      </Space>

      <Modal
        title={
          <Space>
            <BarChartOutlined />
            <span>评审意见详情</span>
          </Space>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={1000}
        destroyOnClose
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>,
          currentSummary && (
            <Button
              key="comment"
              icon={<CommentOutlined />}
              onClick={() => openEditComment(currentSummary)}
            >
              评定最终意见
            </Button>
          ),
          currentSummary && currentSummary.workflow_written === 0 && (
            <Button
              key="write"
              type="primary"
              icon={<ArrowRightOutlined />}
              loading={writeLoading[currentSummary.id]}
              onClick={() => handleWriteToWorkflow(currentSummary)}
            >
              结果回写审批流
            </Button>
          )
        ]}
      >
        {currentSummary ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {currentSummary.workflow_written === 1 && (
              <Alert
                type="success"
                showIcon
                message="评审结果已写入审批流"
                description={`写入时间：${dayjs(currentSummary.written_at).format('YYYY-MM-DD HH:mm')}，操作人：${currentSummary.written_by || '系统'}`}
              />
            )}

            <Descriptions bordered column={2} size="small" title="项目基本信息">
              <Descriptions.Item label="项目名称" span={2}>
                <Text strong>{currentSummary.declaration_title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="申报单位">{currentSummary.company}</Descriptions.Item>
              <Descriptions.Item label="申请人">{currentSummary.applicant}</Descriptions.Item>
              <Descriptions.Item label="所属分组">{currentSummary.group_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="申报状态">
                <Tag color="blue">{currentSummary.status || '-'}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16}>
              <Col xs={12} sm={8}>
                <Card size="small">
                  <Statistic
                    title="参与专家"
                    value={`${currentSummary.submitted_count}/${currentSummary.expert_count}`}
                    prefix={<TeamOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small">
                  <Statistic
                    title="平均总分"
                    value={currentSummary.avg_total_score?.toFixed(2) || '-'}
                    valueStyle={{
                      color: currentSummary.avg_total_score !== null && currentSummary.avg_total_score >= 75
                        ? '#52c41a'
                        : currentSummary.avg_total_score !== null && currentSummary.avg_total_score >= 60
                          ? '#faad14'
                          : '#ff4d4f'
                    }}
                    prefix={<AuditOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small">
                  <Statistic
                    title="最终推荐意见"
                    value={currentSummary.final_recommendation ? RecommendationMap[currentSummary.final_recommendation] : '待确定'}
                    valueStyle={{
                      color: currentSummary.final_recommendation
                        ? ''
                        : '#999'
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {currentSummary.criterion_stats && currentSummary.criterion_stats.length > 0 && (
              <Card size="small" title="各指标平均得分" type="inner">
                <List
                  dataSource={currentSummary.criterion_stats}
                  locale={{ emptyText: '暂无数据' }}
                  renderItem={(c: any) => (
                    <List.Item>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <Text strong>{c.criterion_name}</Text>
                          <Tag color="blue">权重 {(c.weight * 100).toFixed(0)}%</Tag>
                        </Space>
                        <Space>
                          <Progress
                            percent={c.avg_score !== null ? Math.round((c.avg_score / c.max_score) * 100) : 0}
                            size="small"
                            style={{ width: 200 }}
                          />
                          <Text strong style={{ width: 100, textAlign: 'right' }}>
                            {c.avg_score !== null ? `${c.avg_score.toFixed(2)}/${c.max_score}` : '-'}
                          </Text>
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            <Divider orientation="left">
              <Space>
                <UserOutlined />
                <span>专家评审意见详情</span>
              </Space>
            </Divider>

            {currentSummary.expert_reviews && currentSummary.expert_reviews.length > 0 ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {currentSummary.expert_reviews.map((review: any, idx: number) => (
                  <Card
                    key={review.task_id || idx}
                    size="small"
                    type={review.total_score !== null ? 'inner' : undefined}
                    title={
                      <Space>
                        <Avatar
                          icon={review.is_anonymous ? <EyeInvisibleOutlined /> : <UserOutlined />}
                          style={{ backgroundColor: review.is_anonymous ? '#8c8c8c' : '#1890ff' }}
                        />
                        <div>
                          <Text strong>{review.expert_display}</Text>
                          {review.expert_field && <Tag color="purple" style={{ marginLeft: 8 }}>{review.expert_field}</Tag>}
                          {review.expert_level && <Tag color="gold">{review.expert_level}</Tag>}
                        </div>
                      </Space>
                    }
                    extra={
                      review.total_score !== null ? (
                        <Space>
                          <Tag color={getScoreLevel(review.total_score).color}>
                            {getScoreLevel(review.total_score).level}
                          </Tag>
                          <Text strong style={{ fontSize: 16, color: getScoreLevel(review.total_score).color }}>
                            {review.total_score.toFixed(2)}
                          </Text>
                        </Space>
                      ) : <Tag color="default">评审中</Tag>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Paragraph style={{ marginBottom: 0 }}>
                        {review.review_comment || <Text type="secondary">专家未填写评审意见</Text>}
                      </Paragraph>
                      {review.submitted_at && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          提交时间：{dayjs(review.submitted_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      )}

                      {currentSummary.individual_scores && (
                        <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                          <Row gutter={[12, 8]}>
                            {currentSummary.individual_scores
                              .filter((is: any) => is.task_id === review.task_id && is.expert_id === review.expert_id)
                              .map((is: any) => (
                                <Col xs={24} sm={12} key={is.criterion_id}>
                                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Text type="secondary">{is.criterion_name}:</Text>
                                    <Text strong>{is.score.toFixed(2)}</Text>
                                  </Space>
                                  {is.comment && (
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                      - {is.comment}
                                    </Text>
                                  )}
                                </Col>
                              ))}
                          </Row>
                        </div>
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Empty description="暂无专家评审记录" />
            )}

            {(currentSummary.final_comment || currentSummary.final_recommendation) && (
              <>
                <Divider orientation="left">
                  <Space>
                    <CommentOutlined />
                    <span>最终评定意见</span>
                  </Space>
                </Divider>
                <Alert
                  type={currentSummary.final_recommendation
                    ? (currentSummary.final_recommendation === 'strongly_recommend' || currentSummary.final_recommendation === 'recommend'
                      ? 'success'
                      : currentSummary.final_recommendation === 'conditionally_recommend'
                        ? 'warning'
                        : 'error')
                    : 'info'}
                  showIcon
                  message={
                    <Space>
                      <span>最终推荐：</span>
                      <Text strong>
                        {currentSummary.final_recommendation
                          ? RecommendationMap[currentSummary.final_recommendation]
                          : '待确定'}
                      </Text>
                    </Space>
                  }
                  description={currentSummary.final_comment || '暂无详细评定说明'}
                />
              </>
            )}
          </Space>
        ) : (
          <Empty description="加载中..." />
        )}
      </Modal>

      <Modal
        title="评定最终评审意见"
        open={editOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={editLoading}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="final_recommendation"
            label="最终推荐意见"
            rules={[{ required: true, message: '请选择最终推荐意见' }]}
          >
            <Select placeholder="请选择最终推荐">
              <Option value="pending">待定（继续等待评审）</Option>
              <Option value="strongly_recommend">强烈推荐立项</Option>
              <Option value="recommend">推荐立项</Option>
              <Option value="conditionally_recommend">有条件推荐</Option>
              <Option value="not_recommend">不予推荐</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="final_comment"
            label="综合评定说明"
            tooltip="可综合各专家意见，给出最终评定说明"
          >
            <TextArea
              rows={6}
              placeholder="请填写综合各专家意见后的最终评定说明，包括项目优缺点、改进建议、以及推荐理由等..."
              showCount
              maxLength={2000}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReviewSummaryPage;
