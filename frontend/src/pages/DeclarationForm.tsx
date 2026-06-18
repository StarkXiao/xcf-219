import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, message, Steps, Upload, List, Tag, Space, Modal } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, InboxOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getGuidelines } from '../api/guidelines';
import { getDeclaration, createDeclaration, updateDeclaration, submitDeclaration } from '../api/declarations';
import { getAttachments, uploadAttachments, deleteAttachment, downloadAttachment } from '../api/attachments';
import type { Guideline, Declaration, Attachment } from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

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

  useEffect(() => {
    loadGuidelines();
    if (isEdit) {
      loadDeclaration();
    }
  }, [id]);

  const loadGuidelines = async () => {
    try {
      const res = await getGuidelines();
      if (res.success) {
        setGuidelines(res.data || []);
      }
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
        loadAttachments(parseInt(id));
      }
    } catch (error) {
      message.error('加载申报信息失败');
    }
    setLoading(false);
  };

  const loadAttachments = async (declarationId: number) => {
    try {
      const res = await getAttachments(declarationId);
      if (res.success) {
        setAttachments(res.data || []);
      }
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
      
      let res;
      if (isEdit && id) {
        res = await updateDeclaration(parseInt(id), values);
      } else {
        res = await createDeclaration(values);
        if (res.success && res.data) {
          setDeclaration({ ...values, id: res.data.id, status: res.data.status } as Declaration);
        }
      }
      
      if (res.success) {
        message.success('保存成功');
        if (!isEdit && res.data) {
          navigate(`/declarations/${res.data.id}/edit`);
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
      content: '确定要提交申报吗？提交后将进入审批流程，无法再编辑。',
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

  const beforeUpload = (file: File, fileList: File[]) => {
    handleUpload(fileList);
    return false;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/declarations')}
          />
          <h2 className="page-title" style={{ margin: 0 }}>
            {isEdit ? '编辑申报' : '新建申报'}
          </h2>
          {declaration && (
            <Tag color={declaration.status === 'draft' ? 'default' : 'blue'}>
              {declaration.status === 'draft' ? '草稿' : '已提交'}
            </Tag>
          )}
        </div>
      </div>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="title"
              label="项目名称"
              rules={[{ required: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="请输入项目名称" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
            <Form.Item
              name="guideline_id"
              label="申报指南"
            >
              <Select placeholder="请选择申报指南" allowClear disabled={declaration?.status !== 'draft' && isEdit}>
                {guidelines.map(g => (
                  <Option key={g.id} value={g.id}>{g.title}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="applicant"
              label="申请人"
              rules={[{ required: true, message: '请输入申请人' }]}
            >
              <Input placeholder="请输入申请人姓名" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
            <Form.Item
              name="company"
              label="企业名称"
              rules={[{ required: true, message: '请输入企业名称' }]}
            >
              <Input placeholder="请输入企业名称" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="phone"
              label="联系电话"
            >
              <Input placeholder="请输入联系电话" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
            <Form.Item
              name="email"
              label="电子邮箱"
            >
              <Input placeholder="请输入电子邮箱" disabled={declaration?.status !== 'draft' && isEdit} />
            </Form.Item>
          </div>
          <Form.Item
            name="content"
            label="项目内容"
            rules={[{ required: true, message: '请输入项目内容' }]}
          >
            <TextArea rows={6} placeholder="请详细描述项目内容" disabled={declaration?.status !== 'draft' && isEdit} />
          </Form.Item>
        </Form>
      </Card>

      <Card title="附件材料" style={{ marginBottom: 16 }}>
        {(isEdit || declaration) && (
          <>
            <Dragger
              multiple
              beforeUpload={beforeUpload}
              showUploadList={false}
              disabled={declaration?.status !== 'draft'}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持 PDF、Word、Excel、图片、压缩包等格式，单个文件不超过 10MB</p>
            </Dragger>

            {attachments.length > 0 ? (
              <List
                dataSource={attachments}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button 
                        type="link" 
                        icon={<DownloadOutlined />} 
                        onClick={() => window.open(downloadAttachment(item.id))}
                      >
                        下载
                      </Button>,
                      declaration?.status === 'draft' && (
                        <Button 
                          type="link" 
                          danger 
                          icon={<DeleteOutlined />} 
                          onClick={() => handleDeleteAttachment(item)}
                        >
                          删除
                        </Button>
                      )
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={item.original_name}
                      description={`${formatFileSize(item.file_size)} · 上传于 ${new Date(item.uploaded_at).toLocaleString()}`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
                暂无附件
              </div>
            )}
          </>
        )}
        {!isEdit && !declaration && (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            请先保存申报信息后再上传附件
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button onClick={() => navigate('/declarations')}>取消</Button>
        {(!declaration || declaration.status === 'draft') && (
          <>
            <Button onClick={handleSave} loading={loading}>保存草稿</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              提交申报
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default DeclarationForm;
