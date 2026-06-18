import { useState, useEffect, useMemo } from 'react';
import {
  Card, List, Button, Upload, message, Select, Modal, Form, Input,
  Space, Tabs, Checkbox, Progress, Tag, Alert, Table, Row, Col,
  Empty, Tooltip, Badge, Divider
} from 'antd';
import {
  UploadOutlined, InboxOutlined, DownloadOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined,
  FileSearchOutlined, FileDoneOutlined, FileSyncOutlined,
  FolderOpenOutlined, EyeOutlined, PaperClipOutlined,
  CloudDownloadOutlined, FileProtectOutlined, AuditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeclarations, createDeclaration } from '../api/declarations';
import {
  getAttachments, uploadAttachments, deleteAttachment, downloadAttachment,
  getMaterialTypes, getMissingCheck, getDuplicates,
  batchDownloadAttachments, updateAttachmentMaterialType, validateAttachments
} from '../api/attachments';
import type {
  Declaration, Attachment, MaterialType, MissingCheckResult,
  DuplicatesResult, ValidationResult
} from '../types';

const { Dragger } = Upload;
const { Option } = Select;
const { TabPane } = Tabs;

interface UploadFileItem {
  file: File;
  material_type_id: number | null;
  valid?: boolean;
  errors?: string[];
  warnings?: string[];
}

function AttachmentDemo() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<number | null>(null);
  const [selectedDeclaration, setSelectedDeclaration] = useState<Declaration | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [missingCheck, setMissingCheck] = useState<MissingCheckResult | null>(null);
  const [duplicatesResult, setDuplicatesResult] = useState<DuplicatesResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<UploadFileItem[]>([]);
  const [uploadMaterialTypeId, setUploadMaterialTypeId] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadDeclarations();
    loadMaterialTypes();
  }, []);

  useEffect(() => {
    if (selectedDeclarationId) {
      loadAttachments(selectedDeclarationId);
      runChecks(selectedDeclarationId);
      const dec = declarations.find(d => d.id === selectedDeclarationId);
      setSelectedDeclaration(dec || null);
    } else {
      setAttachments([]);
      setMissingCheck(null);
      setDuplicatesResult(null);
      setSelectedDeclaration(null);
      setSelectedRowKeys([]);
    }
  }, [selectedDeclarationId, declarations]);

  const loadDeclarations = async () => {
    try {
      const res = await getDeclarations({ status: 'draft' });
      if (res.success) {
        setDeclarations(res.data || []);
        if (res.data && res.data.length > 0 && !selectedDeclarationId) {
          setSelectedDeclarationId(res.data[0].id);
        }
      }
    } catch (error) {
      message.error('加载申报列表失败');
    }
  };

  const loadMaterialTypes = async (guidelineId?: number) => {
    try {
      const res = await getMaterialTypes(guidelineId);
      if (res.success) {
        setMaterialTypes(res.data || []);
      }
    } catch (error) {
      console.error('加载材料类型失败:', error);
    }
  };

  const loadAttachments = async (declarationId: number) => {
    setLoading(true);
    try {
      const res = await getAttachments(declarationId);
      if (res.success) {
        setAttachments(res.data || []);
      }
    } catch (error) {
      message.error('加载附件失败');
    }
    setLoading(false);
  };

  const runChecks = async (declarationId: number) => {
    setCheckLoading(true);
    try {
      const [missingRes, dupRes] = await Promise.all([
        getMissingCheck(declarationId),
        getDuplicates(declarationId)
      ]);
      if (missingRes.success) setMissingCheck(missingRes.data || null);
      if (dupRes.success) setDuplicatesResult(dupRes.data || null);
    } catch (error) {
      console.error('检查失败:', error);
    }
    setCheckLoading(false);
  };

  const handleCreateDeclaration = async () => {
    try {
      const values = await form.validateFields();
      const res = await createDeclaration({
        ...values,
        applicant: '演示用户',
        company: '演示公司'
      });
      if (res.success) {
        message.success('创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadDeclarations();
        setTimeout(() => {
          setSelectedDeclarationId(res.data!.id);
        }, 100);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const beforeUpload = (file: File, fileList: File[]) => {
    if (!selectedDeclarationId) {
      message.warning('请先选择或创建一个申报');
      return Upload.LIST_IGNORE;
    }
    const newItems: UploadFileItem[] = fileList.map(f => ({
      file: f,
      material_type_id: uploadMaterialTypeId
    }));
    handleAddFiles(newItems);
    return Upload.LIST_IGNORE;
  };

  const handleAddFiles = async (newItems: UploadFileItem[]) => {
    if (!selectedDeclarationId) return;

    setValidating(true);
    try {
      const validateData = newItems.map(item => ({
        name: item.file.name,
        size: item.file.size,
        material_type_id: item.material_type_id
      }));
      const valRes = await validateAttachments(selectedDeclarationId, validateData);
      if (valRes.success && valRes.data) {
        const validatedItems = newItems.map((item, idx) => ({
          ...item,
          valid: valRes.data!.results[idx]?.valid ?? true,
          errors: valRes.data!.results[idx]?.errors || [],
          warnings: valRes.data!.results[idx]?.warnings || []
        }));
        setPendingFiles(prev => [...prev, ...validatedItems]);

        const invalidCount = validatedItems.filter(i => !i.valid).length;
        const warningCount = validatedItems.filter(i => i.warnings?.length).length;
        if (invalidCount > 0) {
          message.warning(`${invalidCount} 个文件未通过校验`);
        } else if (warningCount > 0) {
          message.info(`${warningCount} 个文件有警告提示`);
        }
      } else {
        setPendingFiles(prev => [...prev, ...newItems]);
      }
    } catch (error) {
      setPendingFiles(prev => [...prev, ...newItems]);
    }
    setValidating(false);
  };

  const handleUploadPending = async () => {
    if (!selectedDeclarationId || pendingFiles.length === 0) return;

    const invalidFiles = pendingFiles.filter(f => !f.valid);
    if (invalidFiles.length > 0) {
      Modal.confirm({
        title: '存在未通过校验的文件',
        content: `有 ${invalidFiles.length} 个文件未通过校验，是否仍要上传？未通过校验的文件将被跳过。`,
        okText: '确认上传',
        cancelText: '取消',
        onOk: async () => {
          await doUpload(pendingFiles.filter(f => f.valid !== false));
        }
      });
      return;
    }

    await doUpload(pendingFiles);
  };

  const doUpload = async (items: UploadFileItem[]) => {
    if (!selectedDeclarationId || items.length === 0) return;

    setLoading(true);
    try {
      const files = items.map(i => i.file);
      const materialTypeIds = items.map(i => i.material_type_id);
      const res = await uploadAttachments(selectedDeclarationId, files, materialTypeIds);

      if (res.success && res.data) {
        const { uploadedCount, duplicateCount, warnings, duplicates } = res.data;

        if (warnings && warnings.length > 0) {
          warnings.forEach(w => message.warning(w));
        }

        if (duplicates && duplicates.length > 0) {
          Modal.info({
            title: `发现 ${duplicateCount} 个重复文件`,
            content: (
              <div>
                <p>以下文件与已上传的文件内容完全相同，已自动跳过：</p>
                <ul>
                  {duplicates.map((d, i) => (
                    <li key={i}>
                      <strong>{d.new_file}</strong>
                      <span style={{ color: '#999' }}>
                        {' '}→ 已有: {d.existing_file}
                        {d.material_type_name && ` (${d.material_type_name})`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          });
        }

        message.success(
          duplicateCount > 0
            ? `成功上传 ${uploadedCount} 个文件，跳过 ${duplicateCount} 个重复文件`
            : `成功上传 ${uploadedCount} 个文件`
        );

        setPendingFiles([]);
        await loadAttachments(selectedDeclarationId);
        await runChecks(selectedDeclarationId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
    }
    setLoading(false);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updatePendingMaterialType = (index: number, materialTypeId: number | null) => {
    setPendingFiles(prev => prev.map((item, i) =>
      i === index ? { ...item, material_type_id: materialTypeId } : item
    ));
  };

  const handleDelete = (attachment: Attachment) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除附件"${attachment.original_name}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteAttachment(attachment.id);
          if (res.success) {
            message.success('删除成功');
            if (selectedDeclarationId) {
              await loadAttachments(selectedDeclarationId);
              await runChecks(selectedDeclarationId);
            }
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleBatchDownload = () => {
    if (!selectedDeclarationId) return;
    const ids = selectedRowKeys.length > 0 ? selectedRowKeys : undefined;
    if (attachments.length === 0) {
      message.warning('暂无可下载的附件');
      return;
    }
    try {
      batchDownloadAttachments(selectedDeclarationId, ids);
      message.success('已开始下载');
    } catch (error) {
      message.error('下载失败');
    }
  };

  const handleChangeMaterialType = async (attachmentId: number, materialTypeId: number | null) => {
    try {
      const res = await updateAttachmentMaterialType(attachmentId, materialTypeId);
      if (res.success) {
        message.success('已更新材料类型');
        if (selectedDeclarationId) {
          await loadAttachments(selectedDeclarationId);
          await runChecks(selectedDeclarationId);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const rowSelection = useMemo(() => ({
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[])
  }), [selectedRowKeys]);

  const getFileIcon = (ext: string) => {
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return '🖼️';
    if (['zip', 'rar'].includes(ext)) return '🗜️';
    return '📎';
  };

  const materialTypeTag = (mt: MaterialType | Attachment) => {
    const required = 'required' in mt ? mt.required : mt.material_type_required;
    const name = 'name' in mt ? mt.name : (mt.material_type_name || '未分类');
    return (
      <Tag color={required ? 'red' : 'blue'} style={{ margin: 0 }}>
        {required && <RequiredStar />}
        {name}
      </Tag>
    );
  };

  const RequiredStar = () => (
    <span style={{ color: '#ff4d4f', marginRight: 2 }}>*</span>
  );

  const missingCheckPanel = missingCheck && (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <StatItem
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              label="必填完成"
              value={`${missingCheck.stats.required_complete}/${missingCheck.stats.required_total}`}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <StatItem
              icon={<FileSyncOutlined style={{ color: '#1890ff' }} />}
              label="材料完整度"
              value={`${missingCheck.stats.completion_rate}%`}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <StatItem
              icon={<PaperClipOutlined style={{ color: '#722ed1' }} />}
              label="附件总数"
              value={missingCheck.stats.attachments_total}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16 }}>
        <Progress
          percent={missingCheck.stats.completion_rate}
          status={missingCheck.stats.is_complete ? 'success' : 'active'}
          showInfo={true}
        />
      </div>

      {missingCheck.stats.required_missing > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`缺少 ${missingCheck.stats.required_missing} 项必填材料`}
          description="请上传以下必填材料后再提交申报"
          style={{ marginBottom: 16 }}
        />
      )}

      {missingCheck.missing.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              <span>缺失的必填材料 ({missingCheck.missing.length})</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <List
            size="small"
            dataSource={missingCheck.missing}
            renderItem={item => (
              <List.Item>
                <Space>
                  <Tag color="red" style={{ margin: 0 }}>
                    <RequiredStar />{item.name}
                  </Tag>
                  <span style={{ color: '#666' }}>{item.description}</span>
                  {item.allowed_extensions.length > 0 && (
                    <Tag color="default">支持: {item.allowed_extensions.join(', ')}</Tag>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {missingCheck.complete.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <FileDoneOutlined style={{ color: '#52c41a' }} />
              <span>已上传的材料 ({missingCheck.complete.length})</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <List
            size="small"
            dataSource={missingCheck.complete}
            renderItem={item => (
              <List.Item>
                <Space>
                  <Tag color={item.required ? 'green' : 'blue'} style={{ margin: 0 }}>
                    {item.required && <RequiredStar />}
                    {item.name}
                  </Tag>
                  <span style={{ color: '#52c41a' }}>
                    <CheckCircleOutlined /> 已上传 {item.uploaded} 份
                  </span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {missingCheck.uncategorized.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={`有 ${missingCheck.uncategorized.length} 个附件未分类`}
          description="建议为这些附件设置材料类型，便于检查和管理"
        />
      )}
    </div>
  );

  const duplicatesPanel = duplicatesResult && (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small">
            <StatItem
              icon={<WarningOutlined style={{ color: '#faad14' }} />}
              label="完全重复"
              value={duplicatesResult.exact_duplicates.duplicate_count > 0 ? `${duplicatesResult.exact_duplicates.duplicate_count} 个文件 / ${duplicatesResult.exact_duplicates.group_count} 组` : '无'}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <StatItem
              icon={<FileSearchOutlined style={{ color: '#fa8c16' }} />}
              label="疑似重复"
              value={duplicatesResult.potential_duplicates.duplicate_count > 0 ? `${duplicatesResult.potential_duplicates.duplicate_count} 个文件 / ${duplicatesResult.potential_duplicates.group_count} 组` : '无'}
            />
          </Card>
        </Col>
      </Row>

      {duplicatesResult.exact_duplicates.group_count === 0 && duplicatesResult.potential_duplicates.group_count === 0 && (
        <ResultEmpty
          icon={<CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />}
          title="未发现重复文件"
          description="当前所有附件均为独立文件"
        />
      )}

      {duplicatesResult.exact_duplicates.group_count > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              <span>完全重复的文件 (内容完全相同)</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {duplicatesResult.exact_duplicates.groups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: gi < group.length - 1 ? 12 : 0 }}>
              <div style={{ marginBottom: 8 }}>
                <Tag color="orange">第 {gi + 1} 组，共 {group.length} 个文件</Tag>
              </div>
              <List
                size="small"
                bordered
                dataSource={group}
                renderItem={att => (
                  <List.Item>
                    <Space>
                      <span>{getFileIcon(att.original_name.split('.').pop()?.toLowerCase() || '')}</span>
                      <span style={{ fontWeight: 500 }}>{att.original_name}</span>
                      <span style={{ color: '#999' }}>{formatFileSize(att.file_size)}</span>
                      {att.material_type_name && (
                        <Tag>{att.material_type_name}</Tag>
                      )}
                      <span style={{ color: '#999', fontSize: 12 }}>
                        上传于 {dayjs(att.uploaded_at).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          ))}
        </Card>
      )}

      {duplicatesResult.potential_duplicates.group_count > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <FileSearchOutlined style={{ color: '#fa8c16' }} />
              <span>疑似重复的文件 (文件名和大小相同，建议检查)</span>
            </Space>
          }
        >
          {duplicatesResult.potential_duplicates.groups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: gi < group.length - 1 ? 12 : 0 }}>
              <div style={{ marginBottom: 8 }}>
                <Tag color="gold">第 {gi + 1} 组，共 {group.length} 个文件</Tag>
              </div>
              <List
                size="small"
                bordered
                dataSource={group}
                renderItem={att => (
                  <List.Item>
                    <Space>
                      <span>{getFileIcon(att.original_name.split('.').pop()?.toLowerCase() || '')}</span>
                      <span style={{ fontWeight: 500 }}>{att.original_name}</span>
                      <span style={{ color: '#999' }}>{formatFileSize(att.file_size)}</span>
                      {att.material_type_name && (
                        <Tag>{att.material_type_name}</Tag>
                      )}
                      <span style={{ color: '#999', fontSize: 12 }}>
                        上传于 {dayjs(att.uploaded_at).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  const pendingList = (
    <Card
      title={
        <Space>
          <UploadOutlined />
          <span>待上传文件 ({pendingFiles.length})</span>
          {validating && <span style={{ color: '#1890ff' }}>校验中...</span>}
        </Space>
      }
      extra={
        pendingFiles.length > 0 && (
          <Space>
            <Button onClick={() => setPendingFiles([])}>
              清空
            </Button>
            <Button type="primary" onClick={handleUploadPending} loading={loading}>
              确认上传
            </Button>
          </Space>
        )
      }
      style={{ marginBottom: 16 }}
    >
      {pendingFiles.length === 0 ? (
        <Empty
          description="请在上方选择文件进行上传"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          size="small"
          dataSource={pendingFiles}
          renderItem={(item, index) => {
            const ext = item.file.name.split('.').pop()?.toLowerCase() || '';
            return (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    danger
                    size="small"
                    onClick={() => removePendingFile(index)}
                  >
                    移除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<span style={{ fontSize: 24 }}>{getFileIcon(ext)}</span>}
                  title={
                    <Space>
                      <span>{item.file.name}</span>
                      {!item.valid && (
                        <Tag color="red">未通过校验</Tag>
                      )}
                      {item.valid && item.warnings && item.warnings.length > 0 && (
                        <Tag color="orange">有警告</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#666' }}>{formatFileSize(item.file.size)}</span>
                        <Divider type="vertical" />
                        <Select
                          size="small"
                          style={{ width: 200 }}
                          value={item.material_type_id}
                          onChange={(val) => updatePendingMaterialType(index, val as number | null)}
                          placeholder="选择材料类型"
                          allowClear
                        >
                          {materialTypes.map(mt => (
                            <Option key={mt.id} value={mt.id}>
                              {mt.required && ' *'}{mt.name}
                            </Option>
                          ))}
                        </Select>
                      </div>
                      {item.errors && item.errors.length > 0 && (
                        <div style={{ color: '#ff4d4f', fontSize: 12 }}>
                          ❌ {item.errors.join('；')}
                        </div>
                      )}
                      {item.warnings && item.warnings.length > 0 && (
                        <div style={{ color: '#faad14', fontSize: 12 }}>
                          ⚠️ {item.warnings.join('；')}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );

  const attachmentsTable = (
    <Card
      title={
        <Space>
          <FolderOpenOutlined />
          <span>附件列表 ({attachments.length})</span>
          {selectedRowKeys.length > 0 && (
            <Tag color="blue">已选 {selectedRowKeys.length} 个</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<AuditOutlined />}
            onClick={() => selectedDeclarationId && runChecks(selectedDeclarationId)}
            loading={checkLoading}
          >
            刷新检查
          </Button>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleBatchDownload}
            disabled={attachments.length === 0}
          >
            {selectedRowKeys.length > 0 ? `下载选中 (${selectedRowKeys.length})` : '全部下载'}
          </Button>
        </Space>
      }
      loading={loading}
    >
      {attachments.length > 0 ? (
        <Table
          rowKey="id"
          rowSelection={rowSelection}
          dataSource={attachments}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '文件名',
              dataIndex: 'original_name',
              key: 'original_name',
              ellipsis: true,
              render: (text, record) => {
                const ext = text.split('.').pop()?.toLowerCase() || '';
                return (
                  <Space>
                    <span style={{ fontSize: 20 }}>{getFileIcon(ext)}</span>
                    <Tooltip title={text}>
                      <span>{text}</span>
                    </Tooltip>
                    {record.material_type_required && (
                      <Badge color="red" />
                    )}
                  </Space>
                );
              }
            },
            {
              title: '材料类型',
              dataIndex: 'material_type_name',
              key: 'material_type',
              width: 180,
              render: (_, record) => (
                <Select
                  size="small"
                  style={{ width: 160 }}
                  value={record.material_type_id}
                  onChange={(val) => handleChangeMaterialType(record.id, val as number | null)}
                  placeholder="未分类"
                  allowClear
                >
                  {materialTypes.map(mt => (
                    <Option key={mt.id} value={mt.id}>
                      {mt.required && ' *'}{mt.name}
                    </Option>
                  ))}
                </Select>
              )
            },
            {
              title: '大小',
              dataIndex: 'file_size',
              key: 'file_size',
              width: 100,
              render: (val) => formatFileSize(val)
            },
            {
              title: '上传时间',
              dataIndex: 'uploaded_at',
              key: 'uploaded_at',
              width: 160,
              render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
            },
            {
              title: '操作',
              key: 'actions',
              width: 140,
              render: (_, record) => (
                <Space size="small">
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => window.open(downloadAttachment(record.id))}
                  >
                    预览
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => window.open(downloadAttachment(record.id))}
                  >
                    下载
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(record)}
                  >
                    删除
                  </Button>
                </Space>
              )
            }
          ]}
        />
      ) : (
        <Empty
          description={selectedDeclarationId ? '暂无附件，请上传' : '请先选择一个申报项目'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">附件管理中心</h2>
        <Button type="primary" onClick={() => setCreateModalVisible(true)}>
          新建申报
        </Button>
      </div>

      <Card title="选择申报项目" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span>当前申报项目：</span>
          <Select
            value={selectedDeclarationId}
            onChange={setSelectedDeclarationId}
            style={{ width: 400 }}
            placeholder="请选择一个草稿状态的申报"
            showSearch
            optionFilterProp="children"
          >
            {declarations.map(d => (
              <Option key={d.id} value={d.id}>{d.title}</Option>
            ))}
          </Select>
          <span style={{ color: '#999' }}>
            （共 {declarations.length} 个草稿）
          </span>
          {missingCheck && (
            <Space>
              <Tag color={missingCheck.stats.is_complete ? 'green' : 'orange'}>
                <FileProtectOutlined /> 完整度 {missingCheck.stats.completion_rate}%
              </Tag>
            </Space>
          )}
        </div>
      </Card>

      {selectedDeclarationId && (
        <Card
          title={
            <Space>
              <UploadOutlined />
              <span>上传附件</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              <span>上传时设置材料类型：</span>
              <Select
                style={{ width: 200 }}
                value={uploadMaterialTypeId}
                onChange={setUploadMaterialTypeId}
                placeholder="批量设置类型"
                allowClear
              >
                {materialTypes.map(mt => (
                  <Option key={mt.id} value={mt.id}>
                    {mt.required && ' *'}{mt.name}
                  </Option>
                ))}
              </Select>
            </Space>
          }
        >
          <Dragger
            multiple
            beforeUpload={beforeUpload}
            showUploadList={false}
            disabled={!selectedDeclarationId}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
            style={{ background: '#fafafa' }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域添加到待上传列表</p>
            <p className="ant-upload-hint">
              支持 PDF、Word、Excel、图片、压缩包等格式，单个文件不超过 50MB。
              上传前会自动按材料类型校验，重复文件自动识别。
            </p>
          </Dragger>
        </Card>
      )}

      {pendingFiles.length > 0 && pendingList}

      {selectedDeclarationId && (
        <Tabs defaultActiveKey="list" style={{ marginBottom: 16 }}>
          <TabPane
            tab={
              <Space>
                <FolderOpenOutlined />
                附件列表
                {attachments.length > 0 && <Badge count={attachments.length} size="small" />}
              </Space>
            }
            key="list"
          >
            {attachmentsTable}
          </TabPane>

          <TabPane
            tab={
              <Space>
                <FileSearchOutlined />
                缺失检查
                {missingCheck?.stats.required_missing && missingCheck.stats.required_missing > 0 && (
                  <Badge count={missingCheck.stats.required_missing} size="small" color="#faad14" />
                )}
              </Space>
            }
            key="missing"
          >
            {missingCheck ? missingCheckPanel : (
              <ResultEmpty title="请稍候..." />
            )}
          </TabPane>

          <TabPane
            tab={
              <Space>
                <FileSyncOutlined />
                重复检测
                {(duplicatesResult?.exact_duplicates.duplicate_count || 0) + (duplicatesResult?.potential_duplicates.duplicate_count || 0) > 0 && (
                  <Badge
                    count={(duplicatesResult?.exact_duplicates.duplicate_count || 0) + (duplicatesResult?.potential_duplicates.duplicate_count || 0)}
                    size="small"
                    color="#fa8c16"
                  />
                )}
              </Space>
            }
            key="duplicates"
          >
            {duplicatesResult ? duplicatesPanel : (
              <ResultEmpty title="请稍候..." />
            )}
          </TabPane>
        </Tabs>
      )}

      <Modal
        title="新建申报"
        open={createModalVisible}
        onOk={handleCreateDeclaration}
        onCancel={() => setCreateModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item
            name="content"
            label="项目简介"
          >
            <Input.TextArea rows={3} placeholder="请输入项目简介" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div>
        <div style={{ color: '#666', fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function ResultEmpty({ icon, title, description }: { icon?: React.ReactNode; title: string; description?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      {icon && <div style={{ marginBottom: 16 }}>{icon}</div>}
      <div style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>{title}</div>
      {description && <div style={{ color: '#999' }}>{description}</div>}
    </div>
  );
}

export default AttachmentDemo;
