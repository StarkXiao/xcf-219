import { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, message, Card,
  Tabs, Badge, List, Progress, Alert, Row, Col, Empty, Divider, Tooltip,
  Popover
} from 'antd';
import {
  CheckOutlined, CloseOutlined, EyeOutlined, DownloadOutlined,
  PaperClipOutlined, FileSearchOutlined, FileDoneOutlined,
  WarningOutlined, FileProtectOutlined, CloudDownloadOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeclarations } from '../api/declarations';
import { getApprovalHistory, approveDeclaration, rejectDeclaration } from '../api/workflow';
import {
  getAttachments, downloadAttachment,
  getMissingCheck, getDuplicates,
  batchDownloadAttachments
} from '../api/attachments';
import { StatusMap, StatusColorMap } from '../types';
import type {
  Declaration, ApprovalRecord, Attachment,
  MissingCheckResult, DuplicatesResult
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
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState('initial');
  const [form] = Form.useForm();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [missingCheck, setMissingCheck] = useState<MissingCheckResult | null>(null);
  const [duplicatesResult, setDuplicatesResult] = useState<DuplicatesResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const pendingStatuses = currentRole === 'initial'
        ? 'submitted'
        : currentRole === 'review'
          ? 'first_reviewed'
          : 'second_reviewed';

      const [pendingRes, allRes] = await Promise.all([
        getDeclarations({ status: pendingStatuses }),
        getDeclarations()
      ]);

      if (pendingRes.success) setPendingList(pendingRes.data || []);
      if (allRes.success) setAllList(allRes.data || []);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const handleViewDetail = async (record: Declaration) => {
    setSelectedDeclaration(record);
    setDetailModalVisible(true);
    setDetailLoading(true);
    setAttachments([]);
    setMissingCheck(null);
    setDuplicatesResult(null);

    try {
      const [histRes, attRes, missRes, dupRes] = await Promise.all([
        getApprovalHistory(record.id),
        getAttachments(record.id),
        getMissingCheck(record.id),
        getDuplicates(record.id)
      ]).catch(err => {
        console.error('部分加载失败:', err);
        return [null, null, null, null] as const;
      });

      if (histRes?.success) setApprovalHistory(histRes.data || []);
      if (attRes?.success) setAttachments(attRes.data || []);
      if (missRes?.success) setMissingCheck(missRes.data || null);
      if (dupRes?.success) setDuplicatesResult(dupRes.data || null);
    } catch (error) {
      console.error('加载详情失败:', error);
    }
    setDetailLoading(false);
  };

  const handleApprove = (record: Declaration) => {
    setSelectedDeclaration(record);
    form.resetFields();
    form.setFieldsValue({
      approver: currentRole === 'initial' ? '初审员' : currentRole === 'review' ? '复审员' : '终审员',
      comment: ''
    });
    setApproveModalVisible(true);
  };

  const handleReject = (record: Declaration) => {
    setSelectedDeclaration(record);
    form.resetFields();
    form.setFieldsValue({
      approver: currentRole === 'initial' ? '初审员' : currentRole === 'review' ? '复审员' : '终审员',
      comment: ''
    });
    setRejectModalVisible(true);
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

        {missingCheck && missingCheck.missing.length > 0 && (
          <>
            <Divider orientation="left" plain style={{ margin: '16px 0 12px' }}>
              <Space>
                <FileSearchOutlined style={{ color: '#faad14' }} />
                缺失的必填材料 ({missingCheck.missing.length})
              </Space>
            </Divider>
            <Row gutter={[8, 8]}>
              {missingCheck.missing.map(m => (
                <Col key={m.id} span={12}>
                  <div style={{
                    padding: '8px 12px',
                    background: '#fff1f0',
                    border: '1px solid #ffa39e',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                    <span style={{ color: '#cf1322', fontWeight: 500 }}>
                      *{m.name}
                    </span>
                    {m.description && (
                      <Tooltip title={m.description}>
                        <span style={{ color: '#999', fontSize: 12, cursor: 'help' }}>ⓘ</span>
                      </Tooltip>
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </>
        )}

        {missingCheck && missingCheck.complete.length > 0 && (
          <>
            <Divider orientation="left" plain style={{ margin: '16px 0 12px' }}>
              <Space>
                <FileDoneOutlined style={{ color: '#52c41a' }} />
                已提交的材料 ({missingCheck.complete.length})
              </Space>
            </Divider>
            <Row gutter={[8, 8]}>
              {missingCheck.complete.map(m => (
                <Col key={m.id} span={12}>
                  <div style={{
                    padding: '8px 12px',
                    background: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <CheckOutlined style={{ color: '#52c41a' }} />
                    <span style={{ color: '#389e0d', fontWeight: 500 }}>
                      {m.required && <span style={{ color: '#ff4d4f' }}>*</span>}
                      {m.name}
                    </span>
                    <span style={{ color: '#52c41a', fontSize: 12 }}>
                      ({m.uploaded}份)
                    </span>
                  </div>
                </Col>
              ))}
            </Row>
          </>
        )}

        {duplicatesResult && duplicatesResult.exact_duplicates.groups.length > 0 && (
          <>
            <Divider orientation="left" plain style={{ margin: '16px 0 12px' }}>
              <Space>
                <WarningOutlined style={{ color: '#fa8c16' }} />
                重复文件 ({duplicatesResult.exact_duplicates.group_count} 组)
              </Space>
            </Divider>
            <Alert
              type="warning"
              showIcon
              message="以下文件内容完全相同，建议检查是否需要清理"
              style={{ marginBottom: 8 }}
            />
            {duplicatesResult.exact_duplicates.groups.slice(0, 3).map((group, gi) => (
              <div key={gi} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  第 {gi + 1} 组（{group.length} 个文件）
                </div>
                <List
                  size="small"
                  bordered
                  dataSource={group}
                  renderItem={att => (
                    <List.Item style={{ padding: '4px 12px' }}>
                      <span style={{ fontSize: 14 }}>
                        {getFileIcon(att.original_name.split('.').pop()?.toLowerCase() || '')}
                      </span>
                      <span style={{ marginLeft: 8, fontSize: 13 }}>
                        {att.original_name}
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#999', fontSize: 12 }}>
                        {formatFileSize(att.file_size)}
                      </span>
                    </List.Item>
                  )}
                />
              </div>
            ))}
            {duplicatesResult.exact_duplicates.group_count > 3 && (
              <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
                还有 {duplicatesResult.exact_duplicates.group_count - 3} 组重复文件...
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const attachmentsSummary = (record: Declaration) => {
    const QuickPreviewCard = (
      <div style={{ width: 320 }}>
        <div style={{
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: '1px solid #f0f0f0',
          fontWeight: 500
        }}>
          <Space>
            <PaperClipOutlined />
            材料检查摘要
          </Space>
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          点击"详情"查看完整附件列表和检查结果
        </div>
      </div>
    );

    return (
      <Popover
        content={QuickPreviewCard}
        title={null}
        trigger="hover"
        placement="topLeft"
      >
        <Button
          type="link"
          icon={<PaperClipOutlined />}
          size="small"
          style={{ padding: 0 }}
        >
          附件
        </Button>
      </Popover>
    );
  };

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
      width: 90,
      render: (text: string) => (
        <Tag color={StatusColorMap[text as keyof typeof StatusColorMap]}>
          {StatusMap[text]}
        </Tag>
      )
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
      width: 240,
      render: (_: any, record: Declaration) => (
        <Space size="small" split={<Divider type="vertical" />}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" icon={<PaperClipOutlined />} onClick={() => handleViewDetail(record)}>
            预览附件
          </Button>
          <Button type="link" icon={<CheckOutlined />} onClick={() => handleApprove(record)}>
            通过
          </Button>
          <Button type="link" danger icon={<CloseOutlined />} onClick={() => handleReject(record)}>
            驳回
          </Button>
        </Space>
      )
    }
  ], [currentRole]);

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
      width: 90,
      render: (text: string) => (
        <Tag color={StatusColorMap[text as keyof typeof StatusColorMap]}>
          {StatusMap[text]}
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
        <div>
          <span style={{ marginRight: 12 }}>当前角色：</span>
          <Select
            value={currentRole}
            onChange={setCurrentRole}
            style={{ width: 150 }}
          >
            <Option value="initial">初审员</Option>
            <Option value="review">复审员</Option>
            <Option value="final">终审员</Option>
          </Select>
        </div>
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
            <Table
              columns={pendingColumns}
              dataSource={pendingList}
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
          selectedDeclaration && ['submitted', 'first_reviewed', 'second_reviewed'].includes(selectedDeclaration.status) ? (
            <Space key="actions">
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
                <p><strong>项目名称：</strong>{selectedDeclaration.title}</p>
                <p><strong>申请人：</strong>{selectedDeclaration.applicant}</p>
                <p><strong>企业名称：</strong>{selectedDeclaration.company}</p>
                <p><strong>联系电话：</strong>{selectedDeclaration.phone || '-'}</p>
                <p><strong>电子邮箱：</strong>{selectedDeclaration.email || '-'}</p>
                <p><strong>当前状态：</strong>
                  <Tag color={StatusColorMap[selectedDeclaration.status as keyof typeof StatusColorMap]}>
                    {StatusMap[selectedDeclaration.status]}
                  </Tag>
                </p>
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
                            <span style={{ marginLeft: 8, color: '#999' }}>
                              {record.approver} - {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
                            </span>
                          </div>
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
            name="comment"
            label="审批意见"
          >
            <TextArea rows={4} placeholder="请输入审批意见（可选）" />
          </Form.Item>
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
    </div>
  );
}

export default Approval;
