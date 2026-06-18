import { useEffect, useState } from 'react';
import { Card, Upload, Button, List, Progress, Table, Tag, Space, message, Divider } from 'antd';
import { UploadOutlined, InboxOutlined, PaperClipOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { Attachment } from '../types';

const { Dragger } = Upload;

function AttachmentDemo() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAttachments();
  }, []);

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attachments');
      const json = await res.json();
      if (json.success) {
        setAttachments(json.data || []);
      }
    } catch (error) {
      console.error('加载附件失败:', error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        message.success('删除成功');
        loadAttachments();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const fileTypeColor: Record<string, string> = {
    'application/pdf': 'red',
    'application/msword': 'blue',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'blue',
    'application/vnd.ms-excel': 'green',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'green',
    'image/jpeg': 'purple',
    'image/png': 'purple'
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '文件名称',
      dataIndex: 'original_name',
      render: (name: string, record: Attachment) => (
        <Space>
          <PaperClipOutlined />
          <span>{name}</span>
          {record.file_type && (
            <Tag color={fileTypeColor[record.file_type] || 'default'}>
              {record.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '关联申报ID',
      dataIndex: 'declaration_id',
      width: 120
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      width: 120,
      render: (size: number) => formatFileSize(size || 0)
    },
    {
      title: '上传时间',
      dataIndex: 'uploaded_at',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Attachment) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
          删除
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>附件上传演示</h2>
      </div>

      <Card title="文件上传" style={{ marginBottom: 16 }}>
        <Dragger
          multiple
          fileList={fileList}
          onChange={({ fileList: newList }) => setFileList(newList)}
          beforeUpload={(file) => {
            console.log('选择文件:', file.name, file.size);
            return false;
          }}
          onRemove={() => {}}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传。严禁上传公司数据或其他违禁文件
          </p>
        </Dragger>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<UploadOutlined />}>
            开始上传
          </Button>
        </div>
      </Card>

      <Card title="附件列表">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={attachments}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default AttachmentDemo;
