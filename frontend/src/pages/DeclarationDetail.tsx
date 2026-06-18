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
  PlusOutlined, CloudUploadOutlined, FolderOpenOutlined
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
  rollbackDeclaration, getWorkflowInfo
} from '../api/workflow';
import { getDeclarationTimeline } from '../api/logs';
import { StatusMap, StatusColorMap } from '../types';
import type {
  Declaration, Attachment, ApprovalRecord,
  OperationTimelineEvent, WorkflowInfo, MissingCheckResult
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

  const canApprove = () => {
    if (!declaration) return false;
    return ['submitted', 'first_reviewed', 'second_reviewed'].includes(declaration.status);
  };

  const canReject = () => {
    if (!declaration) return false;
    return ['submitted', 'first_reviewed', 'second_reviewed'].includes(declaration.status);
  };

  const canRollback = () => {
    if (!declaration) return false;
    return ['submitted', 'first_reviewed', 'second_reviewed'].includes(declaration.status);
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

  const buildWorkflowSteps = () => {
    if (!workflowInfo) return [];

    const steps = [
      { title: '草稿', description: '申请人编辑', icon: <EditOutlined /> }
    ];

    workflowInfo.steps.forEach((step, index) => {
      const isCurrent = declaration?.status === step.pending_status;
      const isCompleted = workflowInfo.steps.some((s, i) =>
        i < index && declaration?.status === s.approved_status
      ) || (declaration?.status === 'approved' && index < workflowInfo.steps.length);

      let stepIcon = <ClockCircleOutlined />;
      if (isCurrent) stepIcon = <SyncOutlined />;
      else if (isCompleted || (declaration?.status === 'approved')) stepIcon = <CheckCircleOutlined />;

      if (declaration?.status === 'rejected') {
        stepIcon = <CloseCircleOutlined />;
      }

      steps.push({
        title: step.name,
        description: step.role,
        icon: stepIcon
      });
    });

    steps.push({
      title: '已立项',
      description: '审批完成',
      icon: declaration?.status === 'approved'
        ? <CheckCircleOutlined />
        : <ClockCircleOutlined />
    });

    return steps;
  };

  const getCurrentStepIndex = () => {
    if (!declaration || !workflowInfo) return 0;
    if (declaration.status === 'draft') return 0;
    if (declaration.status === 'approved') return workflowInfo.steps.length + 1;
    if (declaration.status === 'rejected') {
      const idx = workflowInfo.steps.findIndex(s => s.pending_status === declaration.status);
      return idx >= 0 ? idx + 1 : 1;
    }
    const idx = workflowInfo.steps.findIndex(s => s.pending_status === declaration.status);
    return idx >= 0 ? idx + 1 : 0;
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
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAttachment(record.id)}
          />
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
              {(stats.completion_rate * 100).toFixed(0)}%
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
        <Descriptions column={2} bordered>
          <Descriptions.Item label="项目名称">{declaration?.title}</Descriptions.Item>
          <Descriptions.Item label="关联指南">{declaration?.guideline_title || '-'}</Descriptions.Item>
          <Descriptions.Item label="申请人">{declaration?.applicant}</Descriptions.Item>
          <Descriptions.Item label="企业名称">{declaration?.company}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{declaration?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="电子邮箱">{declaration?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={StatusColorMap[declaration?.status as keyof typeof StatusColorMap] || 'default'}>
              {StatusMap[declaration?.status || 'draft']}
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
          <Descriptions.Item label="创建时间">{dayjs(declaration?.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(declaration?.updated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="项目内容" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{declaration?.content}</div>
          </Descriptions.Item>
        </Descriptions>
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
            <div style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: '#333' }}>
                审批流程进度
              </div>
              <Steps
                current={getCurrentStepIndex()}
                status={getStatusStepStatus()}
                items={buildWorkflowSteps().map(step => ({
                  title: step.title,
                  description: step.description,
                  icon: step.icon
                }))}
                size="small"
              />
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
            <Tag color={StatusColorMap[declaration?.status as keyof typeof StatusColorMap] || 'default'}>
              {StatusMap[declaration?.status || 'draft']}
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
              <Button type="primary" icon={<CheckOutlined />} onClick={() => { form.resetFields(); setApproveModalVisible(true); }}>
                审批通过
              </Button>
            )}
            {canReject() && (
              <Button danger icon={<CloseOutlined />} onClick={() => { form.resetFields(); setRejectModalVisible(true); }}>
                驳回
              </Button>
            )}
            {canRollback() && (
              <Button icon={<RollbackOutlined />} onClick={() => { form.resetFields(); setRollbackModalVisible(true); }}>
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
            <Form.Item name="comment" label="审批意见">
              <TextArea rows={4} placeholder="请输入审批意见（可选）" />
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
              name="comment"
              label="驳回原因"
              rules={[{ required: true, message: '请输入驳回原因' }]}
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
            <Form.Item name="comment" label="退回原因">
              <TextArea rows={4} placeholder="请输入退回原因（可选）" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Spin>
  );
}

export default DeclarationDetail;
