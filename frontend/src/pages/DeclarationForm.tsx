import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card, Form, Input, Select, Button, message, Steps, Upload, List, Tag, Space, Modal,
  Drawer, Timeline, Tooltip, Empty, Tabs, Alert, Divider, Row, Col, Statistic, Badge
} from 'antd';
import {
  ArrowLeftOutlined, UploadOutlined, InboxOutlined, DeleteOutlined, DownloadOutlined,
  SaveOutlined, HistoryOutlined, RollbackOutlined, DiffOutlined, ClockCircleOutlined,
  ThunderboltOutlined, ReloadOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getGuidelines } from '../api/guidelines';
import { getDeclaration, createDeclaration, updateDeclaration, submitDeclaration } from '../api/declarations';
import { getAttachments, uploadAttachments, deleteAttachment, downloadAttachment } from '../api/attachments';
import {
  autosaveDraft, saveVersion as saveVersionApi, getVersions, compareVersions,
  restoreVersion as restoreVersionApi, getSaveTypes, previewRestoreVersion
} from '../api/versions';
import type {
  Guideline, Declaration, Attachment, DeclarationVersion, DiffCompareResult,
  SaveTypeOption, VersionsListResponse, FieldDiff, RestorePreviewResult
} from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

const AUTO_SAVE_INTERVAL = 30000;
const SAVE_TYPE_STYLE: Record<string, { color: string; bg: string }> = {
  auto: { color: '#8c8c8c', bg: '#f5f5f5' },
  manual: { color: '#1890ff', bg: '#e6f7ff' },
  submit: { color: '#52c41a', bg: '#f6ffed' },
  status_change: { color: '#722ed1', bg: '#f9f0ff' },
  rollback: { color: '#fa8c16', bg: '#fff7e6' },
  restore: { color: '#eb2f96', bg: '#fff0f6' }
};

function DeclarationForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [uploading, setUploading] = useState(false);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [saveTypeOptions, setSaveTypeOptions] = useState<SaveTypeOption[]>([]);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFormValuesRef = useRef<any>(null);
  const isManualSaveRef = useRef(false);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [versions, setVersions] = useState<VersionsListResponse | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<DeclarationVersion | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<DiffCompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareParams, setCompareParams] = useState<{ v1?: number; v2?: number; type: 'versions' | 'current_vs_version' }>({ type: 'current_vs_version' });
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreviewResult | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<DeclarationVersion | null>(null);

  useEffect(() => {
    loadGuidelines();
    loadSaveTypes();
    if (isEdit) {
      loadDeclaration();
    } else {
      lastFormValuesRef.current = {};
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [id]);

  useEffect(() => {
    if (isEdit && declaration?.status === 'draft' && autoSaveEnabled) {
      startAutoSave();
    } else {
      stopAutoSave();
    }
    return () => stopAutoSave();
  }, [isEdit, declaration?.status, autoSaveEnabled]);

  const loadSaveTypes = async () => {
    try {
      const res = await getSaveTypes();
      if (res.success) setSaveTypeOptions(res.data || []);
    } catch (e) {}
  };

  const startAutoSave = () => {
    stopAutoSave();
    autoSaveTimerRef.current = setInterval(runAutoSave, AUTO_SAVE_INTERVAL);
  };

  const stopAutoSave = () => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  };

  const runAutoSave = async () => {
    if (!declaration || declaration.status !== 'draft') return;
    if (isManualSaveRef.current) {
      isManualSaveRef.current = false;
      return;
    }
    try {
      const currentValues = form.getFieldsValue(true);
      const currentId = declaration.id;
      const hasChanges = checkFormChanged(currentValues);
      if (!hasChanges) return;

      setAutoSaveStatus('saving');
      const res = await autosaveDraft(currentId, currentValues);
      if (res.success) {
        if (!res.skipped) {
          lastFormValuesRef.current = { ...currentValues };
          setLastAutoSaveAt(new Date());
          setVersionCount(res.data?.version_number || versionCount);
          if (declaration) {
            setDeclaration({ ...declaration, ...currentValues, version_count: res.data?.version_number, last_auto_save_at: res.data?.saved_at });
          }
        }
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    } catch (error: any) {
      setAutoSaveStatus('error');
      console.error('自动保存失败:', error);
    }
  };

  const checkFormChanged = (currentValues: any): boolean => {
    const last = lastFormValuesRef.current || {};
    const fields = ['title', 'guideline_id', 'applicant', 'company', 'phone', 'email', 'content'];
    return fields.some(f => {
      const a = last[f];
      const b = currentValues[f];
      return (a ?? '') !== (b ?? '');
    });
  };

  const loadGuidelines = async () => {
    try {
      const res = await getGuidelines();
      if (res.success) setGuidelines(res.data || []);
    } catch (error) {
      console.error('加载申报指南失败:', error);
    }
  };

  const loadDeclaration = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getDeclaration(parseInt(id));
      if (res.success && res.data) {
        setDeclaration(res.data);
        form.setFieldsValue(res.data);
        lastFormValuesRef.current = {
          title: res.data.title,
          guideline_id: res.data.guideline_id,
          applicant: res.data.applicant,
          company: res.data.company,
          phone: res.data.phone,
          email: res.data.email,
          content: res.data.content
        };
        setVersionCount(res.data.version_count || 0);
        if (res.data.last_auto_save_at) setLastAutoSaveAt(new Date(res.data.last_auto_save_at));
        loadAttachments(parseInt(id));
      }
    } catch (error: any) {
      if (error.response?.status === 410) {
        Modal.warning({
          title: '申报已删除',
          content: error.response?.data?.message || '该申报已被删除，可在回收站中恢复',
          onOk: () => navigate('/declarations')
        });
      } else {
        message.error('加载申报信息失败');
      }
    }
    setLoading(false);
  };

  const loadAttachments = async (declarationId: number) => {
    try {
      const res = await getAttachments(declarationId);
      if (res.success) setAttachments(res.data || []);
    } catch (error) {
      console.error('加载附件失败:', error);
    }
  };

  const handleUpload = async (fileList: File[]) => {
    if (!declaration && !isEdit) {
      message.warning('请先保存申报信息后再上传附件');
      return;
    }
    const declarationId = id ? parseInt(id) : declaration?.id;
    if (!declarationId) return;
    setUploading(true);
    try {
      const res = await uploadAttachments(declarationId, fileList);
      if (res.success) {
        message.success('上传成功');
        loadAttachments(declarationId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
    }
    setUploading(false);
  };

  const handleDeleteAttachment = (attachment: Attachment) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除附件"${attachment.original_name}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteAttachment(attachment.id);
          if (res.success) {
            message.success('删除成功');
            const declarationId = id ? parseInt(id) : declaration?.id;
            if (declarationId) loadAttachments(declarationId);
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      isManualSaveRef.current = true;
      let res;
      if (isEdit && id) {
        res = await updateDeclaration(parseInt(id), values);
        if (res.success && !res.data?.skipped) {
          message.success(`保存成功！当前版本 v${res.data?.version_number}`);
          setVersionCount(res.data?.version_number || versionCount);
          if (declaration) {
            setDeclaration({ ...declaration, ...values, version_count: res.data?.version_number });
          }
          lastFormValuesRef.current = { ...values };
        } else if (res.data?.skipped) {
          message.info('内容无变化');
        }
      } else {
        res = await createDeclaration(values);
        if (res.success && res.data) {
          message.success('创建成功！');
          setDeclaration({ ...values, id: res.data.id, status: res.data.status, version_count: res.data.version_number } as Declaration);
          navigate(`/declarations/${res.data.id}/edit`, { replace: true });
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!id && !declaration?.id) {
      message.warning('请先保存申报信息');
      return;
    }
    const declarationId = id ? parseInt(id) : declaration?.id;
    if (!declarationId) return;

    Modal.confirm({
      title: '确认提交',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要提交申报吗？提交后将进入审批流程，无法再编辑。</p>
          <Alert type="warning" message="提交前请确保所有内容已保存" showIcon style={{ marginTop: 8 }} />
        </div>
      ),
      onOk: async () => {
        try {
          const res = await submitDeclaration(declarationId);
          if (res.success) {
            message.success('提交成功');
            navigate('/declarations');
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '提交失败');
        }
      }
    });
  };

  const openHistoryDrawer = async () => {
    setHistoryDrawerOpen(true);
    loadVersions(1);
  };

  const loadVersions = async (page = 1) => {
    if (!declaration?.id) return;
    setVersionsLoading(true);
    try {
      const res = await getVersions(declaration.id, { page, pageSize: 20 });
      if (res.success) {
        setVersions(res.data);
      }
    } catch (e) {
      message.error('加载版本历史失败');
    }
    setVersionsLoading(false);
  };

  const handleCompare = (version: DeclarationVersion) => {
    setSelectedVersion(version);
    setCompareParams({ v1: version.version_number, type: 'current_vs_version' });
    setCompareModalOpen(true);
    runCompare(version.version_number, undefined, 'current_vs_version');
  };

  const handleCompareTwoVersions = (v1: number, v2: number) => {
    setCompareParams({ v1, v2, type: 'versions' });
    runCompare(v1, v2, 'versions');
  };

  const runCompare = async (v1?: number, v2?: number, type: 'versions' | 'current_vs_version' = 'current_vs_version') => {
    if (!declaration?.id) return;
    setCompareLoading(true);
    try {
      const res = await compareVersions({
        declaration_id: declaration.id,
        version1: v1,
        version2: v2,
        type
      });
      if (res.success) {
        setCompareResult(res.data);
      }
    } catch (e) {
      message.error('对比失败');
    }
    setCompareLoading(false);
  };

  const handleClickRestore = async (version: DeclarationVersion) => {
    if (!declaration?.id) return;
    setRestoreVersion(version);
    setRestoreModalOpen(true);
    setRestoreLoading(true);
    try {
      const res = await previewRestoreVersion(declaration.id, version.version_number);
      if (res.success) setRestorePreview(res.data);
    } catch (e) {
      message.error('加载恢复预览失败');
    }
    setRestoreLoading(false);
  };

  const confirmRestore = async () => {
    if (!restoreVersion) return;
    Modal.confirm({
      title: '确认恢复版本',
      content: `确定要恢复到版本 v${restoreVersion.version_number} 吗？恢复后将生成一个新版本。`,
      onOk: async () => {
        setRestoreLoading(true);
        try {
          const res = await restoreVersionApi(restoreVersion.id);
          if (res.success) {
            message.success(`版本恢复成功！新生成版本 v${res.data?.new_version_number}`);
            setRestoreModalOpen(false);
            loadDeclaration();
            loadVersions(1);
          }
        } catch (e: any) {
          message.error(e.response?.data?.message || '恢复失败');
        }
        setRestoreLoading(false);
      }
    });
  };

  const beforeUpload = (file: File, fileList: File[]) => {
    handleUpload(fileList);
    return false;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const renderAutoSaveBadge = () => {
    const statusConfig: Record<string, { text: string; color: string }> = {
      idle: lastAutoSaveAt ? { text: `上次保存 ${formatRelativeTime(lastAutoSaveAt)}`, color: '#8c8c8c' } : { text: '自动保存已开启', color: '#52c41a' },
      saving: { text: '正在保存...', color: '#1890ff' },
      saved: { text: '已保存 ✓', color: '#52c41a' },
      error: { text: '保存失败', color: '#ff4d4f' }
    };
    const cfg = statusConfig[autoSaveStatus];
    return <span style={{ color: cfg.color, fontSize: 12 }}>{cfg.text}</span>;
  };

  const formatRelativeTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleString();
  };

  const getSaveTypeLabel = (type: string) => {
    const opt = saveTypeOptions.find(o => o.value === type);
    return opt ? `${opt.icon} ${opt.label}` : type;
  };

  const renderDiffView = (diff: DiffCompareResult | null) => {
    if (!diff) return null;
    if (!diff.diff.has_changes) {
      return <Empty description="两个版本内容无差异" />;
    }
    return (
      <div>
        <Alert
          type="info"
          showIcon
          message={diff.diff.summary}
          style={{ marginBottom: 16 }}
        />
        <Tabs
          items={diff.diff.changes.map((change: FieldDiff) => ({
            key: change.field,
            label: (
              <span>
                {change.field_label}
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {change.line_diff.added > 0 && `+${change.line_diff.added} `}
                  {change.line_diff.removed > 0 && `-${change.line_diff.removed}`}
                </Tag>
              </span>
            ),
            children: <DiffFieldView change={change} />
          }))}
        />
      </div>
    );
  };

  const renderVersionList = () => {
    if (!versions?.list?.length) {
      return <Empty description="暂无版本历史" />;
    }
    return (
      <Timeline
        mode="left"
        style={{ padding: '16px 0' }}
        items={versions.list.map((v) => {
          const style = SAVE_TYPE_STYLE[v.save_type] || SAVE_TYPE_STYLE.manual;
          return {
            dot: <span style={{ fontSize: 16 }}>{saveTypeOptions.find(o => o.value === v.save_type)?.icon || '💾'}</span>,
            color: style.color,
            children: (
              <Card
                size="small"
                style={{ marginBottom: 8, borderLeft: `3px solid ${style.color}` }}
                title={
                  <Space>
                    <Badge color={style.color} text={<strong>v{v.version_number}</strong>} />
                    <Tag color={style.bg} style={{ color: style.color, border: 'none' }}>
                      {getSaveTypeLabel(v.save_type)}
                    </Tag>
                    {v.created_by && <Tag icon={<ClockCircleOutlined />}>{v.created_by}</Tag>}
                  </Space>
                }
                extra={
                  <Space>
                    <Tooltip title="与当前版本对比">
                      <Button size="small" icon={<DiffOutlined />} onClick={() => handleCompare(v)} />
                    </Tooltip>
                    {declaration?.status === 'draft' && v.save_type !== 'rollback' && (
                      <Tooltip title="恢复到此版本">
                        <Button size="small" type="primary" ghost icon={<RollbackOutlined />} onClick={() => handleClickRestore(v)} />
                      </Tooltip>
                    )}
                  </Space>
                }
              >
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  {new Date(v.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: 13 }}>
                  <div><strong>{v.title}</strong></div>
                  {v.change_summary && <div style={{ color: '#555', marginTop: 4 }}>{v.change_summary}</div>}
                </div>
              </Card>
            )
          };
        })}
      />
    );
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/declarations')} />
          <h2 className="page-title" style={{ margin: 0 }}>
            {isEdit ? '编辑申报' : '新建申报'}
          </h2>
          {declaration && (
            <>
              <Tag color={declaration.status === 'draft' ? 'default' : 'blue'}>
                {declaration.status === 'draft' ? '草稿' : '已提交'}
              </Tag>
              {versionCount > 0 && (
                <Tooltip title={`共 ${versionCount} 个历史版本`}>
                  <Tag color="geekblue" icon={<HistoryOutlined />}>v{versionCount}</Tag>
                </Tooltip>
              )}
            </>
          )}
          {declaration?.status === 'draft' && isEdit && (
            <Space size="large">
              <Space>
                <ThunderboltOutlined style={{ color: autoSaveEnabled ? '#52c41a' : '#bfbfbf' }} />
                <Button
                  type="link"
                  size="small"
                  onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                >
                  {autoSaveEnabled ? '关闭自动保存' : '开启自动保存'}
                </Button>
                {autoSaveEnabled && renderAutoSaveBadge()}
              </Space>
            </Space>
          )}
        </div>
        <Space style={{ marginTop: 8 }}>
          {isEdit && (
            <Button icon={<HistoryOutlined />} onClick={openHistoryDrawer}>
              版本历史
            </Button>
          )}
        </Space>
      </div>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="title" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
              <Input placeholder="请输入项目名称" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
            <Form.Item name="guideline_id" label="申报指南">
              <Select placeholder="请选择申报指南" allowClear disabled={declaration?.status !== 'draft' && isEdit}>
                {guidelines.map(g => <Option key={g.id} value={g.id}>{g.title}</Option>)}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="applicant" label="申请人" rules={[{ required: true, message: '请输入申请人' }]}>
              <Input placeholder="请输入申请人姓名" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
            <Form.Item name="company" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }]}>
              <Input placeholder="请输入企业名称" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="phone" label="联系电话">
              <Input placeholder="请输入联系电话" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
            <Form.Item name="email" label="电子邮箱">
              <Input placeholder="请输入电子邮箱" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
          </div>
          <Form.Item name="content" label="项目内容" rules={[{ required: true, message: '请输入项目内容' }]}>
            <TextArea rows={8} placeholder="请详细描述项目内容" disabled={declaration?.status !== 'draft' && isEdit} />
          </Form.Item>
        </Form>
      </Card>

      <Card title="附件材料" style={{ marginBottom: 16 }}>
        {(isEdit || declaration) && (
          <>
            <Dragger multiple beforeUpload={beforeUpload} showUploadList={false} disabled={declaration?.status !== 'draft'} style={{ marginBottom: 16 }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持 PDF、Word、Excel、图片、压缩包等格式，单个文件不超过 10MB</p>
            </Dragger>
            {attachments.length > 0 ? (
              <List
                dataSource={attachments}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button type="link" icon={<DownloadOutlined />} onClick={() => window.open(downloadAttachment(item.id))}>下载</Button>,
                      declaration?.status === 'draft' && (
                        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAttachment(item)}>删除</Button>
                      )
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta title={item.original_name} description={`${formatFileSize(item.file_size)} · 上传于 ${new Date(item.uploaded_at).toLocaleString()}`} />
                  </List.Item>
                )}
              />
            ) : <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>暂无附件</div>}
          </>
        )}
        {!isEdit && !declaration && (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>请先保存申报信息后再上传附件</div>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button onClick={() => navigate('/declarations')}>取消</Button>
        {(!declaration || declaration.status === 'draft') && (
          <>
            <Button icon={<SaveOutlined />} onClick={handleSave} loading={loading}>保存草稿</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>提交申报</Button>
          </>
        )}
      </div>

      <Drawer
        title={
          <Space>
            <HistoryOutlined />
            <span>版本历史</span>
            {versions && <Tag color="geekblue">{versions.total} 个版本</Tag>}
          </Space>
        }
        width={640}
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={() => loadVersions(1)}>刷新</Button>
        }
      >
        {versions?.latest_version && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Statistic title="最新版本" value={`v${versions.latest_version}`} />
            </Col>
            <Col span={12}>
              <Statistic title="版本总数" value={versions.total} />
            </Col>
          </Row>
        )}
        {renderVersionList()}
      </Drawer>

      <Modal
        title={
          <Space>
            <DiffOutlined />
            <span>内容差异对比</span>
          </Space>
        }
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        width={960}
        footer={[
          compareParams.type === 'current_vs_version' && declaration?.status === 'draft' && selectedVersion && (
            <Button key="restore" type="primary" icon={<RollbackOutlined />} onClick={() => {
              setCompareModalOpen(false);
              handleClickRestore(selectedVersion);
            }}>恢复此版本</Button>
          ),
          <Button key="close" onClick={() => setCompareModalOpen(false)}>关闭</Button>
        ].filter(Boolean)}
      >
        {compareResult && (
          <div style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="旧版本">
                  <div><strong>{compareResult.before.label}</strong></div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {compareResult.before.saved_at && new Date(compareResult.before.saved_at).toLocaleString()}
                    {compareResult.before.saved_by && ` · ${compareResult.before.saved_by}`}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="新版本" style={{ borderLeft: '3px solid #52c41a' }}>
                  <div><strong>{compareResult.after.label}</strong></div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {compareResult.after.saved_at && new Date(compareResult.after.saved_at).toLocaleString()}
                    {compareResult.after.saved_by && ` · ${compareResult.after.saved_by}`}
                  </div>
                </Card>
              </Col>
            </Row>
            <Divider />
            {compareLoading ? <Empty description="正在对比..." /> : renderDiffView(compareResult)}
          </div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <RollbackOutlined />
            <span>恢复版本预览</span>
          </Space>
        }
        open={restoreModalOpen}
        onCancel={() => setRestoreModalOpen(false)}
        width={800}
        confirmLoading={restoreLoading}
        onOk={confirmRestore}
        okText="确认恢复"
      >
        {restoreVersion && (
          <div>
            <Alert
              type="warning"
              showIcon
              message={`将恢复到版本 v${restoreVersion.version_number}`}
              description={restoreVersion.change_summary || '恢复后当前内容将被替换，并生成一个新的历史版本'}
              style={{ marginBottom: 16 }}
            />
            {!restoreLoading && restorePreview && (
              restorePreview.diff.has_changes ? (
                <div>
                  <Divider orientation="left">变更内容预览</Divider>
                  <div style={{ marginBottom: 12 }}>
                    <Tag color="blue">{restorePreview.diff.summary}</Tag>
                  </div>
                  {restorePreview.diff.changes.map((c) => (
                    <Card key={c.field} size="small" style={{ marginBottom: 8 }} title={c.field_label}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>当前</div>
                          <div style={{ background: '#fff1f0', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid #ff4d4f' }}>
                            {c.field === 'content' ? (
                              c.before ? String(c.before).slice(0, 200) + (String(c.before).length > 200 ? '...' : '') : '(空)'
                            ) : (String(c.before) || '(空)')}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>恢复后</div>
                          <div style={{ background: '#f6ffed', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid #52c41a' }}>
                            {c.field === 'content' ? (
                              c.after ? String(c.after).slice(0, 200) + (String(c.after).length > 200 ? '...' : '') : '(空)'
                            ) : (String(c.after) || '(空)')}
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert type="info" message="与当前版本无差异" showIcon />
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DiffFieldView({ change }: { change: FieldDiff }) {
  if (change.field !== 'content' && change.line_diff.lines.length < 2) {
    return (
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>变更前</div>
          <div style={{ background: '#fff1f0', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid #ff4d4f', whiteSpace: 'pre-wrap' }}>
            {String(change.before ?? '(空)')}
          </div>
        </Col>
        <Col span={12}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>变更后</div>
          <div style={{ background: '#f6ffed', padding: '8px 12px', borderRadius: 4, borderLeft: '3px solid #52c41a', whiteSpace: 'pre-wrap' }}>
            {String(change.after ?? '(空)')}
          </div>
        </Col>
      </Row>
    );
  }
  const lineNumWidth = String(change.line_diff.lines.length + 10).length * 10 + 20;
  return (
    <div style={{ border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden', fontFamily: 'monospace', fontSize: 13 }}>
      {change.line_diff.lines.map((line, idx) => {
        const bgMap: Record<string, string> = {
          added: '#f6ffed',
          removed: '#fff1f0',
          unchanged: '#fff'
        };
        const prefixMap: Record<string, string> = { added: '+ ', removed: '- ', unchanged: '  ' };
        const textColorMap: Record<string, string> = { added: '#237804', removed: '#cf1322', unchanged: '#000' };
        return (
          <div key={idx} style={{ display: 'flex', background: bgMap[line.type], borderBottom: idx < change.line_diff.lines.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
            <span style={{ width: lineNumWidth, textAlign: 'right', padding: '2px 8px', color: '#bbb', borderRight: '1px solid #eee', userSelect: 'none' }}>
              {line.line_number_before || ''}
            </span>
            <span style={{ width: lineNumWidth, textAlign: 'right', padding: '2px 8px', color: '#bbb', borderRight: '1px solid #eee', userSelect: 'none' }}>
              {line.line_number_after || ''}
            </span>
            <span style={{ padding: '2px 8px', color: textColorMap[line.type], whiteSpace: 'pre', flex: 1 }}>
              {prefixMap[line.type]}{line.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default DeclarationForm;
