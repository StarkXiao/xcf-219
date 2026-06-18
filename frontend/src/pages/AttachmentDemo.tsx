import { useState, useEffect } from 'react';
import { Card, List, Button, Upload, message, Select, Modal, Form, Input, Space } from 'antd';
import { UploadOutlined, InboxOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeclarations, createDeclaration } from '../api/declarations';
import { getAttachments, uploadAttachments, deleteAttachment, downloadAttachment } from '../api/attachments';
import type { Declaration, Attachment } from '../types';

const { Dragger } = Upload;
const { Option } = Select;

function AttachmentDemo() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadDeclarations();
  }, []);

  useEffect(() => {
    if (selectedDeclarationId) {
      loadAttachments(selectedDeclarationId);
    } else {
      setAttachments([]);
    }
  }, [selectedDeclarationId]);

  const loadDeclarations = async () => {
    try {
      const res = await getDeclarations({ status: 'draft' });
      if (res.success) {
        setDeclarations(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedDeclarationId(res.data[0].id);
        }
      }
    } catch (error) {
      message.error('加载申报列表失败');
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
        setSelectedDeclarationId(res.data!.id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const beforeUpload = (file: File, fileList: File[]) => {
    if (!selectedDeclarationId) {
      message.warning('请先选择或创建一个申报');
      return false;
    }
    handleUpload(fileList);
    return false;
  };

  const handleUpload = async (fileList: File[]) => {
    if (!selectedDeclarationId) return;
    
    try {
      const res = await uploadAttachments(selectedDeclarationId, fileList);
      if (res.success) {
        message.success(`成功上传 ${fileList.length} 个文件`);
        loadAttachments(selectedDeclarationId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传失败');
    }
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
              loadAttachments(selectedDeclarationId);
            }
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">附件上传演示</h2>
        <Button type="primary" onClick={() => setCreateModalVisible(true)}>
          新建申报
        </Button>
      </div>

      <Card title="选择申报项目" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>当前申报项目：</span>
          <Select
            value={selectedDeclarationId}
            onChange={setSelectedDeclarationId}
            style={{ width: 400 }}
            placeholder="请选择一个草稿状态的申报"
          >
            {declarations.map(d => (
              <Option key={d.id} value={d.id}>{d.title}</Option>
            ))}
          </Select>
          <span style={{ color: '#999' }}>
            （共 {declarations.length} 个草稿）
          </span>
        </div>
      </Card>

      <Card title="上传附件" style={{ marginBottom: 16 }}>
        <Dragger
          multiple
          beforeUpload={beforeUpload}
          showUploadList={false}
          disabled={!selectedDeclarationId}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 PDF、Word、Excel、图片、压缩包等格式，单个文件不超过 10MB
          </p>
        </Dragger>
      </Card>

      <Card 
        title={`附件列表 (${attachments.length})`} 
        loading={loading}
      >
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
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(item)}
                  >
                    删除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={item.original_name}
                  description={
                    <Space>
                      <span>{formatFileSize(item.file_size)}</span>
                      <span>·</span>
                      <span>{item.file_type}</span>
                      <span>·</span>
                      <span>上传于 {dayjs(item.uploaded_at).format('YYYY-MM-DD HH:mm')}</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            {selectedDeclarationId ? '暂无附件，请上传' : '请先选择一个申报项目'}
          </div>
        )}
      </Card>

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

export default AttachmentDemo;
