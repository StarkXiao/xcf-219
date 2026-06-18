import { useEffect, useState } from 'react';
import {
  Card, Descriptions, Tag, Button, List, Timeline, Modal, Form, Input,
  Select, message, Space, Tabs, Steps, Table, Tooltip, Badge, Empty, Spin
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, CheckOutlined, CloseOutlined,
  RollbackOutlined, PaperClipOutlined, FileTextOutlined,
  AuditOutlined, HistoryOutlined, InfoCircleOutlined,
  CheckCircleOutlined, SyncOutlined, ClockCircleOutlined,
  CloseCircleOutlined, EditOutlined, DeleteOutlined,
  PlusOutlined, CloudUploadOutlined, FolderOpenOutlined,
  UserOutlined, CalendarOutlined, TeamOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDeclaration } from '../api/declarations';
import {
  getAttachments, downloadAttachment, deleteAttachment,
  getMissingCheck, batchDownloadAttachments
} from '../api/attachments';
import {
  getApprovalHistory, approveDeclaration, rejectDeclaration,
  rollbackDeclaration, getWorkflowInfo, getApprovalReasonCategories
} from '../api/workflow';
import { getDeclarationTimeline } from '../api/logs';
import { StatusMap, StatusColorMap } from '../types';
import type {
  Declaration, Attachment, ApprovalRecord,
  OperationTimelineEvent, WorkflowInfo, MissingCheckResult,
  ApprovalReasonCategory
} from '../types';

const { TextArea } = Input;
const { Option } = Select;

function DeclarationDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<ApprovalRecord[]>([]);
  const [timeline, setTimeline] = useState<OperationTimelineEvent[]>([]);
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [missingCheck, setMissingCheck] = useState<MissingCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]);
  const [form] = Form.useForm();
  const [approveReasonCategories, setApproveReasonCategories] = useState<ApprovalReasonCategory[]>([]);
  const [rejectReasonCategories, setRejectReasonCategories] = useState<ApprovalReasonCategory[]>([]);
  const [rollbackReasonCategories, setRollbackReasonCategories] = useState<ApprovalReasonCategory[]>([]);

  const loadReasonCategories = async () => {
    try {
      const [approveRes, rejectRes, rollbackRes] = await Promise.all([
        getApprovalReasonCategories('approve'),
        getApprovalReasonCategories('reject'),
        getApprovalReasonCategories('rollback')
      ]);
      if (approveRes.success) setApproveReasonCategories(approveRes.data || []);
      if (rejectRes.success) setRejectReasonCategories(rejectRes.data || []);
      if (rollbackRes.success) setRollbackReasonCategories(rollbackRes.data || []);
    } catch (error) {
      console.error('加载原因分类失败:', error);
    }
  };

  const getReasonCategoryName = (code?: string): string => {
    if (!code) return '';
    const all = [...approveReasonCategories, ...rejectReasonCategories, ...rollbackReasonCategories];
    const found = all.find(c => c.code === code);
    return found ? found.name : code;
  };

  useEffect(() => {
    loadReasonCategories();
  }, []);

  useEffect(() => {
    if (id) {
      loadData(parseInt(id));
    }
  }, [id]);

  const loadData = async (declarationId: number) => {
    setLoading(true);
    try {
      const [decRes, attRes, histRes, timelineRes, wfRes] = await Promise.all([
        getDeclaration(declarationId),
        getAttachments(declarationId),
        getApprovalHistory(declarationId),
        getDeclarationTimeline(declarationId),
        getWorkflowInfo(declarationId)
      ]);

      if (decRes.success) setDeclaration(decRes.data || null);
      if (attRes.success) setAttachments(attRes.data || []);
      if (histRes.success) setHistory(histRes.data || []);
      if (timelineRes.success) setTimeline(timelineRes.data?.timeline || []);
      if (wfRes.success) setWorkflowInfo(wfRes.data || null);

      try {
        const missingRes = await getMissingCheck(declarationId);
        if (missingRes.success) setMissingCheck(missingRes.data || null);
      } catch {}
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return '-';
    if (StatusMap[status as keyof typeof StatusMap]) {
      return StatusMap[status as keyof typeof StatusMap];
    }
    if (workflowInfo) {
      const step = workflowInfo.steps.find(s => s.pending_status === status || s.approved_status === status);
      if (step) {
        if (step.pending_status === status) return `待${step.name}`;
        if (step.approved_status === status) return `${step.name}通过`;
      }
    }
    return status;
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'default';
    if (StatusColorMap[status as keyof typeof StatusColorMap]) {
      return StatusColorMap[status as keyof typeof StatusColorMap];
    }
    if (status === 'approved') return 'green';
    if (status === 'rejected') return 'red';
    if (status === 'draft') return 'default';
    if (workflowInfo) {
      const pendingStep = workflowInfo.steps.find(s => s.pending_status === status);
      if (pendingStep) return 'blue';
      const approvedStep = workflowInfo.steps.find(s => s.approved_status === status);
      if (approvedStep) return 'purple';
    }
    return 'default';
  };

  const canApprove = () => {
    if (!declaration || !workflowInfo) return false;
    if (['draft', 'approved', 'rejected'].includes(declaration.status)) return false;
    return !!workflowInfo.current_step;
  };

  const canReject = () => {
    if (!declaration || !workflowInfo) return false;
    if (['draft', 'approved', 'rejected'].includes(declaration.status)) return false;
    return !!workflowInfo.current_step;
  };

  const canRollback = () => {
    if (!declaration || !workflowInfo) return false;
    if (['draft', 'approved', 'rejected'].includes(declaration.status)) return false;
    return !!workflowInfo.current_step && workflowInfo.current_step.allow_rollback !== false;
  };

  const handleApprove = async () => {
    try {
      const values = await form.validateFields();
      if (!id) return;
      const res = await approveDeclaration(parseInt(id), values);
      if (res.success) {
        message.success('审批通过');
        setApproveModalVisible(false);
        form.resetFields();
        loadData(parseInt(id));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '审批失败');
    }
  };

  const handleReject = async () => {
    try {
      const values = await form.validateFields();
      if (!id) return;
      const res = await rejectDeclaration(parseInt(id), values);
      if (res.success) {
        message.success('已驳回');
        setRejectModalVisible(false);
        form.resetFields();
        loadData(parseInt(id));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleRollback = async () => {
    try {
      const values = await form.validateFields();
      if (!id) return;
      const res = await rollbackDeclaration(parseInt(id), values);
      if (res.success) {
        message.success('已退回');
        setRollbackModalVisible(false);
        form.resetFields();
        loadData(parseInt(id));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      const res = await deleteAttachment(attachmentId);
      if (res.success) {
        message.success('附件已删除');
        if (id) loadData(parseInt(id));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleBatchDownload = async () => {
    if (selectedAttachmentIds.length === 0) {
      message.warning('请先选择附件');
      return;
    }
    try {
      if (id) {
        await batchDownloadAttachments(parseInt(id), selectedAttachmentIds);
        message.success('下载成功');
      }
    } catch {
      message.error('批量下载失败');
    }
  };

  const getTimelineColor = (action: string) => {
    switch (action) {
      case '通过': return 'green';
      case '驳回': return 'red';
      case '退回': return 'orange';
      case '提交': return 'blue';
      default: return 'gray';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'version': return <SyncOutlined style={{ color: '#1890ff' }} />;
      case 'workflow': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default: return <FileTextOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'version': return 'blue';
      case 'workflow': return 'green';
      default: return 'gold';
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('创建')) return <PlusOutlined style={{ color: '#52c41a' }} />;
    if (action.includes('编辑') || action.includes('更新')) return <EditOutlined style={{ color: '#1890ff' }} />;
    if (action.includes('删除')) return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
    if (action.includes('审批通过')) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (action.includes('驳回')) return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    if (action.includes('退回')) return <RollbackOutlined style={{ color: '#faad14' }} />;
    if (action.includes('提交')) return <CloudUploadOutlined style={{ color: '#1890ff' }} />;
    return <InfoCircleOutlined style={{ color: '#999' }} />;
  };

  const formatDuration = (days: number) => {
    if (!days || days <= 0) return '-';
    if (days < 1) return `${Math.round(days * 24)}小时`;
    return `${days}个工作日`;
  };

  const getCurrentStepWaitTime = () => {
    if (!declaration || !declaration.updated_at) return null;
    const now = dayjs();
    const updatedAt = dayjs(declaration.updated_at);
    const diffDays = now.diff(updatedAt, 'day');
    const diffHours = now.diff(updatedAt, 'hour');
    if (diffDays > 0) return `${diffDays}天${diffHours % 24}小时`;
    if (diffHours > 0) return `${diffHours}小时`;
    return '刚更新';
  };

  const getEstimatedCompletionDate = () => {
    if (!declaration || !workflowInfo || !workflowInfo.current_step) return null;
    const currentStep = workflowInfo.current_step;
    const duration = currentStep.expected_duration || 0;
    if (duration <= 0) return null;
    const updatedAt = dayjs(declaration.updated_at);
    return updatedAt.add(duration, 'day').format('YYYY-MM-DD');
  };

  const getTotalRemainingDuration = () => {
    if (!declaration || !workflowInfo) return 0;
    const currentStatus = declaration.status;
    if (currentStatus === 'approved' || currentStatus === 'rejected') return 0;
    
    let totalDays = 0;
    let foundCurrent = false;
    
    for (const step of workflowInfo.steps) {
      if (step.pending_status === currentStatus) {
        foundCurrent = true;
      }
      if (foundCurrent) {
        totalDays += step.expected_duration || 0;
      }
    }
    return totalDays;
  };

  const buildWorkflowSteps = () => {
    if (!workflowInfo) return [];

    const steps: Array<{
      title: string;
      description: string;
      icon: JSX.Element;
      detail: {
        description: string;
        role: string;
        responsiblePerson: string;
        expectedDuration: number;
      };
      isCurrent?: boolean;
      isCompleted?: boolean;
    }> = [
      {
        title: '草稿',
        description: '申请人编辑',
        icon: <EditOutlined />,
        detail: {
          description: '申请人填写申报信息、上传附件材料',
          role: '申请人',
          responsiblePerson: '申请人',
          expectedDuration: 0
        },
        isCompleted: declaration?.status !== 'draft'
      }
    ];

    const currentStatus = declaration?.status || '';
    const currentStepIndex = workflowInfo.steps.findIndex(s => s.pending_status === currentStatus);
    const approvedStepIndex = workflowInfo.steps.findIndex(s => s.approved_status === currentStatus);

    workflowInfo.steps.forEach((step, index) => {
      const isCurrent = currentStatus === step.pending_status;
      const isCompleted = 
        (approvedStepIndex >= 0 && index <= approvedStepIndex) ||
        (currentStepIndex >= 0 && index < currentStepIndex) ||
        currentStatus === 'approved';

      let stepIcon = <ClockCircleOutlined style={{ color: '#bfbfbf' }} />;
      if (isCurrent) stepIcon = <SyncOutlined spin style={{ color: '#1890ff' }} />;
      else if (isCompleted) stepIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;

      if (declaration?.status === 'rejected') {
        stepIcon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      }

      steps.push({
        title: step.name,
        description: step.role,
        icon: stepIcon,
        detail: {
          description: step.description || '',
          role: step.role,
          responsiblePerson: step.responsible_person || step.role,
          expectedDuration: step.expected_duration || 0
        },
        isCurrent,
        isCompleted
      });
    });

    steps.push({
      title: '已立项',
      description: '审批完成',
      icon: declaration?.status === 'approved'
        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
        : <ClockCircleOutlined style={{ color: '#bfbfbf' }} />,
      detail: {
        description: '审批通过，项目正式立项',
        role: '系统',
        responsiblePerson: '系统',
        expectedDuration: 0
      }
    });

    return steps;
  };

  const getCurrentStepIndex = () => {
    if (!declaration || !workflowInfo) return 0;
    if (declaration.status === 'draft') return 0;
    if (declaration.status === 'approved') return workflowInfo.steps.length + 1;
    if (declaration.status === 'rejected') {
      const idx = workflowInfo.steps.findIndex(s => s.pending_status === declaration.status || s.approved_status === declaration.status);
      return idx >= 0 ? idx + 1 : 1;
    }
    const pendingIdx = workflowInfo.steps.findIndex(s => s.pending_status === declaration.status);
    if (pendingIdx >= 0) return pendingIdx + 1;
    const approvedIdx = workflowInfo.steps.findIndex(s => s.approved_status === declaration.status);
    if (approvedIdx >= 0) return approvedIdx + 2;
    return 0;
  };

  const getStatusStepStatus = () => {
    if (!declaration) return 'wait';
    if (declaration.status === 'rejected') return 'error';
    if (declaration.status === 'approved') return 'finish';
    return 'process';
  };

  if (!declaration && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p>申报不存在</p>
        <Button onClick={() => navigate('/declarations')}>返回列表</Button>
      </div>
    );
  }

  const attachmentColumns = [
    {
      title: '文件名',
      dataIndex: 'original_name',
      key: 'original_name',
      render: (text: string, record: Attachment) => (
        <Space>
          <FileTextOutlined />
          {text}
          {record.material_type_name && (
            <Tag color={record.material_type_required ? 'red' : 'blue'}>
              {record.material_type_required && <span style={{ color: '#ff4d4f' }}>*</span>}
              {record.material_type_name}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (size: number) => formatFileSize(size)
    },
    {
      title: '上传时间',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Attachment) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => window.open(downloadAttachment(record.id))}
          />
          {declaration?.status === 'draft' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteAttachment(record.id)}
            />
          )}
        </Space>
      )
    }
  ];

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (text: string) => (
        <Space>
          {getActionIcon(text)}
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '操作人',
      dataIndex: 'user',
      key: 'user',
      width: 100
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true
    },
    {
      title: '类型',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 100,
      render: (type: string) => {
        const map: Record<string, { label: string; color: string }> = {
          version: { label: '版本', color: 'blue' },
          workflow: { label: '流程', color: 'green' },
          declaration: { label: '申报', color: 'gold' }
        };
        const info = map[type] || { label: type, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    }
  ];

  const renderMissingCheck = () => {
    if (!missingCheck) return null;
    const { stats, missing } = missingCheck;

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', gap: 16, marginBottom: 12,
          padding: 12, background: stats.is_complete ? '#f6ffed' : '#fff7e6',
          borderRadius: 6, border: `1px solid ${stats.is_complete ? '#b7eb8f' : '#ffd591'}`
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#666' }}>必传材料</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              <span style={{ color: '#52c41a' }}>{stats.required_complete}</span>
              <span style={{ color: '#999' }}> / {stats.required_total}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#666' }}>选传材料</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              <span style={{ color: '#1890ff' }}>{stats.optional_complete}</span>
              <span style={{ color: '#999' }}> / {stats.optional_total}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#666' }}>完整率</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: stats.is_complete ? '#52c41a' : '#faad14' }}>
              {stats.completion_rate}%
            </div>
          </div>
        </div>
        {missing.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: '#ff4d4f', marginBottom: 8 }}>
              缺少 {missing.length} 项必传材料：
            </div>
            <Space wrap>
              {missing.map(m => (
                <Tag key={m.id} color="error">{m.name}</Tag>
              ))}
            </Space>
          </div>
        )}
      </div>
    );
  };

  const rollbackOptions = workflowInfo?.rollback_options || [];

  const tabItems = [
    {
      key: 'basic',
      label: (
        <span>
          <InfoCircleOutlined />
          基本信息
        </span>
      ),
      children: (
        <div>
          {workflowInfo?.current_step && (
            <div style={{
              padding: 16,
              background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
              borderRadius: 8,
              border: '1px solid #bae0ff',
              marginBottom: 16
            }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0958d9', marginBottom: 12 }}>
                <InfoCircleOutlined style={{ marginRight: 6 }} />
                当前审批状态概览
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>当前环节</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                    {workflowInfo.current_step.name}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>责任人</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                    {workflowInfo.current_step.responsible_person || workflowInfo.current_step.role}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>预计处理时长</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                    {formatDuration(workflowInfo.current_step.expected_duration || 0)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>预计完成日期</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                    {getEstimatedCompletionDate() || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Descriptions column={2} bordered>
            <Descriptions.Item label="项目名称">{declaration?.title}</Descriptions.Item>
            <Descriptions.Item label="关联指南">{declaration?.guideline_title || '-'}</Descriptions.Item>
            <Descriptions.Item label="申请人">{declaration?.applicant}</Descriptions.Item>
            <Descriptions.Item label="企业名称">{declaration?.company}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{declaration?.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="电子邮箱">{declaration?.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={getStatusColor(declaration?.status)}>
                {getStatusLabel(declaration?.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前步骤">
              {declaration?.current_step_name || workflowInfo?.current_step?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="工作流配置">
              {workflowInfo?.config?.name || '默认审批流'}
            </Descriptions.Item>
            <Descriptions.Item label="当前步骤角色">
              {workflowInfo?.current_step?.role || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="当前责任人">
              {workflowInfo?.current_step?.responsible_person || workflowInfo?.current_step?.role || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="预计剩余时间">
              {formatDuration(getTotalRemainingDuration()) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(declaration?.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{dayjs(declaration?.updated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="节点说明" span={2}>
              {workflowInfo?.current_step?.description || '暂无'}
            </Descriptions.Item>
            <Descriptions.Item label="项目内容" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{declaration?.content}</div>
            </Descriptions.Item>
          </Descriptions>
        </div>
      )
    },
    {
      key: 'attachments',
      label: (
        <span>
          <PaperClipOutlined />
          附件材料
          {attachments.length > 0 && (
            <Badge count={attachments.length} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div>
          {renderMissingCheck()}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
          }}>
            <Space>
              {selectedAttachmentIds.length > 0 && (
                <>
                  <span style={{ color: '#1890ff' }}>已选 {selectedAttachmentIds.length} 项</span>
                  <Button
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={handleBatchDownload}
                  >
                    批量下载
                  </Button>
                  <Button size="small" onClick={() => setSelectedAttachmentIds([])}>取消选择</Button>
                </>
              )}
            </Space>
            {declaration?.status === 'draft' && (
              <Button
                type="primary"
                size="small"
                icon={<CloudUploadOutlined />}
                onClick={() => navigate(`/declarations/${id}/edit`)}
              >
                上传附件
              </Button>
            )}
          </div>
          <Table
            dataSource={attachments}
            columns={attachmentColumns}
            rowKey="id"
            size="small"
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedAttachmentIds,
              onChange: (keys) => setSelectedAttachmentIds(keys as number[])
            }}
            locale={{ emptyText: <Empty description="暂无附件" /> }}
          />
        </div>
      )
    },
    {
      key: 'approval',
      label: (
        <span>
          <AuditOutlined />
          审批记录
          {history.length > 0 && (
            <Badge count={history.length} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div>
          {workflowInfo && workflowInfo.steps.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                padding: 20,
                background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
                borderRadius: 12,
                border: '1px solid #bae0ff',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#0958d9', marginBottom: 4 }}>
                      {workflowInfo.config?.name || '审批流程'}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      共 {workflowInfo.steps.length + 2} 个节点，当前第 {getCurrentStepIndex() + 1} 步
                    </div>
                  </div>
                  {workflowInfo.current_step && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                        预计剩余处理时间
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#0958d9' }}>
                        {formatDuration(getTotalRemainingDuration())}
                      </div>
                    </div>
                  )}
                </div>
                
                {workflowInfo.current_step && (
                  <div style={{
                    padding: 16,
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #91caff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#e6f4ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <SyncOutlined spin style={{ fontSize: 20, color: '#1890ff' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
                          当前：{workflowInfo.current_step.name}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          {workflowInfo.current_step.description || '正在处理中...'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserOutlined style={{ color: '#1890ff' }} />
                        <span style={{ fontSize: 13, color: '#666' }}>责任人：</span>
                        <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                          {workflowInfo.current_step.responsible_person || workflowInfo.current_step.role}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TeamOutlined style={{ color: '#52c41a' }} />
                        <span style={{ fontSize: 13, color: '#666' }}>角色：</span>
                        <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                          {workflowInfo.current_step.role}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ClockCircleOutlined style={{ color: '#faad14' }} />
                        <span style={{ fontSize: 13, color: '#666' }}>预计处理时长：</span>
                        <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                          {formatDuration(workflowInfo.current_step.expected_duration || 0)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarOutlined style={{ color: '#722ed1' }} />
                        <span style={{ fontSize: 13, color: '#666' }}>预计完成：</span>
                        <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                          {getEstimatedCompletionDate() || '-'}
                        </span>
                      </div>
                      {getCurrentStepWaitTime() && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <InfoCircleOutlined style={{ color: '#13c2c2' }} />
                          <span style={{ fontSize: 13, color: '#666' }}>已等待：</span>
                          <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                            {getCurrentStepWaitTime()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '20px 16px', background: '#fafafa', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, color: '#333' }}>
                  审批流程进度
                </div>
                <Steps
                  current={getCurrentStepIndex()}
                  status={getStatusStepStatus()}
                  items={buildWorkflowSteps().map(step => ({
                    title: step.title,
                    description: (
                      <Tooltip title={step.detail?.description || step.description}>
                        <div style={{ fontSize: 12 }}>
                          <div>{step.detail?.role || step.description}</div>
                          {step.detail?.expectedDuration && step.detail.expectedDuration > 0 && (
                            <div style={{ color: '#999', marginTop: 2 }}>
                              预计{formatDuration(step.detail.expectedDuration)}
                            </div>
                          )}
                        </div>
                      </Tooltip>
                    ),
                    icon: step.icon,
                    subTitle: step.detail?.responsiblePerson ? (
                      <Tag color="blue" style={{ fontSize: 11, padding: '0 6px', height: 20, lineHeight: '20px', marginTop: 4 }}>
                        {step.detail.responsiblePerson}
                      </Tag>
                    ) : undefined
                  }))}
                  size="default"
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <Card size="small" title="节点详情" style={{ borderRadius: 8 }}>
                  <List
                    size="small"
                    dataSource={buildWorkflowSteps()}
                    renderItem={(step, index) => (
                      <List.Item
                        style={{
                          padding: '12px 0',
                          borderBottom: index < buildWorkflowSteps().length - 1 ? '1px solid #f0f0f0' : 'none'
                        }}
                      >
                        <List.Item.Meta
                          avatar={
                            <div style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: step.isCompleted
                                ? '#f6ffed'
                                : step.isCurrent
                                ? '#e6f4ff'
                                : '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {step.icon}
                            </div>
                          }
                          title={
                            <Space>
                              <span style={{ fontWeight: 500 }}>{step.title}</span>
                              {step.isCurrent && (
                                <Tag color="processing" style={{ fontSize: 11, padding: '0 6px', height: 20, lineHeight: '20px' }}>当前</Tag>
                              )}
                              {step.isCompleted && !step.isCurrent && (
                                <Tag color="success" style={{ fontSize: 11, padding: '0 6px', height: 20, lineHeight: '20px' }}>已完成</Tag>
                              )}
                              {!step.isCompleted && !step.isCurrent && (
                                <Tag color="default" style={{ fontSize: 11, padding: '0 6px', height: 20, lineHeight: '20px' }}>待处理</Tag>
                              )}
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                              {step.detail?.description || '暂无描述'}
                            </div>
                          }
                        />
                        <div style={{ textAlign: 'right', minWidth: 200 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 12, color: '#999' }}>
                              <UserOutlined style={{ marginRight: 4 }} />
                              {step.detail?.responsiblePerson || step.detail?.role || '-'}
                            </div>
                            {step.detail?.expectedDuration && step.detail.expectedDuration > 0 && (
                              <div style={{ fontSize: 12, color: '#999' }}>
                                <ClockCircleOutlined style={{ marginRight: 4 }} />
                                预计 {formatDuration(step.detail.expectedDuration)}
                              </div>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </Card>
              </div>
            </div>
          )}
          {history.length > 0 ? (
            <Timeline
              className="status-timeline"
              items={history.map(record => ({
                color: getTimelineColor(record.action),
                dot: record.action === '通过' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                     record.action === '驳回' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> :
                     record.action === '退回' ? <RollbackOutlined style={{ color: '#faad14' }} /> : undefined,
                children: (
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {record.step_name || `步骤 ${record.step}`} - {record.action}
                    </div>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                      审批人: {record.approver}
                      {record.step_role && <span style={{ marginLeft: 8, color: '#999' }}>({record.step_role})</span>}
                    </div>
                    {record.reason_category && (
                      <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                        原因分类: <Tag color="orange">{getReasonCategoryName(record.reason_category)}</Tag>
                      </div>
                    )}
                    {record.comment && (
                      <div style={{
                        color: '#666', fontSize: 13, marginTop: 4,
                        padding: '4px 8px', background: '#f5f5f5', borderRadius: 4
                      }}>
                        意见: {record.comment}
                      </div>
                    )}
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                      {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </div>
                )
              }))}
            />
          ) : (
            <Empty description="暂无审批记录" />
          )}
        </div>
      )
    },
    {
      key: 'logs',
      label: (
        <span>
          <HistoryOutlined />
          操作日志
          {timeline.length > 0 && (
            <Badge count={timeline.length} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <Tag color="blue">版本操作</Tag>
            <Tag color="green">流程操作</Tag>
            <Tag color="gold">申报操作</Tag>
          </div>
          {timeline.length > 0 ? (
            <Table
              dataSource={timeline}
              columns={logColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '8px 0' }}>
                    <p style={{ margin: 0 }}><strong>详情：</strong>{record.detail}</p>
                    {record.version_number && (
                      <p style={{ margin: '4px 0 0', color: '#666' }}>
                        <strong>版本号：</strong>v{record.version_number}
                      </p>
                    )}
                  </div>
                ),
                rowExpandable: (record) => !!record.detail
              }}
            />
          ) : (
            <Empty description="暂无操作日志" />
          )}
        </div>
      )
    }
  ];

  return (
    <Spin spinning={loading}>
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/declarations')} />
            <h2 className="page-title" style={{ margin: 0 }}>申报详情</h2>
            <Tag color={getStatusColor(declaration?.status)}>
              {getStatusLabel(declaration?.status)}
            </Tag>
            {workflowInfo?.current_step && (
              <Tooltip title={`当前步骤: ${workflowInfo.current_step.name} | 角色: ${workflowInfo.current_step.role}`}>
                <Tag icon={<ClockCircleOutlined />} color="processing">
                  {workflowInfo.current_step.name}
                </Tag>
              </Tooltip>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {declaration?.status === 'draft' && (
              <Button onClick={() => navigate(`/declarations/${id}/edit`)}>编辑</Button>
            )}
            {canApprove() && (
              <Button type="primary" icon={<CheckOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ reason_category: undefined, comment: undefined }); setApproveModalVisible(true); }}>
                审批通过
              </Button>
            )}
            {canReject() && (
              <Button danger icon={<CloseOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ reason_category: undefined, comment: undefined }); setRejectModalVisible(true); }}>
                驳回
              </Button>
            )}
            {canRollback() && (
              <Button icon={<RollbackOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ reason_category: undefined, comment: undefined, target_step: undefined }); setRollbackModalVisible(true); }}>
                退回
              </Button>
            )}
          </div>
        </div>

        <Card style={{ marginBottom: 16 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            type="card"
          />
        </Card>

        <Modal
          title="审批通过"
          open={approveModalVisible}
          onOk={handleApprove}
          onCancel={() => setApproveModalVisible(false)}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="approver"
              label="审批人"
              rules={[{ required: true, message: '请输入审批人姓名' }]}
            >
              <Input placeholder="请输入审批人姓名" />
            </Form.Item>
            <Form.Item
              name="reason_category"
              label="通过原因分类"
              rules={[{ required: true, message: '请选择通过原因分类' }]}
            >
              <Select placeholder="请选择通过原因分类">
                {approveReasonCategories.map(cat => (
                  <Option key={cat.code} value={cat.code}>
                    {cat.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="comment"
              label="审批意见"
              rules={[{ required: true, message: '请输入审批意见' }]}
            >
              <TextArea rows={4} placeholder="请输入审批意见" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="驳回申报"
          open={rejectModalVisible}
          onOk={handleReject}
          onCancel={() => setRejectModalVisible(false)}
          okButtonProps={{ danger: true }}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="approver"
              label="审批人"
              rules={[{ required: true, message: '请输入审批人姓名' }]}
            >
              <Input placeholder="请输入审批人姓名" />
            </Form.Item>
            <Form.Item
              name="reason_category"
              label="驳回原因分类"
              rules={[{ required: true, message: '请选择驳回原因分类' }]}
            >
              <Select placeholder="请选择驳回原因分类">
                {rejectReasonCategories.map(cat => (
                  <Option key={cat.code} value={cat.code}>
                    {cat.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="comment"
              label="驳回原因"
              rules={[{ required: true, message: '请输入驳回原因' }]}
              extra={missingCheck && !missingCheck.stats.is_complete ? (
                <span style={{ color: '#1890ff' }}>
                  可参考：缺少 {missingCheck.stats.required_missing} 项必填材料
                </span>
              ) : null}
            >
              <TextArea rows={4} placeholder="请输入驳回原因" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="退回申报"
          open={rollbackModalVisible}
          onOk={handleRollback}
          onCancel={() => setRollbackModalVisible(false)}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="approver"
              label="审批人"
              rules={[{ required: true, message: '请输入审批人姓名' }]}
            >
              <Input placeholder="请输入审批人姓名" />
            </Form.Item>
            <Form.Item
              name="target_step"
              label="退回至"
              rules={[{ required: true, message: '请选择退回目标' }]}
            >
              <Select placeholder="请选择退回目标">
                {rollbackOptions.length > 0 ? (
                  rollbackOptions.map(opt => (
                    <Option key={opt.step_order} value={opt.step_order}>
                      {opt.name}
                    </Option>
                  ))
                ) : (
                  <>
                    <Option value={0}>草稿</Option>
                    <Option value={1}>待初审</Option>
                    <Option value={2}>待复审</Option>
                  </>
                )}
              </Select>
            </Form.Item>
            <Form.Item
              name="reason_category"
              label="退回原因分类"
              rules={[{ required: true, message: '请选择退回原因分类' }]}
            >
              <Select placeholder="请选择退回原因分类">
                {rollbackReasonCategories.map(cat => (
                  <Option key={cat.code} value={cat.code}>
                    {cat.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="comment"
              label="退回原因"
              rules={[{ required: true, message: '请输入退回原因' }]}
            >
              <TextArea rows={4} placeholder="请输入退回原因" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Spin>
  );
}

export default DeclarationDetail;
