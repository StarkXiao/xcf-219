import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  Row,
  Col,
  Statistic,
  Tabs,
  List,
  Transfer,
  Checkbox,
  App as AntdApp,
  Typography,
  Tooltip,
  Divider,
  Alert,
  Progress,
  Descriptions,
  InputNumber
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  UserAddOutlined,
  FileAddOutlined,
  AuditOutlined,
  SolutionOutlined
} from '@ant-design/icons';
import {
  getReviewGroups,
  createReviewGroup,
  getReviewGroup,
  updateGroupStatus,
  addDeclarationsToGroup,
  addExpertsToGroup,
  getExperts,
  getExpertFields
} from '../api/expertReview';
import { getDeclarations } from '../api/declarations';
import { getGuidelines } from '../api/guidelines';
import type { Declaration, Guideline } from '../types';
import type {
  ReviewGroup,
  GroupStatus,
  Expert,
  GroupStatus as ReviewGroupStatus
} from '../types/expertReview';
import {
  GroupStatusMap,
  GroupStatusColorMap,
  ExpertLevelMap,
  ExpertLevelColorMap
} from '../types/expertReview';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const ReviewGroupDispatch: React.FC = () => {
  const { message, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewGroupStatus | 'all'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addDeclOpen, setAddDeclOpen] = useState(false);
  const [addExpertOpen, setAddExpertOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<ReviewGroup | null>(null);
  const [detailGroup, setDetailGroup] = useState<ReviewGroup | null>(null);

  const [form] = Form.useForm();
  const [selectedDeclarations, setSelectedDeclarations] = useState<number[]>([]);
  const [selectedExperts, setSelectedExperts] = useState<number[]>([]);

  const fetchAll = async () => {
    try {
      const [gRes, eRes, fRes, dRes, glRes] = await Promise.all([
        getReviewGroups(),
        getExperts(),
        getExpertFields(),
        getDeclarations(),
        getGuidelines()
      ]);
      if (gRes.success && gRes.data) setGroups(gRes.data);
      if (eRes.success && eRes.data) setExperts(eRes.data as unknown as Expert[]);
      if (fRes.success && fRes.data) setFields(fRes.data);
      if (dRes.success && dRes.data) setDeclarations(dRes.data as unknown as Declaration[]);
      if (glRes.success && glRes.data) setGuidelines(glRes.data as unknown as Guideline[]);
    } catch (e) { /* ignore */ }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getReviewGroups(params);
      if (res.success && res.data) {
        let data: ReviewGroup[] = res.data;
        if (keyword) {
          const kw = keyword.toLowerCase();
          data = data.filter(g =>
            g.name.toLowerCase().includes(kw) ||
            (g.guideline_title || '').toLowerCase().includes(kw) ||
            (g.description || '').toLowerCase().includes(kw)
          );
        }
        setGroups(data);
      }
    } catch (e) {
      message.error('获取分组列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchData();
  }, []);

  const handleCreate = () => {
    form.resetFields();
    setSelectedDeclarations([]);
    setSelectedExperts([]);
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: any = {
        ...values,
        deadline: values.deadline ? dayjs(values.deadline).toISOString() : undefined
      };
      if (selectedDeclarations.length) data.declaration_ids = selectedDeclarations;
      if (selectedExperts.length) data.expert_ids = selectedExperts;

      const res = await createReviewGroup(data);
      if (res.success && res.data) {
        message.success(`创建成功，生成 ${res.data.task_count} 个评审任务`);
        setCreateOpen(false);
        fetchData();
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '创建失败');
    }
  };

  const handleView = async (g: ReviewGroup) => {
    try {
      const res = await getReviewGroup(g.id);
      if (res.success && res.data) {
        setDetailGroup(res.data);
        setDetailOpen(true);
      }
    } catch (e) {
      message.error('获取分组详情失败');
    }
  };

  const handleUpdateStatus = async (g: ReviewGroup, status: GroupStatus) => {
    try {
      const res = await updateGroupStatus(g.id, status);
      if (res.success) {
        message.success('状态更新成功');
        fetchData();
        if (detailGroup?.id === g.id) handleView(g);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '更新失败');
    }
  };

  const openAddDeclarations = (g: ReviewGroup) => {
    setCurrentGroup(g);
    setSelectedDeclarations([]);
    setAddDeclOpen(true);
  };

  const submitAddDeclarations = async () => {
    if (!currentGroup || !selectedDeclarations.length) {
      message.warning('请选择申报项目');
      return;
    }
    try {
      const res = await addDeclarationsToGroup(currentGroup.id, selectedDeclarations);
      if (res.success && res.data) {
        message.success(`成功添加 ${res.data.added} 个申报项目`);
        setAddDeclOpen(false);
        fetchData();
        if (detailGroup?.id === currentGroup.id) handleView(currentGroup);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '添加失败');
    }
  };

  const openAddExperts = (g: ReviewGroup) => {
    setCurrentGroup(g);
    setSelectedExperts([]);
    setAddExpertOpen(true);
  };

  const submitAddExperts = async () => {
    if (!currentGroup || !selectedExperts.length) {
      message.warning('请选择专家');
      return;
    }
    try {
      const res = await addExpertsToGroup(currentGroup.id, selectedExperts);
      if (res.success && res.data) {
        message.success(`成功添加 ${res.data.added} 位专家`);
        setAddExpertOpen(false);
        fetchData();
        if (detailGroup?.id === currentGroup.id) handleView(currentGroup);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '添加失败');
    }
  };

  const availableDeclarations = declarations.filter(d => {
    const hasExpertStep = ['first_reviewed', 'formal_reviewed', 'submitted'].includes(d.status);
    return d.status !== 'draft' && d.status !== 'rejected' && d.status !== 'approved';
  });

  const totalTasks = groups.reduce((acc, g) => acc + (g.total_tasks || 0), 0);
  const totalSubmitted = groups.reduce((acc, g) => acc + (g.submitted_tasks || 0), 0);

  const columns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, r: ReviewGroup) => (
        <a onClick={() => handleView(r)} style={{ fontWeight: 500 }}>{v}</a>
      )
    },
    {
      title: '关联指南',
      dataIndex: 'guideline_title',
      key: 'guideline',
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '申报数量',
      key: 'decl_count',
      width: 100,
      align: 'center' as const,
      render: (_: any, r: ReviewGroup) => (
        <Text strong>{r.declaration_ids?.length || 0}</Text>
      )
    },
    {
      title: '专家数量',
      key: 'expert_count',
      width: 100,
      align: 'center' as const,
      render: (_: any, r: ReviewGroup) => (
        <Text strong>{r.expert_ids?.length || 0}</Text>
      )
    },
    {
      title: '任务进度',
      key: 'progress',
      width: 200,
      render: (_: any, r: ReviewGroup) => {
        const total = r.total_tasks || 0;
        const done = r.submitted_tasks || 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <Tooltip title={`${done}/${total} 个已完成`}>
            <Progress percent={pct} size="small" />
          </Tooltip>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: ReviewGroupStatus) => (
        <Tag color={GroupStatusColorMap[v]}>{GroupStatusMap[v]}</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, r: ReviewGroup) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>详情</Button>
          <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => openAddDeclarations(r)}>加申报</Button>
          <Button type="link" size="small" icon={<UserAddOutlined />} onClick={() => openAddExperts(r)}>加专家</Button>
          {r.status === 'pending' && (
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleUpdateStatus(r, 'in_progress')}>
              启动评审
            </Button>
          )}
          {r.status === 'in_progress' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleUpdateStatus(r, 'completed')}>
              完成
            </Button>
          )}
        </Space>
      )
    }
  ];

  const existingDeclSet = new Set(currentGroup?.declaration_ids || []);
  const existingExpertSet = new Set(currentGroup?.expert_ids || []);

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Row gutter={16}>
            <Col xs={24} sm={6}>
              <Statistic
                title="评审分组"
                value={groups.length}
                prefix={<SolutionOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="总任务数"
                value={totalTasks}
                prefix={<FileTextOutlined />}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="已完成任务"
                value={totalSubmitted}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic
                title="进行中分组"
                value={groups.filter(g => g.status === 'in_progress').length}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
          </Row>
        </Card>

        <Card
          title="评审分组管理"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建分组</Button>
            </Space>
          }
        >
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索分组名称/指南/描述"
              allowClear
              style={{ width: 280 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={fetchData}
            />
            <Select
              value={statusFilter}
              onChange={(v: ReviewGroupStatus | 'all') => setStatusFilter(v)}
              style={{ width: 160 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待分配</Option>
              <Option value="in_progress">评审中</Option>
              <Option value="completed">已完成</Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>搜索</Button>
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={groups}
            columns={columns}
            scroll={{ x: 1300 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个分组`
            }}
          />
        </Card>
      </Space>

      <Modal
        title="新建评审分组"
        open={createOpen}
        onOk={handleSubmit}
        onCancel={() => setCreateOpen(false)}
        okText="创建分组并派单"
        cancelText="取消"
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="分组名称"
                rules={[{ required: true, message: '请输入分组名称' }]}
              >
                <Input placeholder="如：2024年度科技项目-电子信息组" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="guideline_id" label="关联申报指南">
                <Select allowClear showSearch placeholder="选择关联指南（可选）">
                  {guidelines.map(g => (
                    <Option key={g.id} value={g.id}>{g.title}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="分组说明">
            <Input.TextArea rows={2} placeholder="简要说明本评审分组的范围和要求" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="专家选择方式">
                <Select
                  defaultValue="manual"
                  onChange={(v) => {
                    if (v === 'auto') {
                      form.setFieldsValue({ expert_ids: undefined });
                    }
                  }}
                >
                  <Option value="manual">手动选择</Option>
                  <Option value="auto">自动随机抽取</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="deadline"
                label="评审截止时间"
                tooltip="可选，不设置则不限制"
              >
                <DatePicker style={{ width: '100%' }} showTime />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="field" label="抽取领域（自动抽取用）">
                <Select allowClear placeholder="仅自动抽取时生效">
                  {fields.map(f => <Option key={f} value={f}>{f}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="expert_count"
                label="抽取专家数量"
                tooltip="仅自动抽取时生效"
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} placeholder="输入抽取数量" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">选择申报项目</Divider>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Transfer
              dataSource={availableDeclarations.map(d => ({
                key: String(d.id),
                title: d.title,
                description: `${d.company} - ${d.applicant}`
              }))}
              titles={['待选申报', '已选申报']}
              targetKeys={selectedDeclarations.map(String)}
              onChange={(next) => setSelectedDeclarations(next.map(Number))}
              render={(item: any) => ({
                label: (
                  <Space>
                    <Text strong>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
                  </Space>
                ),
                value: String(item.key)
              })}
              listStyle={{ width: '100%', height: 240 }}
              showSearch
              filterOption={(input, item: any) =>
                item.title?.toLowerCase().includes(input.toLowerCase()) ||
                item.description?.toLowerCase().includes(input.toLowerCase())
              }
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                已选择 <Text strong>{selectedDeclarations.length}</Text> 个申报项目
              </Text>
            </div>
          </Card>

          <Divider orientation="left">选择评审专家</Divider>
          <Card size="small">
            <Transfer
              dataSource={experts
                .filter(e => e.status === 'active')
                .map(e => ({
                  key: String(e.id),
                  title: e.name,
                  description: `${e.field || ''} - ${e.organization || ''}`
                }))}
              titles={['待选专家', '已选专家']}
              targetKeys={selectedExperts.map(String)}
              onChange={(next) => setSelectedExperts(next.map(Number))}
              render={(item: any) => ({
                label: (
                  <Space>
                    <Text strong>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
                  </Space>
                ),
                value: String(item.key)
              })}
              listStyle={{ width: '100%', height: 240 }}
              showSearch
              filterOption={(input, item: any) =>
                item.title?.toLowerCase().includes(input.toLowerCase()) ||
                item.description?.toLowerCase().includes(input.toLowerCase())
              }
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                已选择 <Text strong>{selectedExperts.length}</Text> 位专家，
                将生成 <Text strong style={{ color: '#1890ff' }}>
                  {selectedDeclarations.length * selectedExperts.length}
                </Text> 个评审任务
              </Text>
            </div>
          </Card>
        </Form>
      </Modal>

      <Modal
        title={detailGroup?.name || '分组详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={960}
        destroyOnClose
        footer={[
          detailGroup?.status === 'pending' && (
            <Button key="start" type="primary" icon={<PlayCircleOutlined />}
              onClick={() => detailGroup && handleUpdateStatus(detailGroup, 'in_progress')}>
              启动评审
            </Button>
          ),
          detailGroup?.status === 'in_progress' && (
            <Button key="complete" type="primary" icon={<CheckCircleOutlined />}
              onClick={() => detailGroup && handleUpdateStatus(detailGroup, 'completed')}>
              完成评审
            </Button>
          ),
          <Button key="addDecl" icon={<FileAddOutlined />}
            onClick={() => detailGroup && openAddDeclarations(detailGroup)}>
            添加申报
          </Button>,
          <Button key="addExpert" icon={<UserAddOutlined />}
            onClick={() => detailGroup && openAddExperts(detailGroup)}>
            添加专家
          </Button>,
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>
        ]}
      >
        {detailGroup && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="分组名称" span={1}>
                <Text strong>{detailGroup.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={GroupStatusColorMap[detailGroup.status as keyof typeof GroupStatusColorMap]}>
                  {GroupStatusMap[detailGroup.status as keyof typeof GroupStatusMap]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联指南" span={1}>
                {detailGroup.guideline_title || <Text type="secondary">-</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(detailGroup.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="分组说明" span={2}>
                {detailGroup.description || <Text type="secondary">-</Text>}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16}>
              <Col xs={12} sm={8}>
                <Statistic title="申报项目" value={detailGroup.declaration_ids?.length || 0} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="评审专家" value={detailGroup.expert_ids?.length || 0} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic
                  title="完成进度"
                  value={`${detailGroup.submitted_tasks || 0}/${detailGroup.total_tasks || 0}`}
                />
              </Col>
            </Row>

            <Tabs
              items={[
                {
                  key: 'declarations',
                  label: `申报项目 (${detailGroup.declarations?.length || 0})`,
                  children: (
                    <List
                      dataSource={detailGroup.declarations || []}
                      locale={{ emptyText: '暂无申报项目' }}
                      renderItem={(item: any) => (
                        <List.Item
                          actions={[
                            <Tag key="s" color="blue">{item.status}</Tag>
                          ]}
                        >
                          <List.Item.Meta
                            title={item.title}
                            description={`${item.company} - ${item.applicant} | ${item.guideline_title || ''}`}
                          />
                        </List.Item>
                      )}
                    />
                  )
                },
                {
                  key: 'experts',
                  label: `评审专家 (${detailGroup.experts?.length || 0})`,
                  children: (
                    <List
                      grid={{ gutter: 12, xs: 1, sm: 2, md: 2 }}
                      dataSource={detailGroup.experts || []}
                      locale={{ emptyText: '暂无专家' }}
                      renderItem={(e: any) => (
                        <List.Item>
                          <Card size="small">
                            <Space>
                              <TeamOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                              <div>
                                <Text strong>{e.name}</Text>
                                <div style={{ fontSize: 12 }}>
                                  <Tag color="purple">{e.field || ''}</Tag>
                                  <Tag color={ExpertLevelColorMap[e.level as keyof typeof ExpertLevelColorMap]}>
                                    {ExpertLevelMap[e.level as keyof typeof ExpertLevelMap]}
                                  </Tag>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {e.organization} | {e.title || ''}
                                </Text>
                              </div>
                            </Space>
                          </Card>
                        </List.Item>
                      )}
                    />
                  )
                },
                {
                  key: 'tasks',
                  label: `评审任务 (${detailGroup.tasks?.length || 0})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={detailGroup.tasks || []}
                      pagination={false}
                      columns={[
                        { title: '申报项目', dataIndex: 'declaration_title' },
                        { title: '评审专家', dataIndex: 'expert_name' },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 100,
                          render: (v) => <Tag>{v}</Tag>
                        },
                        {
                          title: '得分',
                          dataIndex: 'total_score',
                          width: 100,
                          render: (v) => v !== null ? (
                            <Text strong style={{ color: '#52c41a' }}>{v.toFixed(2)}</Text>
                          ) : <Text type="secondary">-</Text>
                        },
                        {
                          title: '提交时间',
                          dataIndex: 'submitted_at',
                          width: 160,
                          render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
                        }
                      ]}
                    />
                  )
                }
              ]}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title={currentGroup ? `添加申报到 [${currentGroup.name}]` : '添加申报'}
        open={addDeclOpen}
        onOk={submitAddDeclarations}
        onCancel={() => setAddDeclOpen(false)}
        okText="添加"
        width={720}
        destroyOnClose
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message={`已在分组内: ${existingDeclSet.size} 个，选择要新增的申报项目`}
        />
        <Transfer
          dataSource={availableDeclarations
            .filter(d => !existingDeclSet.has(d.id))
            .map(d => ({
              key: String(d.id),
              title: d.title,
              description: `${d.company} - ${d.applicant} [${d.status}]`
            }))}
          titles={['待选申报', '已选申报']}
          targetKeys={selectedDeclarations.map(String)}
          onChange={(next) => setSelectedDeclarations(next.map(Number))}
          render={(item: any) => ({
            label: <Space>
              <Text strong>{item.title}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
            </Space>,
            value: String(item.key)
          })}
          listStyle={{ width: '100%', height: 300 }}
          showSearch
          filterOption={(input, item: any) =>
            item.title?.toLowerCase().includes(input.toLowerCase()) ||
            item.description?.toLowerCase().includes(input.toLowerCase())
          }
        />
      </Modal>

      <Modal
        title={currentGroup ? `添加专家到 [${currentGroup.name}]` : '添加专家'}
        open={addExpertOpen}
        onOk={submitAddExperts}
        onCancel={() => setAddExpertOpen(false)}
        okText="添加"
        width={720}
        destroyOnClose
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message={`已在分组内: ${existingExpertSet.size} 位，选择要新增的专家`}
        />
        <Transfer
          dataSource={experts
            .filter(e => e.status === 'active' && !existingExpertSet.has(e.id))
            .map(e => ({
              key: String(e.id),
              title: e.name,
              description: `${e.field || ''} - ${e.organization || ''} [${ExpertLevelMap[e.level as keyof typeof ExpertLevelMap]}]`
            }))}
          titles={['待选专家', '已选专家']}
          targetKeys={selectedExperts.map(String)}
          onChange={(next) => setSelectedExperts(next.map(Number))}
          render={(item: any) => ({
            label: <Space>
              <Text strong>{item.title}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
            </Space>,
            value: String(item.key)
          })}
          listStyle={{ width: '100%', height: 300 }}
          showSearch
          filterOption={(input, item: any) =>
            item.title?.toLowerCase().includes(input.toLowerCase()) ||
            item.description?.toLowerCase().includes(input.toLowerCase())
          }
        />
      </Modal>
    </div>
  );
};

export default ReviewGroupDispatch;
