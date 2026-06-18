import { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, message, Card,
  Tabs, Badge, List, Progress, Alert, Row, Col, Empty, Divider, Tooltip,
  Radio, Steps
} from 'antd';
import {
  CheckOutlined, CloseOutlined, EyeOutlined, DownloadOutlined,
  PaperClipOutlined, FileSearchOutlined, FileDoneOutlined,
  WarningOutlined, FileProtectOutlined, CloudDownloadOutlined,
  FolderOpenOutlined, RollbackOutlined, UserOutlined,
  ClockCircleOutlined, InfoCircleOutlined, TeamOutlined,
  CalendarOutlined, SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeclarations } from '../api/declarations';
import { getApprovalHistory, approveDeclaration, rejectDeclaration, rollbackDeclaration, getWorkflowInfo, getApprovalReasonCategories } from '../api/workflow';
import {
  getAttachments, downloadAttachment,
  getMissingCheck, getDuplicates,
  batchDownloadAttachments
} from '../api/attachments';
import { StatusColorMap } from '../types';
import type {
  Declaration, ApprovalRecord, Attachment,
  MissingCheckResult, DuplicatesResult, WorkflowInfo,
  ApprovalReasonCategory
} from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

function Approval() {
  const [pendingList, setPendingList] = useState<Declaration[]>([]);
  const [allList, setAllList] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeclaration, setSelectedDeclaration] = useState<Declaration | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [rollbackForm] = Form.useForm();

  const getReasonCategoryName = (code?: string): string => {
    if (!code) return '';
    const all = [...approveReasonCategories, ...rejectReasonCategories, ...rollbackReasonCategories];
    const found = all.find(c => c.code === code);
    return found ? found.name : code;
  };

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [missingCheck, setMissingCheck] = useState<MissingCheckResult | null>(null);
  const [duplicatesResult, setDuplicatesResult] = useState<DuplicatesResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('');
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        getDeclarations({ status: undefined }),
        getDeclarations()
      ]);

      if (pendingRes.success) {
        const pending = (pendingRes.data || []).filter(
          (d: Declaration) => !['draft', 'approved', 'rejected'].includes(d.status) && !d.is_deleted
        );
        setPendingList(pending);
      }
      if (allRes.success) setAllList(allRes.data || []);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    loadReasonCategories();
  }, []);

  const getRoleInfo = (decl: Declaration): { key: string; label: string; name: string } => {
    const role = decl.current_step_role || '审批员';
    const name = decl.current_step_name || '审批';
    const key = `${role}_${decl.status}`;
    return { key, label: role, name };
  };

  const getStatusLabel = (decl: Declaration): string => {
    if (decl.status_label) {
      return decl.status_label;
    }
    const map: Record<string, string> = {
      draft: '草稿',
      submitted: '待初审',
      reviewing: '初审中',
      first_reviewed: '待复审',
      second_reviewed: '待终审',
      approved: '已立项',
      rejected: '已驳回'
    };
    return map[decl.status] || decl.status;
  };

  const groupPendingByRole = () => {
    const groups: Record<string, { role: string; roleKey: string; items: Declaration[] }> = {};

    for (const decl of pendingList) {
      if (decl.status === 'draft' || decl.status === 'approved' || decl.status === 'rejected') continue;
      const { key, label } = getRoleInfo(decl);
      if (!groups[key]) {
        groups[key] = { role: label, roleKey: key, items: [] };
      }
      groups[key].items.push(decl);
    }
    return groups;
  };

  const handleViewDetail = async (record: Declaration) => {
    setSelectedDeclaration(record);
    setDetailModalVisible(true);
    setDetailLoading(true);
    setAttachments([]);
    setMissingCheck(null);
    setDuplicatesResult(null);
    setWorkflowInfo(null);

    try {
      const [histRes, attRes, missRes, dupRes, wfRes] = await Promise.all([
        getApprovalHistory(record.id),
        getAttachments(record.id),
        getMissingCheck(record.id),
        getDuplicates(record.id),
        getWorkflowInfo(record.id)
      ]).catch(err => {
        console.error('部分加载失败:', err);
        return [null, null, null, null, null] as const;
      });

      if (histRes?.success) setApprovalHistory(histRes.data || []);
      if (attRes?.success) setAttachments(attRes.data || []);
      if (missRes?.success) setMissingCheck(missRes.data || null);
      if (dupRes?.success) setDuplicatesResult(dupRes.data || null);
      if (wfRes?.success) setWorkflowInfo(wfRes.data || null);
    } catch (error) {
      console.error('加载详情失败:', error);
    }
    setDetailLoading(false);
  };

  const handleApprove = (record: Declaration) => {
    setSelectedDeclaration(record);
    form.resetFields();
    const roleInfo = getRoleInfo(record);
    form.setFieldsValue({
      approver: roleInfo.label,
      comment: '',
      reason_category: undefined
    });
    setApproveModalVisible(true);
  };

  const handleReject = (record: Declaration) => {
    setSelectedDeclaration(record);
    form.resetFields();
    const roleInfo = getRoleInfo(record);
    form.setFieldsValue({
      approver: roleInfo.label,
      comment: '',
      reason_category: undefined
    });
    setRejectModalVisible(true);
  };

  const handleRollback = (record: Declaration) => {
    setSelectedDeclaration(record);
    rollbackForm.resetFields();
    const roleInfo = getRoleInfo(record);
    rollbackForm.setFieldsValue({
      approver: roleInfo.label,
      comment: '',
      reason_category: undefined,
      target_step: undefined
    });
    setRollbackModalVisible(true);
  };

  const submitApprove = async () => {
    if (!selectedDeclaration) return;
    try {
      const values = await form.validateFields();
      const res = await approveDeclaration(selectedDeclaration.id, values);
      if (res.success) {
        message.success('审批通过');
        setApproveModalVisible(false);
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '审批失败');
    }
  };

  const submitReject = async () => {
    if (!selectedDeclaration) return;
    try {
      const values = await form.validateFields();
      const res = await rejectDeclaration(selectedDeclaration.id, values);
      if (res.success) {
        message.success('已驳回');
        setRejectModalVisible(false);
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const submitRollback = async () => {
    if (!selectedDeclaration) return;
    try {
      const values = await rollbackForm.validateFields();
      const res = await rollbackDeclaration(selectedDeclaration.id, values);
      if (res.success) {
        message.success(res.message || '已退回');
        setRollbackModalVisible(false);
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '退回失败');
    }
  };

  const handleBatchDownload = () => {
    if (!selectedDeclaration) return;
    if (attachments.length === 0) {
      message.warning('暂无可下载的附件');
      return;
    }
    try {
      batchDownloadAttachments(selectedDeclaration.id);
      message.success('已开始下载');
    } catch (error) {
      message.error('下载失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDuration = (days: number) => {
    if (!days || days <= 0) return '-';
    if (days < 1) return `${Math.round(days * 24)}小时`;
    return `${days}个工作日`;
  };

  const getCurrentStepWaitTime = (declaration: Declaration) => {
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
    if (!selectedDeclaration || !workflowInfo || !workflowInfo.current_step) return null;
    const currentStep = workflowInfo.current_step;
    const duration = currentStep.expected_duration || 0;
    if (duration <= 0) return null;
    const updatedAt = dayjs(selectedDeclaration.updated_at);
    return updatedAt.add(duration, 'day').format('YYYY-MM-DD');
  };

  const getFileIcon = (ext: string) => {
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
    if (['zip', 'rar'].includes(ext)) return '🗜️';
    return '📎';
  };

  const AttachmentsPreviewCard = () => {
    if (!missingCheck && !duplicatesResult && attachments.length === 0) {
      return <Empty description="暂无附件数据" />;
    }

    return (
      <div>
        {missingCheck && (
          <div style={{ marginBottom: 16 }}>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <div style={{
                  padding: 12,
                  background: missingCheck.stats.is_complete ? '#f6ffed' : '#fffbe6',
                  border: `1px solid ${missingCheck.stats.is_complete ? '#b7eb8f' : '#ffe58f'}`,
                  borderRadius: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {missingCheck.stats.is_complete ? (
                      <FileDoneOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <WarningOutlined style={{ color: '#faad14' }} />
                    )}
                    <strong>
                      {missingCheck.stats.is_complete ? '材料完整' : '材料不完整'}
                    </strong>
                    <span style={{ marginLeft: 'auto', color: '#666' }}>
                      必填 {missingCheck.stats.required_complete}/{missingCheck.stats.required_total}
                    </span>
                  </div>
                  <Progress
                    percent={missingCheck.stats.completion_rate}
                    size="small"
                    status={missingCheck.stats.is_complete ? 'success' : 'exception'}
                    showInfo={false}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{
                  padding: 12,
                  background: (duplicatesResult?.exact_duplicates.duplicate_count || 0) + (duplicatesResult?.potential_duplicates.duplicate_count || 0) > 0
                    ? '#fff2e8'
                    : '#f0f5ff',
                  border: `1px solid ${(duplicatesResult?.exact_duplicates.duplicate_count || 0) + (duplicatesResult?.potential_duplicates.duplicate_count || 0) > 0
                      ? '#ffbb96'
                      : '#adc6ff'
                    }`,
                  borderRadius: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {(duplicatesResult?.exact_duplicates.duplicate_count || 0) + (duplicatesResult?.potential_duplicates.duplicate_count || 0) > 0 ? (
                      <WarningOutlined style={{ color: '#fa8c16' }} />
                    ) : (
                      <FileProtectOutlined style={{ color: '#1890ff' }} />
                    )}
                    <strong>
                      {(duplicatesResult?.exact_duplicates.duplicate_count || 0) + (duplicatesResult?.potential_duplicates.duplicate_count || 0) > 0
                        ? '存在重复文件'
                        : '未发现重复'
                      }
                    </strong>
                    <span style={{ marginLeft: 'auto', color: '#666' }}>
                      共 {attachments.length} 个附件
                    </span>
                  </div>
                  {duplicatesResult && (
                    <div style={{ fontSize: 12, color: '#666' }}>
                      完全重复：{duplicatesResult.exact_duplicates.duplicate_count} 个，
                      疑似重复：{duplicatesResult.potential_duplicates.duplicate_count} 个
                    </div>
                  )}
                </div>
              </Col>
            </Row>

            {missingCheck.stats.required_missing > 0 && (
              <Alert
                type="error"
                showIcon
                icon={<WarningOutlined />}
                message={`缺少 ${missingCheck.stats.required_missing} 项必填材料，不建议通过审批`}
                description={
                  <span>
                    缺失材料：
                    {missingCheck.missing.map((m, i) => (
                      <Tag key={i} color="red" style={{ margin: '2px 4px 2px 0' }}>
                        {m.name}
                      </Tag>
                    ))}
                  </span>
                }
                style={{ marginBottom: 12 }}
              />
            )}

            {missingCheck.uncategorized.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`${missingCheck.uncategorized.length} 个附件未分类`}
                description="建议退回申请人补充材料分类信息"
                style={{ marginBottom: 12 }}
              />
            )}

            {duplicatesResult && (duplicatesResult.exact_duplicates.duplicate_count > 0 || duplicatesResult.potential_duplicates.duplicate_count > 0) && (
              <Alert
                type="warning"
                showIcon
                message={`发现 ${duplicatesResult.exact_duplicates.duplicate_count + duplicatesResult.potential_duplicates.duplicate_count} 个重复文件`}
                description={`完全重复 ${duplicatesResult.exact_duplicates.duplicate_count} 个，疑似重复 ${duplicatesResult.potential_duplicates.duplicate_count} 个，建议检查处理`}
                style={{ marginBottom: 12 }}
              />
            )}
          </div>
        )}

        <Divider orientation="left" plain style={{ margin: '12px 0' }}>
          <Space>
            <FolderOpenOutlined />
            附件列表 ({attachments.length})
            {selectedDeclaration && (
              <Button
                type="link"
                size="small"
                icon={<CloudDownloadOutlined />}
                onClick={handleBatchDownload}
                disabled={attachments.length === 0}
                style={{ padding: 0 }}
              >
                全部下载
              </Button>
            )}
          </Space>
        </Divider>

        {attachments.length > 0 ? (
          <List
            size="small"
            dataSource={attachments}
            style={{ maxHeight: 320, overflowY: 'auto' }}
            renderItem={att => {
              const ext = att.original_name.split('.').pop()?.toLowerCase() || '';
              return (
                <List.Item
                  actions={[
                    <Tooltip title="预览">
                      <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => window.open(downloadAttachment(att.id))}
                      >
                        预览
                      </Button>
                    </Tooltip>,
                    <Tooltip title="下载">
                      <Button
                        type="link"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => window.open(downloadAttachment(att.id))}
                      >
                        下载
                      </Button>
                    </Tooltip>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: 20 }}>{getFileIcon(ext)}</span>}
                    title={
                      <Space>
                        <Tooltip title={att.original_name}>
                          <span style={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            verticalAlign: 'bottom'
                          }}>
                            {att.original_name}
                          </span>
                        </Tooltip>
                        {att.material_type_name && (
                          <Tag
                            color={att.material_type_required ? 'red' : 'blue'}
                            style={{ margin: 0 }}
                          >
                            {att.material_type_required && (
                              <span style={{ color: '#ff4d4f' }}>*</span>
                            )}
                            {att.material_type_name}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space size={4} split={<span style={{ color: '#d9d9d9' }}>·</span>}>
                        <span style={{ color: '#666' }}>{formatFileSize(att.file_size)}</span>
                        <span style={{ color: '#999' }}>
                          {dayjs(att.uploaded_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty
            description="该申报暂未上传附件"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '24px 0' }}
          />
        )}
      </div>
    );
  };

  const roleGroups = useMemo(() => groupPendingByRole(), [pendingList]);
  const roleKeys = Object.keys(roleGroups);

  const currentRolePending = selectedRoleKey && roleGroups[selectedRoleKey]
    ? roleGroups[selectedRoleKey].items
    : pendingList;

  const pendingColumns = useMemo(() => [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70
    },
    {
      title: '项目名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 90
    },
    {
      title: '企业名称',
      dataIndex: 'company',
      key: 'company',
      width: 140
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (_: string, record: Declaration) => (
        <Tag color={StatusColorMap[record.status as keyof typeof StatusColorMap] || 'blue'}>
          {getStatusLabel(record)}
        </Tag>
      )
    },
    {
      title: '审批角色',
      key: 'workflow',
      width: 100,
      render: (_: any, record: Declaration) => {
        const roleInfo = getRoleInfo(record);
        return <Tag color="purple">{roleInfo.label}</Tag>;
      }
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Declaration) => (
        <Space size="small" split={<Divider type="vertical" />}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" icon={<CheckOutlined />} onClick={() => handleApprove(record)}>
            通过
          </Button>
          <Button type="link" danger icon={<CloseOutlined />} onClick={() => handleReject(record)}>
            驳回
          </Button>
          <Button type="link" icon={<RollbackOutlined />} onClick={() => handleRollback(record)}>
            退回
          </Button>
        </Space>
      )
    }
  ], []);

  const allColumns = useMemo(() => [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70
    },
    {
      title: '项目名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 90
    },
    {
      title: '企业名称',
      dataIndex: 'company',
      key: 'company',
      width: 140
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (_: string, record: Declaration) => (
        <Tag color={StatusColorMap[record.status as keyof typeof StatusColorMap] || 'blue'}>
          {getStatusLabel(record)}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Declaration) => (
        <Space size="small" split={<Divider type="vertical" />}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" icon={<PaperClipOutlined />} onClick={() => handleViewDetail(record)}>
            附件
          </Button>
        </Space>
      )
    }
  ], []);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">后台审批</h2>
      </div>

      <Card>
        <Tabs defaultActiveKey="pending">
          <TabPane
            tab={
              <span>
                待我审批
                <Badge
                  count={pendingList.length}
                  style={{ marginLeft: 8 }}
                  size="small"
                />
              </span>
            }
            key="pending"
          >
            {roleKeys.length > 0 && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Radio.Group
                  value={selectedRoleKey}
                  onChange={e => setSelectedRoleKey(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="">全部 ({pendingList.length})</Radio.Button>
                  {roleKeys.map(key => (
                    <Radio.Button key={key} value={key}>
                      {roleGroups[key].role} ({roleGroups[key].items.length})
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </div>
            )}
            <Table
              columns={pendingColumns}
              dataSource={currentRolePending}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="全部申报" key="all">
            <Table
              columns={allColumns}
              dataSource={allList}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="申报详情与材料检查"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          selectedDeclaration && !['draft', 'approved', 'rejected'].includes(selectedDeclaration.status) ? (
            <Space key="actions">
              <Button
                icon={<RollbackOutlined />}
                onClick={() => {
                  if (selectedDeclaration) {
                    handleRollback(selectedDeclaration);
                  }
                }}
              >
                退回
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  if (selectedDeclaration) {
                    handleReject(selectedDeclaration);
                  }
                }}
              >
                驳回申报
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => {
                  if (selectedDeclaration) {
                    handleApprove(selectedDeclaration);
                  }
                }}
              >
                审批通过
              </Button>
            </Space>
          ) : null,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={880}
        destroyOnClose
      >
        {selectedDeclaration && (
          <Tabs defaultActiveKey="info" style={{ marginTop: -8 }}>
            <TabPane
              tab={
                <Space>
                  <EyeOutlined />
                  基本信息
                </Space>
              }
              key="info"
            >
              <div>
                {workflowInfo?.current_step && (
                  <div style={{
                    padding: 16,
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
                    borderRadius: 8,
                    border: '1px solid #bae0ff',
                    marginBottom: 16
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
                          当前环节：{workflowInfo.current_step.name}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
                          {workflowInfo.current_step.description || '正在处理中...'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserOutlined style={{ color: '#1890ff' }} />
                        <span style={{ fontSize: 12, color: '#666' }}>责任人：</span>
                        <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>
                          {workflowInfo.current_step.responsible_person || workflowInfo.current_step.role}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TeamOutlined style={{ color: '#52c41a' }} />
                        <span style={{ fontSize: 12, color: '#666' }}>角色：</span>
                        <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>
                          {workflowInfo.current_step.role}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ClockCircleOutlined style={{ color: '#faad14' }} />
                        <span style={{ fontSize: 12, color: '#666' }}>预计时长：</span>
                        <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>
                          {formatDuration(workflowInfo.current_step.expected_duration || 0)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarOutlined style={{ color: '#722ed1' }} />
                        <span style={{ fontSize: 12, color: '#666' }}>预计完成：</span>
                        <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>
                          {getEstimatedCompletionDate() || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <p><strong>项目名称：</strong>{selectedDeclaration.title}</p>
                <p><strong>申请人：</strong>{selectedDeclaration.applicant}</p>
                <p><strong>企业名称：</strong>{selectedDeclaration.company}</p>
                <p><strong>联系电话：</strong>{selectedDeclaration.phone || '-'}</p>
                <p><strong>电子邮箱：</strong>{selectedDeclaration.email || '-'}</p>
                <p><strong>当前状态：</strong>
                  <Tag color={StatusColorMap[selectedDeclaration.status as keyof typeof StatusColorMap] || 'blue'}>
                    {getStatusLabel(selectedDeclaration)}
                  </Tag>
                  {selectedDeclaration && (
                    <Tag color="default" style={{ marginLeft: 4 }}>
                      已等待 {getCurrentStepWaitTime(selectedDeclaration)}
                    </Tag>
                  )}
                </p>

                {workflowInfo && workflowInfo.steps.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <strong>审批流程：{workflowInfo.config.name}</strong>
                    <Steps
                      size="small"
                      current={workflowInfo.current_step ? workflowInfo.steps.findIndex(s => s.step_order === workflowInfo.current_step!.step_order) : -1}
                      items={[
                        { title: '草稿', description: '申请人', subTitle: <Tag style={{ fontSize: 11, padding: '0 6px', height: 20, lineHeight: '20px' }}>申请人</Tag> },
                        ...workflowInfo.steps.map(s => ({
                          title: s.name,
                          description: (
                            <Tooltip title={s.description || s.role}>
                              <span>{s.role}</span>
                            </Tooltip>
                          ),
                          subTitle: (
                            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                              {s.expected_duration ? `预计${formatDuration(s.expected_duration)}` : ''}
                            </div>
                          )
                        })),
                        { title: '已立项', description: '' }
                      ]}
                      style={{ marginTop: 12, padding: '0 8px' }}
                    />
                  </div>
                )}

                {workflowInfo?.current_step?.description && (
                  <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', borderRadius: 4, border: '1px solid #ffe58f' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#d48806', marginBottom: 4 }}>
                      <InfoCircleOutlined style={{ marginRight: 4 }} />
                      节点说明
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      {workflowInfo.current_step.description}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <strong>项目内容：</strong>
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    background: '#f5f5f5',
                    borderRadius: 4,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflowY: 'auto'
                  }}>
                    {selectedDeclaration.content || '(暂无内容)'}
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <strong>审批记录</strong>
                  {approvalHistory.length > 0 ? (
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      {approvalHistory.map(record => (
                        <li key={record.id} style={{ marginBottom: 8 }}>
                          <div>
                            <Tag color={record.action === '通过' ? 'green' : record.action === '驳回' ? 'red' : 'blue'}>
                              {record.action}
                            </Tag>
                            <span>{record.step_name || `步骤 ${record.step}`}</span>
                            {record.step_role && (
                              <Tag color="purple" style={{ marginLeft: 4 }}>
                                {record.step_role}
                              </Tag>
                            )}
                            <span style={{ marginLeft: 8, color: '#999' }}>
                              {record.approver} - {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
                            </span>
                          </div>
                          {record.reason_category && (
                            <div style={{ color: '#666', fontSize: 13 }}>
                              原因分类：<Tag color="orange" style={{ margin: '2px 4px 2px 0' }}>{getReasonCategoryName(record.reason_category)}</Tag>
                            </div>
                          )}
                          {record.comment && (
                            <div style={{ color: '#666', fontSize: 13 }}>意见：{record.comment}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#999', marginTop: 8 }}>暂无审批记录</p>
                  )}
                </div>
              </div>
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <PaperClipOutlined />
                  材料检查
                  {missingCheck && !missingCheck.stats.is_complete && (
                    <Badge dot color="#faad14" />
                  )}
                  {duplicatesResult && (duplicatesResult.exact_duplicates.duplicate_count > 0 || duplicatesResult.potential_duplicates.duplicate_count > 0) && (
                    <Badge dot color="#fa8c16" offset={[-2, 0]} />
                  )}
                </Space>
              }
              key="attachments"
            >
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {detailLoading ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div>加载材料检查数据中...</div>
                  </div>
                ) : (
                  <AttachmentsPreviewCard />
                )}
              </div>
            </TabPane>
          </Tabs>
        )}
      </Modal>

      <Modal
        title="审批通过"
        open={approveModalVisible}
        onOk={submitApprove}
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
          {workflowInfo?.current_step && (
            <div>
              <Alert
                type="info"
                showIcon
                message={`当前步骤：${workflowInfo.current_step.name}（${workflowInfo.current_step.role}）`}
                description={
                  workflowInfo.current_step.approved_status === 'approved'
                    ? '通过后将直接立项'
                    : `通过后将流转至下一审批环节`
                }
                style={{ marginBottom: 8 }}
              />
              {workflowInfo.current_step.description && (
                <Alert
                  type="warning"
                  showIcon
                  message="节点说明"
                  description={workflowInfo.current_step.description}
                  style={{ marginBottom: 8 }}
                />
              )}
              <div style={{
                padding: 8,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
                color: '#666'
              }}>
                <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                  <span>
                    <UserOutlined style={{ marginRight: 4 }} />
                    责任人：{workflowInfo.current_step.responsible_person || workflowInfo.current_step.role}
                  </span>
                  <span>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    预计处理：{formatDuration(workflowInfo.current_step.expected_duration || 0)}
                  </span>
                </Space>
              </div>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="驳回申报"
        open={rejectModalVisible}
        onOk={submitReject}
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
              <Alert
                type="info"
                showIcon
                message={`可参考：缺少 ${missingCheck.stats.required_missing} 项必填材料`}
                style={{ marginTop: 8 }}
              />
            ) : null}
          >
            <TextArea rows={4} placeholder="请输入驳回原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="退回申报"
        open={rollbackModalVisible}
        onOk={submitRollback}
        onCancel={() => setRollbackModalVisible(false)}
        destroyOnClose
      >
        <Form form={rollbackForm} layout="vertical">
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
            <Select placeholder="选择退回目标节点">
              {workflowInfo?.rollback_options?.map(opt => (
                <Option key={opt.step_order} value={opt.step_order}>
                  {opt.name}（步骤{opt.step_order}）
                </Option>
              )) || (
                <>
                  <Option value={0}>草稿（退回至申请人修改）</Option>
                  <Option value={1}>初审（退回至初审步骤）</Option>
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
          {workflowInfo?.current_step && (
            <div>
              <Alert
                type="warning"
                showIcon
                message={`当前步骤：${workflowInfo.current_step.name}`}
                description="退回后，申报将回到目标步骤重新审批"
                style={{ marginBottom: 8 }}
              />
              {workflowInfo.current_step.description && (
                <Alert
                  type="info"
                  showIcon
                  message="节点说明"
                  description={workflowInfo.current_step.description}
                  style={{ marginBottom: 8 }}
                />
              )}
              <div style={{
                padding: 8,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
                color: '#666'
              }}>
                <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                  <span>
                    <UserOutlined style={{ marginRight: 4 }} />
                    责任人：{workflowInfo.current_step.responsible_person || workflowInfo.current_step.role}
                  </span>
                  <span>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    预计处理：{formatDuration(workflowInfo.current_step.expected_duration || 0)}
                  </span>
                </Space>
              </div>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default Approval;
