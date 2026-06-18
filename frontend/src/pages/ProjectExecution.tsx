import { useState, useEffect } from 'react';
import {
  Card,
  Progress,
  Row,
  Col,
  Statistic,
  Steps,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Upload,
  Table,
  Tag,
  Space,
  Tooltip,
  Divider,
  message,
  Popconfirm,
  Descriptions,
  List,
  Timeline,
  Badge,
  Collapse,
  Rate
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  EyeOutlined,
  MessageOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import projectExecutionApi from '../api/project-execution';
import type {
  ProjectPhaseInstance,
  PhaseDeliverable,
  AcceptanceNode,
  AcceptanceRecord,
  ProjectProgressLog,
  ProjectExecutionSummary,
  PhaseStatus,
  AcceptanceNodeStatus,
  AcceptanceResult
} from '../types';
import {
  PhaseStatusMap,
  PhaseStatusColorMap,
  AcceptanceStatusMap,
  AcceptanceStatusColorMap,
  AcceptanceResultMap,
  StatusMap
} from '../types';

const { Step } = Steps;
const { TextArea } = Input;
const { Panel } = Collapse;

interface ProjectExecutionProps {
  declarationId: number;
  declarationTitle?: string;
  declarationStatus?: string;
}

type TabKey = 'overview' | 'phases' | 'deliverables' | 'acceptance' | 'progress';

export default function ProjectExecution({
  declarationId,
  declarationTitle,
  declarationStatus
}: ProjectExecutionProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ProjectExecutionSummary | null>(null);
  const [phases, setPhases] = useState<ProjectPhaseInstance[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [progressLogs, setProgressLogs] = useState<ProjectProgressLog[]>([]);
  const [acceptanceNodes, setAcceptanceNodes] = useState<AcceptanceNode[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedPhaseId, setExpandedPhaseId] = useState<number | null>(null);
  const [phaseDeliverables, setPhaseDeliverables] = useState<Record<number, PhaseDeliverable[]>>({});
  const [deliverablesLoading, setDeliverablesLoading] = useState<Record<number, boolean>>({});

  const [phaseModalVisible, setPhaseModalVisible] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ProjectPhaseInstance | null>(null);
  const [phaseForm] = Form.useForm();

  const [deliverableModalVisible, setDeliverableModalVisible] = useState(false);
  const [currentPhaseForDeliverable, setCurrentPhaseForDeliverable] = useState<number | null>(null);
  const [deliverableForm] = Form.useForm();

  const [acceptanceModalVisible, setAcceptanceModalVisible] = useState(false);
  const [editingAcceptanceNode, setEditingAcceptanceNode] = useState<AcceptanceNode | null>(null);
  const [acceptanceForm] = Form.useForm();

  const [acceptanceRecordModalVisible, setAcceptanceRecordModalVisible] = useState(false);
  const [currentAcceptanceNode, setCurrentAcceptanceNode] = useState<AcceptanceNode | null>(null);
  const [acceptanceRecordForm] = Form.useForm();

  const canManage = declarationStatus === 'approved' || declarationStatus === 'completed';

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSummary(),
        loadPhases(),
        loadProgressLogs(),
        loadAcceptanceNodes()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    const res = await projectExecutionApi.getSummary(declarationId);
    if (res.success) {
      setSummary(res.data);
    }
  };

  const loadPhases = async () => {
    const res = await projectExecutionApi.getPhases(declarationId);
    if (res.success) {
      setPhases(res.data.phases);
      setOverallProgress(res.data.overall_progress);
    }
  };

  const loadProgressLogs = async () => {
    const res = await projectExecutionApi.getProgressLogs(declarationId);
    if (res.success) {
      setProgressLogs(res.data);
    }
  };

  const loadAcceptanceNodes = async () => {
    const res = await projectExecutionApi.getAcceptanceNodes(declarationId);
    if (res.success) {
      setAcceptanceNodes(res.data);
    }
  };

  const loadPhaseDeliverables = async (phaseId: number) => {
    if (phaseDeliverables[phaseId]) return;
    setDeliverablesLoading(prev => ({ ...prev, [phaseId]: true }));
    try {
      const res = await projectExecutionApi.getDeliverables(phaseId);
      if (res.success) {
        setPhaseDeliverables(prev => ({ ...prev, [phaseId]: res.data }));
      }
    } finally {
      setDeliverablesLoading(prev => ({ ...prev, [phaseId]: false }));
    }
  };

  useEffect(() => {
    if (declarationId) {
      loadAllData();
    }
  }, [declarationId]);

  useEffect(() => {
    if (expandedPhaseId) {
      loadPhaseDeliverables(expandedPhaseId);
    }
  }, [expandedPhaseId]);

  const handleUpdatePhase = async (values: any) => {
    if (!editingPhase) return;
    try {
      const data: any = { ...values };
      if (values.start_date) data.start_date = values.start_date.format('YYYY-MM-DD');
      if (values.planned_end_date) data.planned_end_date = values.planned_end_date.format('YYYY-MM-DD');
      if (values.actual_end_date) data.actual_end_date = values.actual_end_date.format('YYYY-MM-DD');

      const res = await projectExecutionApi.updatePhase(editingPhase.id, data);
      if (res.success) {
        message.success('阶段更新成功');
        setPhaseModalVisible(false);
        phaseForm.resetFields();
        setEditingPhase(null);
        await Promise.all([loadPhases(), loadSummary()]);
      }
    } catch (e: any) {
      message.error(e.message || '更新失败');
    }
  };

  const openEditPhase = (phase: ProjectPhaseInstance) => {
    setEditingPhase(phase);
    phaseForm.setFieldsValue({
      status: phase.status,
      progress: phase.progress,
      start_date: phase.start_date ? dayjs(phase.start_date) : undefined,
      planned_end_date: phase.planned_end_date ? dayjs(phase.planned_end_date) : undefined,
      actual_end_date: phase.actual_end_date ? dayjs(phase.actual_end_date) : undefined,
      responsible_person: phase.responsible_person || '',
      remarks: phase.remarks || '',
      update_note: ''
    });
    setPhaseModalVisible(true);
  };

  const handleAddDeliverable = async (values: any) => {
    if (!currentPhaseForDeliverable) return;
    try {
      const res = await projectExecutionApi.addDeliverable(currentPhaseForDeliverable, values);
      if (res.success) {
        message.success('成果物添加成功');
        setDeliverableModalVisible(false);
        deliverableForm.resetFields();
        setCurrentPhaseForDeliverable(null);
        if (expandedPhaseId === currentPhaseForDeliverable) {
          await loadPhaseDeliverables(currentPhaseForDeliverable);
          setPhaseDeliverables(prev => ({ ...prev, [currentPhaseForDeliverable]: [] }));
          delete phaseDeliverables[currentPhaseForDeliverable];
          await loadPhaseDeliverables(currentPhaseForDeliverable);
        }
        await loadSummary();
      }
    } catch (e: any) {
      message.error(e.message || '添加失败');
    }
  };

  const handleDeleteDeliverable = async (deliverableId: number, phaseId: number) => {
    try {
      const res = await projectExecutionApi.deleteDeliverable(deliverableId);
      if (res.success) {
        message.success('删除成功');
        setPhaseDeliverables(prev => ({ ...prev, [phaseId]: [] }));
        delete phaseDeliverables[phaseId];
        await loadPhaseDeliverables(phaseId);
        await loadSummary();
      }
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number, deliverableId: number, phaseId: number) => {
    try {
      const res = await projectExecutionApi.deleteAttachment(attachmentId);
      if (res.success) {
        message.success('附件删除成功');
        setPhaseDeliverables(prev => ({ ...prev, [phaseId]: [] }));
        delete phaseDeliverables[phaseId];
        await loadPhaseDeliverables(phaseId);
      }
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const uploadProps = (deliverableId: number, phaseId: number): UploadProps => ({
    multiple: true,
    customRequest: async (options: any) => {
      try {
        const res = await projectExecutionApi.uploadDeliverableAttachments(
          deliverableId,
          [options.file],
          ''
        );
        if (res.success) {
          message.success(`上传成功: ${options.file.name}`);
          options.onSuccess(res.data);
          setPhaseDeliverables(prev => ({ ...prev, [phaseId]: [] }));
          delete phaseDeliverables[phaseId];
          await loadPhaseDeliverables(phaseId);
          await loadSummary();
        } else {
          options.onError(new Error(res.message));
        }
      } catch (e: any) {
        message.error(e.message || '上传失败');
        options.onError(e);
      }
    }
  });

  const handleAddAcceptanceNode = async (values: any) => {
    try {
      const data: any = { ...values };
      if (values.planned_date) data.planned_date = values.planned_date.format('YYYY-MM-DD');

      const res = editingAcceptanceNode
        ? await projectExecutionApi.updateAcceptanceNode(editingAcceptanceNode.id, data)
        : await projectExecutionApi.addAcceptanceNode(declarationId, data);

      if (res.success) {
        message.success(editingAcceptanceNode ? '更新成功' : '添加成功');
        setAcceptanceModalVisible(false);
        acceptanceForm.resetFields();
        setEditingAcceptanceNode(null);
        await loadAcceptanceNodes();
        await loadSummary();
      }
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const openEditAcceptanceNode = (node: AcceptanceNode) => {
    setEditingAcceptanceNode(node);
    acceptanceForm.setFieldsValue({
      phase_instance_id: node.phase_instance_id || undefined,
      node_name: node.node_name,
      node_type: node.node_type,
      description: node.description || '',
      planned_date: node.planned_date ? dayjs(node.planned_date) : undefined,
      acceptance_criteria: node.acceptance_criteria || ''
    });
    setAcceptanceModalVisible(true);
  };

  const handleSubmitAcceptanceRecord = async (values: any) => {
    if (!currentAcceptanceNode) return;
    try {
      const res = await projectExecutionApi.submitAcceptanceRecord(currentAcceptanceNode.id, values);
      if (res.success) {
        message.success('验收记录提交成功');
        setAcceptanceRecordModalVisible(false);
        acceptanceRecordForm.resetFields();
        setCurrentAcceptanceNode(null);
        await Promise.all([loadAcceptanceNodes(), loadPhases(), loadSummary()]);
      }
    } catch (e: any) {
      message.error(e.message || '提交失败');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const currentStepIndex = phases.findIndex(p => p.status === 'in_progress');
  const firstPendingIndex = phases.findIndex(p => p.status === 'pending');
  const stepsCurrent = currentStepIndex >= 0 ? currentStepIndex : (firstPendingIndex >= 0 ? firstPendingIndex : phases.length);

  const deliverablesColumns = [
    {
      title: '成果物名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PhaseDeliverable) => (
        <Space>
          <FileTextOutlined />
          <span>{text}</span>
          {record.required ? <Tag color="red" style={{ marginLeft: 8 }}>必需</Tag> : <Tag>可选</Tag>}
        </Space>
      )
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '上传状态',
      key: 'status',
      render: (_: any, record: PhaseDeliverable) => {
        const count = record.attachment_count || 0;
        if (count > 0) {
          return <Tag color="green">已上传 ({count})</Tag>;
        }
        if (record.required) {
          return <Tag color="orange">待上传</Tag>;
        }
        return <Tag>未上传</Tag>;
      }
    },
    {
      title: '最后上传',
      dataIndex: 'last_uploaded_at',
      key: 'last_uploaded_at',
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PhaseDeliverable) => (
        <Space>
          <Upload {...uploadProps(record.id, record.phase_instance_id)} showUploadList={false}>
            <Button type="link" size="small" icon={<UploadOutlined />} disabled={!canManage}>
              上传
            </Button>
          </Upload>
          <Popconfirm
            title="确认删除此成果物？"
            onConfirm={() => handleDeleteDeliverable(record.id, record.phase_instance_id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const acceptanceColumns = [
    {
      title: '验收节点',
      dataIndex: 'node_name',
      key: 'node_name',
      render: (text: string, record: AcceptanceNode) => (
        <Space>
          <CheckCircleOutlined />
          <span>{text}</span>
          {record.node_type === 'final' && <Tag color="purple">最终验收</Tag>}
          {record.node_type === 'phase' && <Tag color="blue">阶段验收</Tag>}
          {record.node_type === 'custom' && <Tag>自定义</Tag>}
        </Space>
      )
    },
    {
      title: '关联阶段',
      dataIndex: 'phase_name',
      key: 'phase_name',
      render: (text: string | null) => text || '-'
    },
    {
      title: '计划日期',
      dataIndex: 'planned_date',
      key: 'planned_date',
      render: (date: string | null) => date || '-'
    },
    {
      title: '实际日期',
      dataIndex: 'actual_date',
      key: 'actual_date',
      render: (date: string | null) => date || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: AcceptanceNodeStatus) => (
        <Tag color={AcceptanceStatusColorMap[status]}>
          {AcceptanceStatusMap[status]}
        </Tag>
      )
    },
    {
      title: '上次结果',
      dataIndex: 'last_result',
      key: 'last_result',
      render: (result: string | null) => result ? AcceptanceResultMap[result as AcceptanceResult] || result : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AcceptanceNode) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditAcceptanceNode(record)}
            disabled={!canManage}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setCurrentAcceptanceNode(record);
              acceptanceRecordForm.resetFields();
              setAcceptanceRecordModalVisible(true);
            }}
            disabled={!canManage}
          >
            验收
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      {declarationTitle && (
        <Card style={{ marginBottom: 16 }} loading={loading && !summary}>
          <Row gutter={24}>
            <Col xs={24} md={6}>
              <Statistic
                title="项目名称"
                value={declarationTitle}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col xs={24} md={6}>
              <Statistic
                title="申报状态"
                value={StatusMap[declarationStatus || ''] || declarationStatus}
                prefix={<Badge status={declarationStatus === 'approved' ? 'success' : 'processing'} />}
              />
            </Col>
            <Col xs={24} md={6}>
              <Statistic
                title="总体执行进度"
                value={overallProgress}
                suffix="%"
                prefix={<Progress type="circle" size={24} percent={overallProgress} />}
              />
            </Col>
            <Col xs={24} md={6}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>执行进度条</div>
                <Progress percent={overallProgress} status={overallProgress === 100 ? 'success' : 'active'} />
              </Space>
            </Col>
          </Row>

          {summary && (
            <>
              <Divider orientation="left" orientationMargin={0}>统计概览</Divider>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Statistic
                      title="项目阶段"
                      value={`${summary.phase_stats.completed_phases}/${summary.phase_stats.total_phases}`}
                      prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                    />
                    <Progress
                      percent={summary.phase_stats.total_phases ? Math.round((summary.phase_stats.completed_phases / summary.phase_stats.total_phases) * 100) : 0}
                      size="small"
                      style={{ marginTop: 8 }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Statistic
                      title="成果物提交"
                      value={`${summary.deliverable_stats.submitted_deliverables}/${summary.deliverable_stats.total_deliverables}`}
                      prefix={<FileTextOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ color: summary.deliverable_stats.missing_required > 0 ? '#fa8c16' : undefined }}
                    />
                    <Progress
                      percent={summary.deliverable_stats.total_deliverables ? Math.round((summary.deliverable_stats.submitted_deliverables / summary.deliverable_stats.total_deliverables) * 100) : 0}
                      size="small"
                      style={{ marginTop: 8 }}
                      status={summary.deliverable_stats.missing_required > 0 ? 'exception' : undefined}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Statistic
                      title="验收节点"
                      value={`${summary.acceptance_stats.passed_nodes}/${summary.acceptance_stats.total_nodes}`}
                      prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
                    />
                    <Progress
                      percent={summary.acceptance_stats.total_nodes ? Math.round((summary.acceptance_stats.passed_nodes / summary.acceptance_stats.total_nodes) * 100) : 0}
                      size="small"
                      style={{ marginTop: 8 }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small">
                    <Statistic
                      title="延期阶段"
                      value={summary.phase_stats.delayed_phases}
                      prefix={<ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
                      valueStyle={{ color: summary.phase_stats.delayed_phases > 0 ? '#fa8c16' : undefined }}
                    />
                    {summary.phase_stats.in_progress_phases > 0 && (
                      <Tag color="blue" style={{ marginTop: 8 }}>
                        <TeamOutlined /> 进行中: {summary.phase_stats.in_progress_phases} 个阶段
                      </Tag>
                    )}
                  </Card>
                </Col>
              </Row>
            </>
          )}

          {!canManage && (
            <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', borderRadius: 4, border: '1px solid #ffe58f' }}>
              <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
              <span>项目尚未立项，当前仅可查看。项目在"已立项"状态后方可进行执行管理。</span>
            </div>
          )}
        </Card>
      )}

      <Card
        tabList={[
          { key: 'overview', tab: '进度总览' },
          { key: 'phases', tab: '阶段管理' },
          { key: 'deliverables', tab: '阶段成果' },
          { key: 'acceptance', tab: '验收节点' },
          { key: 'progress', tab: '进度日志' }
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as TabKey)}
        loading={loading}
      >
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ marginBottom: 24 }}>项目阶段进度</h3>
            {phases.length > 0 ? (
              <Steps
                direction="vertical"
                current={stepsCurrent}
                status={overallProgress === 100 ? 'finish' : undefined}
                style={{ maxWidth: 800 }}
              >
                {phases.map((phase, idx) => (
                  <Step
                    key={phase.id}
                    title={
                      <Space>
                        <span style={{ fontWeight: 600 }}>{phase.phase_name}</span>
                        <Tag color={PhaseStatusColorMap[phase.status] as any}>
                          {PhaseStatusMap[phase.status]}
                        </Tag>
                        <span style={{ color: '#888', fontSize: 12 }}>
                          进度: {phase.progress}%
                        </span>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        <p style={{ margin: '0 0 8px 0', color: '#666' }}>
                          {phase.phase_description}
                        </p>
                        <Row gutter={16} style={{ marginBottom: 8 }}>
                          <Col span={8}>
                            <small style={{ color: '#999' }}>负责人:</small>{' '}
                            <span>{phase.responsible_person || '-'}</span>
                          </Col>
                          <Col span={8}>
                            <small style={{ color: '#999' }}>开始:</small>{' '}
                            <span>{phase.start_date || '-'}</span>
                          </Col>
                          <Col span={8}>
                            <small style={{ color: '#999' }}>计划完成:</small>{' '}
                            <span>{phase.planned_end_date || '-'}</span>
                          </Col>
                        </Row>
                        <Progress percent={phase.progress} size="small" />
                        <Space style={{ marginTop: 12 }}>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditPhase(phase)}
                            disabled={!canManage}
                          >
                            编辑进度
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={() => {
                              setExpandedPhaseId(phase.id);
                              setActiveTab('phases');
                            }}
                          >
                            查看详情
                          </Button>
                        </Space>
                      </div>
                    }
                    icon={
                      phase.status === 'completed' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                      ) : phase.status === 'in_progress' ? (
                        <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 24 }} />
                      ) : phase.status === 'delayed' ? (
                        <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: 24 }} />
                      ) : undefined
                    }
                  />
                ))}
              </Steps>
            ) : (
              <EmptyState />
            )}

            {acceptanceNodes.length > 0 && (
              <>
                <Divider />
                <h3 style={{ marginBottom: 24 }}>验收进度</h3>
                <Row gutter={[16, 16]}>
                  {acceptanceNodes.map(node => (
                    <Col xs={24} sm={12} md={8} key={node.id}>
                      <Card
                        size="small"
                        style={{
                          borderLeft: `4px solid ${
                            node.status === 'passed' ? '#52c41a' :
                            node.status === 'failed' ? '#f5222d' :
                            node.status === 'conditional' ? '#fa8c16' : '#d9d9d9'
                          }`
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                          {node.node_name}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color={AcceptanceStatusColorMap[node.status] as any}>
                            {AcceptanceStatusMap[node.status]}
                          </Tag>
                        </div>
                        {node.last_result && (
                          <div style={{ fontSize: 12, color: '#666' }}>
                            上次: {AcceptanceResultMap[node.last_result as AcceptanceResult] || node.last_result}
                            {node.last_accepted_at && ` · ${dayjs(node.last_accepted_at).format('MM-DD')}`}
                          </div>
                        )}
                        {node.planned_date && (
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            计划: {node.planned_date}
                          </div>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </div>
        )}

        {activeTab === 'phases' && (
          <div>
            {phases.length > 0 ? (
              <Collapse
                activeKey={expandedPhaseId ? [String(expandedPhaseId)] : []}
                onChange={(keys) => setExpandedPhaseId(keys.length > 0 ? Number(keys[0]) : null)}
              >
                {phases.map(phase => (
                  <Panel
                    key={phase.id}
                    header={
                      <Space>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{phase.phase_name}</span>
                        <Tag color={PhaseStatusColorMap[phase.status] as any}>
                          {PhaseStatusMap[phase.status]}
                        </Tag>
                        <span style={{ color: '#888' }}>
                          <ClockCircleOutlined /> {phase.expected_duration}天 · 进度 {phase.progress}%
                        </span>
                        {phase.deliverable_count !== undefined && phase.deliverable_count > 0 && (
                          <span style={{ color: '#888' }}>
                            <FileTextOutlined /> 成果物 {phase.submitted_deliverable_count || 0}/{phase.deliverable_count}
                          </span>
                        )}
                        {phase.acceptance_count !== undefined && phase.acceptance_count > 0 && (
                          <span style={{ color: '#888' }}>
                            <CheckCircleOutlined /> 验收 {phase.passed_acceptance_count || 0}/{phase.acceptance_count}
                          </span>
                        )}
                      </Space>
                    }
                    extra={
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditPhase(phase);
                        }}
                        disabled={!canManage}
                      >
                        编辑
                      </Button>
                    }
                  >
                    <Row gutter={[24, 16]}>
                      <Col xs={24} md={12}>
                        <Descriptions column={1} size="small" bordered title="阶段信息">
                          <Descriptions.Item label="阶段说明">{phase.phase_description || '-'}</Descriptions.Item>
                          <Descriptions.Item label="负责人">{phase.responsible_person || '-'}</Descriptions.Item>
                          <Descriptions.Item label="计划工期">{phase.expected_duration} 天</Descriptions.Item>
                          <Descriptions.Item label="开始日期">{phase.start_date || '-'}</Descriptions.Item>
                          <Descriptions.Item label="计划完成">{phase.planned_end_date || '-'}</Descriptions.Item>
                          <Descriptions.Item label="实际完成">{phase.actual_end_date || '-'}</Descriptions.Item>
                          <Descriptions.Item label="备注">{phase.remarks || '-'}</Descriptions.Item>
                        </Descriptions>
                      </Col>
                      <Col xs={24} md={12}>
                        <Card size="small" title="阶段进度" style={{ marginBottom: 16 }}>
                          <Progress
                            percent={phase.progress}
                            status={
                              phase.status === 'completed' ? 'success' :
                              phase.status === 'delayed' ? 'exception' : 'active'
                            }
                          />
                          <div style={{ marginTop: 16 }}>
                            <Space>
                              <Button
                                type="primary"
                                size="small"
                                icon={<PlayCircleOutlined />}
                                onClick={() => {
                                  projectExecutionApi.updatePhase(phase.id, {
                                    status: phase.status === 'pending' ? 'in_progress' : phase.status,
                                    start_date: phase.start_date || dayjs().format('YYYY-MM-DD')
                                  }).then(() => {
                                    message.success('阶段已启动');
                                    loadPhases();
                                    loadSummary();
                                  });
                                }}
                                disabled={!canManage || phase.status !== 'pending'}
                              >
                                启动阶段
                              </Button>
                              <Button
                                size="small"
                                icon={<SaveOutlined />}
                                onClick={() => openEditPhase(phase)}
                                disabled={!canManage}
                              >
                                更新进度
                              </Button>
                              <Button
                                type={phase.status !== 'completed' ? 'default' : 'primary'}
                                ghost
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => {
                                  projectExecutionApi.updatePhase(phase.id, {
                                    status: 'completed',
                                    progress: 100,
                                    actual_end_date: dayjs().format('YYYY-MM-DD')
                                  }).then(() => {
                                    message.success('阶段已标记完成');
                                    loadPhases();
                                    loadSummary();
                                  });
                                }}
                                disabled={!canManage}
                              >
                                标记完成
                              </Button>
                            </Space>
                          </div>
                        </Card>

                        <Card
                          size="small"
                          title={
                            <Space>
                              <span>阶段成果物</span>
                              <Button
                                type="text"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                  setCurrentPhaseForDeliverable(phase.id);
                                  deliverableForm.resetFields();
                                  setDeliverableModalVisible(true);
                                }}
                                disabled={!canManage}
                              >
                                添加成果物
                              </Button>
                            </Space>
                          }
                        >
                          {loadPhaseDeliverables(phase.id) || null}
                          <Table
                            size="small"
                            columns={deliverablesColumns}
                            dataSource={phaseDeliverables[phase.id] || []}
                            loading={deliverablesLoading[phase.id]}
                            rowKey="id"
                            pagination={false}
                            expandable={{
                              expandedRowRender: (record) => (
                                <div>
                                  {record.attachments && record.attachments.length > 0 ? (
                                    <List
                                      size="small"
                                      dataSource={record.attachments}
                                      renderItem={(att) => (
                                        <List.Item
                                          key={att.id}
                                          actions={[
                                            <a
                                              key="download"
                                              href={projectExecutionApi.downloadAttachment(att.id)}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              <DownloadOutlined /> 下载
                                            </a>,
                                            canManage ? (
                                              <Popconfirm
                                                key="delete"
                                                title="删除此附件？"
                                                onConfirm={() => handleDeleteAttachment(att.id, record.id, phase.id)}
                                              >
                                                <a style={{ color: '#ff4d4f' }}>
                                                  <DeleteOutlined /> 删除
                                                </a>
                                              </Popconfirm>
                                            ) : null
                                          ]}
                                        >
                                          <List.Item.Meta
                                            avatar={<FileTextOutlined style={{ fontSize: 20 }} />}
                                            title={
                                              <Space>
                                                <span>{att.original_name}</span>
                                                <Tag color="blue">v{att.version}</Tag>
                                                {att.remark && <Tag>{att.remark}</Tag>}
                                              </Space>
                                            }
                                            description={
                                              <Space split="|">
                                                <span>{formatFileSize(att.file_size)}</span>
                                                <span>{att.uploaded_by || 'unknown'}</span>
                                                <span>{dayjs(att.uploaded_at).format('YYYY-MM-DD HH:mm')}</span>
                                              </Space>
                                            }
                                          />
                                        </List.Item>
                                      )}
                                    />
                                  ) : (
                                    <div style={{ color: '#999', padding: 8 }}>暂无附件，点击上方"上传"按钮添加</div>
                                  )}
                                </div>
                              ),
                              rowExpandable: (record) => (record.attachment_count || 0) > 0
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Panel>
                ))}
              </Collapse>
            ) : (
              <EmptyState />
            )}
          </div>
        )}

        {activeTab === 'deliverables' && (
          <div>
            <Collapse defaultActiveKey={phases.length > 0 ? [String(phases[0].id)] : []}>
              {phases.map(phase => (
                <Panel
                  key={phase.id}
                  header={
                    <Space>
                      <span style={{ fontWeight: 600 }}>{phase.phase_name}</span>
                      <Tag color={PhaseStatusColorMap[phase.status] as any}>{PhaseStatusMap[phase.status]}</Tag>
                    </Space>
                  }
                  extra={
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhaseForDeliverable(phase.id);
                        deliverableForm.resetFields();
                        setDeliverableModalVisible(true);
                      }}
                      disabled={!canManage}
                    >
                      添加成果物
                    </Button>
                  }
                >
                  {loadPhaseDeliverables(phase.id) || null}
                  <Table
                    columns={deliverablesColumns}
                    dataSource={phaseDeliverables[phase.id] || []}
                    loading={deliverablesLoading[phase.id]}
                    rowKey="id"
                    pagination={false}
                    expandable={{
                      expandedRowRender: (record) => (
                        <div>
                          {record.attachments && record.attachments.length > 0 ? (
                            <List
                              size="small"
                              dataSource={record.attachments}
                              renderItem={(att) => (
                                <List.Item
                                  key={att.id}
                                  actions={[
                                    <a
                                      key="download"
                                      href={projectExecutionApi.downloadAttachment(att.id)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <DownloadOutlined /> 下载
                                    </a>,
                                    canManage ? (
                                      <Popconfirm
                                        key="delete"
                                        title="删除此附件？"
                                        onConfirm={() => handleDeleteAttachment(att.id, record.id, phase.id)}
                                      >
                                        <a style={{ color: '#ff4d4f' }}>
                                          <DeleteOutlined /> 删除
                                        </a>
                                      </Popconfirm>
                                    ) : null
                                  ]}
                                >
                                  <List.Item.Meta
                                    avatar={<FileTextOutlined style={{ fontSize: 20 }} />}
                                    title={
                                      <Space>
                                        <span>{att.original_name}</span>
                                        <Tag color="blue">v{att.version}</Tag>
                                      </Space>
                                    }
                                    description={
                                      <Space split="|">
                                        <span>{formatFileSize(att.file_size)}</span>
                                        <span>{att.uploaded_by || 'unknown'}</span>
                                        <span>{dayjs(att.uploaded_at).format('YYYY-MM-DD HH:mm')}</span>
                                      </Space>
                                    }
                                  />
                                </List.Item>
                              )}
                            />
                          ) : (
                            <div style={{ color: '#999', padding: 8 }}>暂无附件</div>
                          )}
                        </div>
                      ),
                      rowExpandable: (record) => (record.attachment_count || 0) > 0
                    }}
                  />
                </Panel>
              ))}
            </Collapse>
          </div>
        )}

        {activeTab === 'acceptance' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingAcceptanceNode(null);
                  acceptanceForm.resetFields();
                  acceptanceForm.setFieldsValue({ node_type: 'custom' });
                  setAcceptanceModalVisible(true);
                }}
                disabled={!canManage}
              >
                新增验收节点
              </Button>
            </div>

            <Table
              columns={acceptanceColumns}
              dataSource={acceptanceNodes}
              rowKey="id"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <div>
                    <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
                      <Descriptions.Item label="节点说明">{record.description || '-'}</Descriptions.Item>
                      <Descriptions.Item label="验收标准">{record.acceptance_criteria || '-'}</Descriptions.Item>
                    </Descriptions>
                    {record.records && record.records.length > 0 && (
                      <div>
                        <h4 style={{ marginBottom: 12 }}>验收历史</h4>
                        <Timeline>
                          {record.records.map(r => (
                            <Timeline.Item
                              key={r.id}
                              color={
                                r.result === 'passed' ? 'green' :
                                r.result === 'failed' ? 'red' : 'orange'
                              }
                            >
                              <Card size="small" style={{ marginBottom: 8 }}>
                                <Row gutter={16}>
                                  <Col span={12}>
                                    <Space>
                                      <Tag color={
                                        r.result === 'passed' ? 'green' :
                                        r.result === 'failed' ? 'red' : 'orange'
                                      }>
                                        <strong>{AcceptanceResultMap[r.result]}</strong>
                                      </Tag>
                                      {r.score !== null && (
                                        <Rate disabled allowHalf value={r.score / 20} count={5} />
                                      )}
                                      {r.score !== null && <span>({r.score}分)</span>}
                                    </Space>
                                  </Col>
                                  <Col span={12} style={{ textAlign: 'right', color: '#888' }}>
                                    <MessageOutlined /> {r.accepted_by} · {dayjs(r.accepted_at).format('YYYY-MM-DD HH:mm')}
                                  </Col>
                                </Row>
                                {r.comment && (
                                  <p style={{ marginTop: 8, marginBottom: 8 }}>
                                    <strong>验收意见：</strong>{r.comment}
                                  </p>
                                )}
                                {r.issues_found && (
                                  <p style={{ marginBottom: 8, color: '#cf1322' }}>
                                    <strong>发现问题：</strong>{r.issues_found}
                                  </p>
                                )}
                                {r.suggestions && (
                                  <p style={{ marginBottom: 0, color: '#389e0d' }}>
                                    <strong>改进建议：</strong>{r.suggestions}
                                  </p>
                                )}
                              </Card>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </div>
        )}

        {activeTab === 'progress' && (
          <div>
            {progressLogs.length > 0 ? (
              <Timeline mode="left">
                {progressLogs.map(log => (
                  <Timeline.Item
                    key={log.id}
                    label={dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}
                  >
                    <Card size="small">
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Space>
                            <Progress
                              type="circle"
                              size={40}
                              percent={log.progress_value}
                              format={(p) => `${p}%`}
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {log.phase_instance_id ? '阶段进度更新' : '项目整体进度更新'}
                              </div>
                              <div style={{ color: '#888', fontSize: 12 }}>
                                {log.previous_progress}% → {log.progress_value}%
                              </div>
                            </div>
                          </Space>
                        </Col>
                        <Col style={{ color: '#888' }}>
                          {log.updated_by || 'unknown'}
                        </Col>
                      </Row>
                      {log.update_note && (
                        <p style={{ marginTop: 12, marginBottom: 0 }}>
                          <MessageOutlined /> {log.update_note}
                        </p>
                      )}
                    </Card>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <EmptyState text="暂无进度更新日志" />
            )}
          </div>
        )}
      </Card>

      <Modal
        title={editingPhase ? '编辑项目阶段' : '更新项目阶段'}
        open={phaseModalVisible}
        onCancel={() => {
          setPhaseModalVisible(false);
          phaseForm.resetFields();
          setEditingPhase(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={phaseForm} layout="vertical" onFinish={handleUpdatePhase}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="阶段状态" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="pending">待启动</Select.Option>
                  <Select.Option value="in_progress">进行中</Select.Option>
                  <Select.Option value="completed">已完成</Select.Option>
                  <Select.Option value="delayed">已延期</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="progress" label="进度百分比" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_date" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="planned_end_date" label="计划完成日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actual_end_date" label="实际完成日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="responsible_person" label="负责人">
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="阶段备注说明" />
          </Form.Item>
          <Form.Item name="update_note" label="更新说明（可选）">
            <TextArea rows={2} placeholder="本次进度更新的说明" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setPhaseModalVisible(false);
                phaseForm.resetFields();
                setEditingPhase(null);
              }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加阶段成果物"
        open={deliverableModalVisible}
        onCancel={() => {
          setDeliverableModalVisible(false);
          deliverableForm.resetFields();
          setCurrentPhaseForDeliverable(null);
        }}
        footer={null}
      >
        <Form form={deliverableForm} layout="vertical" onFinish={handleAddDeliverable}>
          <Form.Item name="name" label="成果物名称" rules={[{ required: true, message: '请输入成果物名称' }]}>
            <Input placeholder="如：项目计划书、测试报告等" />
          </Form.Item>
          <Form.Item name="description" label="成果物说明">
            <TextArea rows={3} placeholder="成果物的详细说明和要求" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="required" label="是否必需" initialValue={1}>
                <Select>
                  <Select.Option value={1}>必需提交</Select.Option>
                  <Select.Option value={0}>可选提交</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setDeliverableModalVisible(false);
                deliverableForm.resetFields();
                setCurrentPhaseForDeliverable(null);
              }}>取消</Button>
              <Button type="primary" htmlType="submit">添加</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingAcceptanceNode ? '编辑验收节点' : '新增验收节点'}
        open={acceptanceModalVisible}
        onCancel={() => {
          setAcceptanceModalVisible(false);
          acceptanceForm.resetFields();
          setEditingAcceptanceNode(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={acceptanceForm} layout="vertical" onFinish={handleAddAcceptanceNode}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="node_name" label="验收节点名称" rules={[{ required: true, message: '请输入验收节点名称' }]}>
                <Input placeholder="如：中期检查、最终验收等" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="node_type" label="节点类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="custom">自定义</Select.Option>
                  <Select.Option value="phase">阶段验收</Select.Option>
                  <Select.Option value="final">最终验收</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="phase_instance_id" label="关联阶段（可选）">
            <Select allowClear placeholder="选择关联的项目阶段">
              {phases.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.phase_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="planned_date" label="计划验收日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="节点说明">
            <TextArea rows={2} placeholder="验收节点的说明" />
          </Form.Item>
          <Form.Item name="acceptance_criteria" label="验收标准">
            <TextArea rows={3} placeholder="详细的验收通过标准" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAcceptanceModalVisible(false);
                acceptanceForm.resetFields();
                setEditingAcceptanceNode(null);
              }}>取消</Button>
              <Button type="primary" htmlType="submit">{editingAcceptanceNode ? '保存' : '新增'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          currentAcceptanceNode
            ? `提交验收记录 - ${currentAcceptanceNode.node_name}`
            : '提交验收记录'
        }
        open={acceptanceRecordModalVisible}
        onCancel={() => {
          setAcceptanceRecordModalVisible(false);
          acceptanceRecordForm.resetFields();
          setCurrentAcceptanceNode(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={acceptanceRecordForm} layout="vertical" onFinish={handleSubmitAcceptanceRecord}>
          {currentAcceptanceNode?.acceptance_criteria && (
            <div style={{
              padding: 12,
              background: '#f0f5ff',
              borderRadius: 4,
              marginBottom: 16,
              border: '1px solid #adc6ff'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}><CheckCircleOutlined /> 验收标准：</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{currentAcceptanceNode.acceptance_criteria}</div>
            </div>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="result" label="验收结果" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="passed">通过</Select.Option>
                  <Select.Option value="conditional">有条件通过</Select.Option>
                  <Select.Option value="failed">不通过</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="score" label="评分（0-100）">
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="分" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="comment" label="验收意见">
            <TextArea rows={3} placeholder="详细的验收意见" />
          </Form.Item>
          <Form.Item name="issues_found" label="发现问题">
            <TextArea rows={2} placeholder="验收过程中发现的问题" />
          </Form.Item>
          <Form.Item name="suggestions" label="改进建议">
            <TextArea rows={2} placeholder="针对问题的改进建议" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAcceptanceRecordModalVisible(false);
                acceptanceRecordForm.resetFields();
                setCurrentAcceptanceNode(null);
              }}>取消</Button>
              <Button type="primary" htmlType="submit">提交验收</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function EmptyState({ text = '暂无数据' }: { text?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
      <FileTextOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
      <div>{text}</div>
    </div>
  );
}
