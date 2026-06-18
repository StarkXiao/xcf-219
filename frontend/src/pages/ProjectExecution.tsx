import { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Progress,
  List,
  Tag,
  Button,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Empty,
  Spin,
  Descriptions,
  Timeline,
  Upload,
  Tooltip,
  Badge
} from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  FileTextOutlined,
  AuditOutlined,
  HistoryOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

import {
  getProjectOverview,
  getProjectPhases,
  updatePhase,
  getPhaseDeliverables,
  addPhaseDeliverable,
  updateDeliverable,
  deleteDeliverable,
  uploadDeliverableAttachments,
  getDeliverableAttachments,
  getAttachmentDownloadUrl,
  deleteAttachment,
  getAcceptanceNodes,
  addAcceptanceNode,
  updateAcceptanceNode,
  deleteAcceptanceNode,
  getAcceptanceRecords,
  getProgressLogs
} from '../api/project-execution';

import {
  PhaseStatusMap,
  PhaseStatusColorMap,
  DeliverableStatusMap,
  DeliverableStatusColorMap,
  AcceptanceStatusMap,
  AcceptanceStatusColorMap
} from '../types';

import type {
  ProjectPhaseInstance,
  PhaseDeliverable,
  DeliverableAttachment,
  AcceptanceNode,
  AcceptanceRecord,
  ProgressLog,
  ProjectExecutionOverview,
  PhaseStatus,
  DeliverableStatus,
  AcceptanceStatus
} from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface ProjectExecutionProps {
  declarationId: number;
  declarationTitle?: string;
  declarationStatus?: string;
}

function ProjectExecution({ declarationId }: ProjectExecutionProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [overview, setOverview] = useState<ProjectExecutionOverview | null>(null);
  const [phases, setPhases] = useState<ProjectPhaseInstance[]>([]);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);

  const [phaseModalVisible, setPhaseModalVisible] = useState<boolean>(false);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhaseInstance | null>(null);
  const [phaseForm] = Form.useForm();

  const [deliverableModalVisible, setDeliverableModalVisible] = useState<boolean>(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<PhaseDeliverable | null>(null);
  const [deliverableForm] = Form.useForm();
  const [currentPhaseId, setCurrentPhaseId] = useState<number | null>(null);
  const [phaseDeliverables, setPhaseDeliverables] = useState<PhaseDeliverable[]>([]);
  const [deliverableLoading, setDeliverableLoading] = useState<boolean>(false);

  const [attachmentModalVisible, setAttachmentModalVisible] = useState<boolean>(false);
  const [currentDeliverableId, setCurrentDeliverableId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<DeliverableAttachment[]>([]);
  const [attachmentLoading, setAttachmentLoading] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const [acceptanceModalVisible, setAcceptanceModalVisible] = useState<boolean>(false);
  const [selectedAcceptanceNode, setSelectedAcceptanceNode] = useState<AcceptanceNode | null>(null);
  const [acceptanceForm] = Form.useForm();
  const [phaseAcceptanceNodes, setPhaseAcceptanceNodes] = useState<AcceptanceNode[]>([]);
  const [acceptanceLoading, setAcceptanceLoading] = useState<boolean>(false);

  const [acceptanceRecordModalVisible, setAcceptanceRecordModalVisible] = useState<boolean>(false);
  const [acceptanceRecords, setAcceptanceRecords] = useState<AcceptanceRecord[]>([]);
  const [recordLoading, setRecordLoading] = useState<boolean>(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await getProjectOverview(declarationId);
      if (res.success && res.data) {
        setOverview(res.data);
        setPhases(res.data.phases || []);
      } else {
        message.error(res.message || '加载项目概览失败');
      }
    } catch (error: any) {
      console.error('加载项目概览失败:', error);
      message.error(error.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPhases = async () => {
    try {
      const res = await getProjectPhases(declarationId);
      if (res.success && res.data) {
        setPhases(res.data);
      }
    } catch (error) {
      console.error('加载阶段列表失败:', error);
    }
  };

  const loadProgressLogs = async () => {
    try {
      const res = await getProgressLogs(declarationId);
      if (res.success && res.data) {
        setProgressLogs(res.data);
      }
    } catch (error) {
      console.error('加载进度日志失败:', error);
    }
  };

  useEffect(() => {
    if (declarationId) {
      loadOverview();
      loadProgressLogs();
    }
  }, [declarationId]);

  const handleEditPhase = (phase: ProjectPhaseInstance) => {
    setSelectedPhase(phase);
    phaseForm.setFieldsValue({
      status: phase.status,
      progress: phase.progress,
      start_date: phase.start_date ? dayjs(phase.start_date) : null,
      planned_end_date: phase.planned_end_date ? dayjs(phase.planned_end_date) : null,
      actual_end_date: phase.actual_end_date ? dayjs(phase.actual_end_date) : null,
      responsible_person: phase.responsible_person || '',
      remarks: phase.remarks || '',
      update_note: ''
    });
    setPhaseModalVisible(true);
  };

  const handlePhaseSubmit = async () => {
    try {
      const values = await phaseForm.validateFields();
      if (!selectedPhase) return;

      const data = {
        status: values.status,
        progress: values.progress,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        planned_end_date: values.planned_end_date ? values.planned_end_date.format('YYYY-MM-DD') : null,
        actual_end_date: values.actual_end_date ? values.actual_end_date.format('YYYY-MM-DD') : null,
        responsible_person: values.responsible_person || null,
        remarks: values.remarks || null,
        update_note: values.update_note || null
      };

      const res = await updatePhase(selectedPhase.id, data);
      if (res.success) {
        message.success('阶段更新成功');
        setPhaseModalVisible(false);
        phaseForm.resetFields();
        setSelectedPhase(null);
        loadOverview();
      } else {
        message.error(res.message || '更新失败');
      }
    } catch (error: any) {
      console.error('更新阶段失败:', error);
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const loadPhaseDeliverables = async (phaseId: number) => {
    setDeliverableLoading(true);
    try {
      const res = await getPhaseDeliverables(phaseId);
      if (res.success && res.data) {
        setPhaseDeliverables(res.data);
      } else {
        setPhaseDeliverables([]);
      }
    } catch (error) {
      console.error('加载阶段成果失败:', error);
      setPhaseDeliverables([]);
    } finally {
      setDeliverableLoading(false);
    }
  };

  const handleViewDeliverables = (phase: ProjectPhaseInstance) => {
    setCurrentPhaseId(phase.id);
    setActiveTab('deliverables');
    loadPhaseDeliverables(phase.id);
  };

  const handleAddDeliverable = () => {
    setSelectedDeliverable(null);
    deliverableForm.resetFields();
    deliverableForm.setFieldsValue({
      required: true,
      sort_order: 0
    });
    setDeliverableModalVisible(true);
  };

  const handleEditDeliverable = (deliverable: PhaseDeliverable) => {
    setSelectedDeliverable(deliverable);
    deliverableForm.setFieldsValue({
      name: deliverable.name,
      description: deliverable.description || '',
      required: deliverable.required === 1,
      sort_order: deliverable.sort_order,
      status: deliverable.status,
      remark: deliverable.remark || ''
    });
    setDeliverableModalVisible(true);
  };

  const handleDeliverableSubmit = async () => {
    try {
      const values = await deliverableForm.validateFields();

      if (selectedDeliverable) {
        const res = await updateDeliverable(selectedDeliverable.id, {
          name: values.name,
          description: values.description || null,
          required: values.required,
          sort_order: values.sort_order,
          status: values.status,
          remark: values.remark || null
        });
        if (res.success) {
          message.success('成果更新成功');
          setDeliverableModalVisible(false);
          if (currentPhaseId) {
            loadPhaseDeliverables(currentPhaseId);
          }
          loadOverview();
        } else {
          message.error(res.message || '更新失败');
        }
      } else {
        if (!currentPhaseId) {
          message.error('请先选择阶段');
          return;
        }
        const res = await addPhaseDeliverable(currentPhaseId, {
          name: values.name,
          description: values.description || '',
          required: values.required,
          sort_order: values.sort_order
        });
        if (res.success) {
          message.success('成果添加成功');
          setDeliverableModalVisible(false);
          loadPhaseDeliverables(currentPhaseId);
          loadOverview();
        } else {
          message.error(res.message || '添加失败');
        }
      }
    } catch (error: any) {
      console.error('提交成果失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleDeleteDeliverable = (deliverable: PhaseDeliverable) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除成果「${deliverable.name}」吗？相关附件也会被删除。`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteDeliverable(deliverable.id);
          if (res.success) {
            message.success('删除成功');
            if (currentPhaseId) {
              loadPhaseDeliverables(currentPhaseId);
            }
            loadOverview();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (error: any) {
          console.error('删除成果失败:', error);
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleViewAttachments = async (deliverable: PhaseDeliverable) => {
    setCurrentDeliverableId(deliverable.id);
    setAttachmentModalVisible(true);
    setFileList([]);
    await loadAttachments(deliverable.id);
  };

  const loadAttachments = async (deliverableId: number) => {
    setAttachmentLoading(true);
    try {
      const res = await getDeliverableAttachments(deliverableId);
      if (res.success && res.data) {
        setAttachments(res.data);
      } else {
        setAttachments([]);
      }
    } catch (error) {
      console.error('加载附件失败:', error);
      setAttachments([]);
    } finally {
      setAttachmentLoading(false);
    }
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    if (!currentDeliverableId) return;

    try {
      const fileList = [file as File];
      const res = await uploadDeliverableAttachments(currentDeliverableId, fileList);
      if (res.success && res.data) {
        message.success('上传成功');
        loadAttachments(currentDeliverableId);
        loadOverview();
        if (onSuccess) onSuccess(res.data);
      } else {
        message.error(res.message || '上传失败');
        if (onError) onError(new Error(res.message || '上传失败'));
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      message.error(error.response?.data?.message || '上传失败');
      if (onError) onError(error);
    }
  };

  const handleDeleteAttachment = (attachment: DeliverableAttachment) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除附件「${attachment.original_name}」吗？`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteAttachment(attachment.id);
          if (res.success) {
            message.success('删除成功');
            if (currentDeliverableId) {
              loadAttachments(currentDeliverableId);
            }
            loadOverview();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (error: any) {
          console.error('删除附件失败:', error);
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const loadAcceptanceNodes = async (phaseId: number) => {
    setAcceptanceLoading(true);
    try {
      const res = await getAcceptanceNodes(phaseId);
      if (res.success && res.data) {
        setPhaseAcceptanceNodes(res.data);
      } else {
        setPhaseAcceptanceNodes([]);
      }
    } catch (error) {
      console.error('加载验收节点失败:', error);
      setPhaseAcceptanceNodes([]);
    } finally {
      setAcceptanceLoading(false);
    }
  };

  const handleViewAcceptance = (phase: ProjectPhaseInstance) => {
    setCurrentPhaseId(phase.id);
    setActiveTab('acceptance');
    loadAcceptanceNodes(phase.id);
  };

  const handleAddAcceptanceNode = () => {
    setSelectedAcceptanceNode(null);
    acceptanceForm.resetFields();
    acceptanceForm.setFieldsValue({
      sort_order: 0
    });
    setAcceptanceModalVisible(true);
  };

  const handleEditAcceptanceNode = (node: AcceptanceNode) => {
    setSelectedAcceptanceNode(node);
    acceptanceForm.setFieldsValue({
      name: node.name,
      description: node.description || '',
      sort_order: node.sort_order,
      status: node.status,
      comment: node.comment || ''
    });
    setAcceptanceModalVisible(true);
  };

  const handleAcceptanceSubmit = async () => {
    try {
      const values = await acceptanceForm.validateFields();

      if (selectedAcceptanceNode) {
        const res = await updateAcceptanceNode(selectedAcceptanceNode.id, {
          name: values.name,
          description: values.description || null,
          sort_order: values.sort_order,
          status: values.status,
          comment: values.comment || null
        });
        if (res.success) {
          message.success('验收节点更新成功');
          setAcceptanceModalVisible(false);
          if (currentPhaseId) {
            loadAcceptanceNodes(currentPhaseId);
          }
          loadOverview();
        } else {
          message.error(res.message || '更新失败');
        }
      } else {
        if (!currentPhaseId) {
          message.error('请先选择阶段');
          return;
        }
        const res = await addAcceptanceNode(currentPhaseId, {
          name: values.name,
          description: values.description || '',
          sort_order: values.sort_order
        });
        if (res.success) {
          message.success('验收节点添加成功');
          setAcceptanceModalVisible(false);
          loadAcceptanceNodes(currentPhaseId);
          loadOverview();
        } else {
          message.error(res.message || '添加失败');
        }
      }
    } catch (error: any) {
      console.error('提交验收节点失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleDeleteAcceptanceNode = (node: AcceptanceNode) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除验收节点「${node.name}」吗？`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteAcceptanceNode(node.id);
          if (res.success) {
            message.success('删除成功');
            if (currentPhaseId) {
              loadAcceptanceNodes(currentPhaseId);
            }
            loadOverview();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (error: any) {
          console.error('删除验收节点失败:', error);
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleViewAcceptanceRecords = async (node: AcceptanceNode) => {
    setRecordLoading(true);
    try {
      const res = await getAcceptanceRecords(node.id);
      if (res.success && res.data) {
        setAcceptanceRecords(res.data);
      } else {
        setAcceptanceRecords([]);
      }
      setAcceptanceRecordModalVisible(true);
    } catch (error) {
      console.error('加载验收记录失败:', error);
      setAcceptanceRecords([]);
    } finally {
      setRecordLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getPhaseStatusIcon = (status: PhaseStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'in_progress':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'delayed':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />;
    }
  };

  const deliverableColumns = [
    {
      title: '成果名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PhaseDeliverable) => (
        <Space>
          <FileTextOutlined />
          <span>{text}</span>
          {record.required === 1 && <Tag color="red">必交</Tag>}
          {record.required === 0 && <Tag color="default">选交</Tag>}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: DeliverableStatus) => (
        <Tag color={DeliverableStatusColorMap[status] || 'default'}>
          {DeliverableStatusMap[status] || status}
        </Tag>
      )
    },
    {
      title: '附件数',
      dataIndex: 'attachment_count',
      key: 'attachment_count',
      width: 80,
      render: (count: number | undefined) => count || 0
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 160,
      render: (text: string | null) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: PhaseDeliverable) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewAttachments(record)}>
            附件
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDeliverable(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteDeliverable(record)}>
            删除
          </Button>
        </Space>
      )
    }
  ];

  const acceptanceColumns = [
    {
      title: '节点名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <AuditOutlined />
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AcceptanceStatus) => (
        <Tag color={AcceptanceStatusColorMap[status] || 'default'}>
          {AcceptanceStatusMap[status] || status}
        </Tag>
      )
    },
    {
      title: '验收日期',
      dataIndex: 'acceptance_date',
      key: 'acceptance_date',
      width: 120,
      render: (text: string | null) => (text || '-')
    },
    {
      title: '验收人',
      dataIndex: 'accepted_by',
      key: 'accepted_by',
      width: 100,
      render: (text: string | null) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: AcceptanceNode) => (
        <Space size="small">
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => handleViewAcceptanceRecords(record)}>
            记录
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditAcceptanceNode(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAcceptanceNode(record)}>
            删除
          </Button>
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined />
          进度总览
        </span>
      ),
      children: (
        <Spin spinning={loading}>
          <div>
            <div
              style={{
                padding: 24,
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
                borderRadius: 12,
                border: '1px solid #bae0ff',
                marginBottom: 24
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#0958d9', marginBottom: 4 }}>
                    项目整体进度
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    共 {overview?.phase_stats?.total || 0} 个阶段，已完成 {overview?.phase_stats?.completed || 0} 个
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
                    {overview?.overall_progress ?? 0}%
                  </div>
                </div>
              </div>
              <Progress percent={overview?.overall_progress ?? 0} status="active" strokeColor={{ from: '#1890ff', to: '#52c41a' }} />
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <Card size="small" style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>阶段统计</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Space>
                    <Badge color="success" text={`完成 ${overview?.phase_stats?.completed || 0}`} />
                  </Space>
                  <Space>
                    <Badge color="processing" text={`进行中 ${overview?.phase_stats?.in_progress || 0}`} />
                  </Space>
                  <Space>
                    <Badge color="default" text={`未开始 ${overview?.phase_stats?.pending || 0}`} />
                  </Space>
                  <Space>
                    <Badge color="warning" text={`延期 ${overview?.phase_stats?.delayed || 0}`} />
                  </Space>
                </div>
              </Card>
              <Card size="small" style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>成果提交</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                    {overview?.deliverable_stats?.submitted || 0}
                  </span>
                  <span style={{ color: '#999' }}> / {overview?.deliverable_stats?.total || 0} 项</span>
                  <Tag color="blue">完成率 {overview?.deliverable_stats?.completion_rate || 0}%</Tag>
                </div>
              </Card>
              <Card size="small" style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>验收通过</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 600, color: '#722ed1' }}>
                    {overview?.acceptance_stats?.passed || 0}
                  </span>
                  <span style={{ color: '#999' }}> / {overview?.acceptance_stats?.total || 0} 项</span>
                  <Tag color="purple">通过率 {overview?.acceptance_stats?.pass_rate || 0}%</Tag>
                </div>
              </Card>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>项目阶段进度</h3>
            </div>

            {phases.length > 0 ? (
              <List
                dataSource={phases}
                renderItem={(phase) => (
                  <List.Item
                    style={{
                      padding: '16px 0',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background:
                              phase.status === 'completed'
                                ? '#f6ffed'
                                : phase.status === 'in_progress'
                                ? '#e6f4ff'
                                : '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20
                          }}
                        >
                          {getPhaseStatusIcon(phase.status as PhaseStatus)}
                        </div>
                      }
                      title={
                        <Space>
                          <span style={{ fontWeight: 500 }}>{phase.phase_name}</span>
                          <Tag color={PhaseStatusColorMap[phase.status as PhaseStatus] || 'default'}>
                            {PhaseStatusMap[phase.status as PhaseStatus] || phase.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                            {phase.phase_description || '暂无描述'}
                          </div>
                          <Progress
                            percent={phase.progress || 0}
                            size="small"
                            style={{ maxWidth: 300 }}
                          />
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            <Space>
                              {phase.responsible_person && (
                                <span>
                                  <UserOutlined style={{ marginRight: 4 }} />
                                  {phase.responsible_person}
                                </span>
                              )}
                              {phase.expected_duration > 0 && (
                                <span>
                                  <CalendarOutlined style={{ marginRight: 4 }} />
                                  预计 {phase.expected_duration} 天
                                </span>
                              )}
                              {phase.start_date && phase.planned_end_date && (
                                <span>
                                  {phase.start_date} ~ {phase.planned_end_date}
                                </span>
                              )}
                            </Space>
                          </div>
                        </div>
                      }
                    />
                    <Space>
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditPhase(phase)}>
                        编辑进度
                      </Button>
                      <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleViewDeliverables(phase)}>
                        成果 ({phase.deliverable_count || 0})
                      </Button>
                      <Button type="link" size="small" icon={<AuditOutlined />} onClick={() => handleViewAcceptance(phase)}>
                        验收 ({phase.acceptance_count || 0})
                      </Button>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无阶段数据" />
            )}
          </div>
        </Spin>
      )
    },
    {
      key: 'phases',
      label: (
        <span>
          <SettingOutlined />
          阶段管理
        </span>
      ),
      children: (
        <Spin spinning={loading}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>阶段列表</h3>
          </div>
          {phases.length > 0 ? (
            <Table
              dataSource={phases}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: '阶段名称',
                  dataIndex: 'phase_name',
                  key: 'phase_name',
                  render: (text: string, record: ProjectPhaseInstance) => (
                    <Space>
                      {getPhaseStatusIcon(record.status as PhaseStatus)}
                      <span style={{ fontWeight: 500 }}>{text}</span>
                    </Space>
                  )
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status: PhaseStatus) => (
                    <Tag color={PhaseStatusColorMap[status] || 'default'}>
                      {PhaseStatusMap[status] || status}
                    </Tag>
                  )
                },
                {
                  title: '进度',
                  dataIndex: 'progress',
                  key: 'progress',
                  width: 200,
                  render: (progress: number) => <Progress percent={progress || 0} size="small" />
                },
                {
                  title: '负责人',
                  dataIndex: 'responsible_person',
                  key: 'responsible_person',
                  width: 100,
                  render: (text: string | null) => text || '-'
                },
                {
                  title: '预计周期',
                  dataIndex: 'expected_duration',
                  key: 'expected_duration',
                  width: 100,
                  render: (days: number) => (days > 0 ? `${days} 天` : '-')
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 150,
                  render: (_: any, record: ProjectPhaseInstance) => (
                    <Space size="small">
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditPhase(record)}>
                        编辑
                      </Button>
                    </Space>
                  )
                }
              ]}
            />
          ) : (
            <Empty description="暂无阶段数据" />
          )}
        </Spin>
      )
    },
    {
      key: 'deliverables',
      label: (
        <span>
          <FileTextOutlined />
          阶段成果
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <span>选择阶段：</span>
              <Select
                style={{ width: 250 }}
                placeholder="请选择阶段"
                value={currentPhaseId}
                onChange={(value: number) => {
                  setCurrentPhaseId(value);
                  loadPhaseDeliverables(value);
                }}
                allowClear
              >
                {phases.map((phase) => (
                  <Option key={phase.id} value={phase.id}>
                    {phase.phase_name}
                  </Option>
                ))}
              </Select>
            </Space>
            {currentPhaseId && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDeliverable}>
                添加成果
              </Button>
            )}
          </div>

          {currentPhaseId ? (
            <Table
              dataSource={phaseDeliverables}
              columns={deliverableColumns}
              rowKey="id"
              size="small"
              loading={deliverableLoading}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无成果数据" /> }}
            />
          ) : (
            <Empty description="请先选择阶段" />
          )}
        </div>
      )
    },
    {
      key: 'acceptance',
      label: (
        <span>
          <AuditOutlined />
          验收节点
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <span>选择阶段：</span>
              <Select
                style={{ width: 250 }}
                placeholder="请选择阶段"
                value={currentPhaseId}
                onChange={(value: number) => {
                  setCurrentPhaseId(value);
                  loadAcceptanceNodes(value);
                }}
                allowClear
              >
                {phases.map((phase) => (
                  <Option key={phase.id} value={phase.id}>
                    {phase.phase_name}
                  </Option>
                ))}
              </Select>
            </Space>
            {currentPhaseId && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAcceptanceNode}>
                添加节点
              </Button>
            )}
          </div>

          {currentPhaseId ? (
            <Table
              dataSource={phaseAcceptanceNodes}
              columns={acceptanceColumns}
              rowKey="id"
              size="small"
              loading={acceptanceLoading}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无验收节点" /> }}
            />
          ) : (
            <Empty description="请先选择阶段" />
          )}
        </div>
      )
    },
    {
      key: 'logs',
      label: (
        <span>
          <HistoryOutlined />
          进度日志
        </span>
      ),
      children: (
        <div>
          {progressLogs.length > 0 ? (
            <Timeline
              items={progressLogs.map((log) => ({
                color: log.progress_after > (log.progress_before || 0) ? 'green' : log.status_after === 'delayed' ? 'orange' : 'blue',
                children: (
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      进度更新: {log.progress_before || 0}% → {log.progress_after || 0}%
                    </div>
                    {log.status_before && log.status_after && log.status_before !== log.status_after && (
                      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                        状态变更: {PhaseStatusMap[log.status_before as PhaseStatus] || log.status_before} →{' '}
                        {PhaseStatusMap[log.status_after as PhaseStatus] || log.status_after}
                      </div>
                    )}
                    {log.update_note && (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#666',
                          marginTop: 4,
                          padding: '4px 8px',
                          background: '#f5f5f5',
                          borderRadius: 4
                        }}
                      >
                        备注: {log.update_note}
                      </div>
                    )}
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                      <Space>
                        {log.updated_by && <span>操作人: {log.updated_by}</span>}
                        <span>{dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                      </Space>
                    </div>
                  </div>
                )
              }))}
            />
          ) : (
            <Empty description="暂无进度日志" />
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />
      </Card>

      <Modal
        title={selectedPhase ? '编辑阶段进度' : '阶段详情'}
        open={phaseModalVisible}
        onOk={handlePhaseSubmit}
        onCancel={() => {
          setPhaseModalVisible(false);
          setSelectedPhase(null);
          phaseForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={phaseForm} layout="vertical">
          <Form.Item
            name="status"
            label="阶段状态"
            rules={[{ required: true, message: '请选择阶段状态' }]}
          >
            <Select placeholder="请选择阶段状态">
              <Option value="pending">未开始</Option>
              <Option value="in_progress">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="delayed">已延期</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="progress"
            label="进度 (%)"
            rules={[{ required: true, message: '请输入进度值' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="start_date" label="开始日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="planned_end_date" label="计划完成日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="actual_end_date" label="实际完成日期">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="responsible_person" label="负责人">
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item name="update_note" label="变更说明">
            <TextArea rows={2} placeholder="请输入本次进度变更的说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedDeliverable ? '编辑阶段成果' : '添加阶段成果'}
        open={deliverableModalVisible}
        onOk={handleDeliverableSubmit}
        onCancel={() => {
          setDeliverableModalVisible(false);
          setSelectedDeliverable(null);
          deliverableForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={550}
      >
        <Form form={deliverableForm} layout="vertical">
          <Form.Item
            name="name"
            label="成果名称"
            rules={[{ required: true, message: '请输入成果名称' }]}
          >
            <Input placeholder="请输入成果名称" />
          </Form.Item>
          <Form.Item name="description" label="成果描述">
            <TextArea rows={3} placeholder="请输入成果描述" />
          </Form.Item>
          <Form.Item name="required" label="是否必交" valuePropName="checked">
            <Select>
              <Option value={true}>必交</Option>
              <Option value={false}>选交</Option>
            </Select>
          </Form.Item>
          {selectedDeliverable && (
            <>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态">
                  <Option value="pending">待提交</Option>
                  <Option value="submitted">已提交</Option>
                  <Option value="reviewing">审核中</Option>
                  <Option value="approved">已通过</Option>
                  <Option value="rejected">已驳回</Option>
                </Select>
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </>
          )}
          <Form.Item name="sort_order" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="成果附件"
        open={attachmentModalVisible}
        onCancel={() => {
          setAttachmentModalVisible(false);
          setCurrentDeliverableId(null);
          setAttachments([]);
          setFileList([]);
        }}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Upload
            multiple
            fileList={fileList}
            onChange={({ fileList: newFileList }) => setFileList(newFileList)}
            customRequest={handleUpload}
            showUploadList
          >
            <Button icon={<UploadOutlined />}>上传附件</Button>
          </Upload>
        </div>
        <Spin spinning={attachmentLoading}>
          {attachments.length > 0 ? (
            <List
              size="small"
              dataSource={attachments}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => window.open(getAttachmentDownloadUrl(item.id), '_blank')}
                    >
                      下载
                    </Button>,
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteAttachment(item)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                    title={item.original_name}
                    description={
                      <Space size="small">
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {formatFileSize(item.file_size)}
                        </span>
                        {item.uploaded_by && (
                          <span style={{ fontSize: 12, color: '#999' }}>
                            上传人: {item.uploaded_by}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无附件" />
          )}
        </Spin>
      </Modal>

      <Modal
        title={selectedAcceptanceNode ? '编辑验收节点' : '添加验收节点'}
        open={acceptanceModalVisible}
        onOk={handleAcceptanceSubmit}
        onCancel={() => {
          setAcceptanceModalVisible(false);
          setSelectedAcceptanceNode(null);
          acceptanceForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={550}
      >
        <Form form={acceptanceForm} layout="vertical">
          <Form.Item
            name="name"
            label="节点名称"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>
          <Form.Item name="description" label="节点描述">
            <TextArea rows={3} placeholder="请输入节点描述" />
          </Form.Item>
          {selectedAcceptanceNode && (
            <>
              <Form.Item name="status" label="验收状态">
                <Select placeholder="请选择状态">
                  <Option value="pending">待验收</Option>
                  <Option value="submitted">已提交</Option>
                  <Option value="reviewing">验收中</Option>
                  <Option value="passed">已通过</Option>
                  <Option value="failed">未通过</Option>
                </Select>
              </Form.Item>
              <Form.Item name="comment" label="验收意见">
                <TextArea rows={3} placeholder="请输入验收意见" />
              </Form.Item>
            </>
          )}
          <Form.Item name="sort_order" label="排序">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="验收记录"
        open={acceptanceRecordModalVisible}
        onCancel={() => setAcceptanceRecordModalVisible(false)}
        footer={null}
        width={600}
      >
        <Spin spinning={recordLoading}>
          {acceptanceRecords.length > 0 ? (
            <Timeline
              items={acceptanceRecords.map((record) => ({
                color: record.action === 'passed' ? 'green' : record.action === 'failed' ? 'red' : 'blue',
                children: (
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      操作: {AcceptanceStatusMap[record.action as AcceptanceStatus] || record.action}
                    </div>
                    {record.comment && (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#666',
                          marginTop: 4,
                          padding: '4px 8px',
                          background: '#f5f5f5',
                          borderRadius: 4
                        }}
                      >
                        意见: {record.comment}
                      </div>
                    )}
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                      <Space>
                        {record.operator && <span>操作人: {record.operator}</span>}
                        <span>{dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                      </Space>
                    </div>
                  </div>
                )
              }))}
            />
          ) : (
            <Empty description="暂无验收记录" />
          )}
        </Spin>
      </Modal>
    </div>
  );
}

export default ProjectExecution;
