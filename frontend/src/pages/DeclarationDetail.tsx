import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, List, Timeline, Modal, Form, Input, Select, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, CheckOutlined, CloseOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDeclaration } from '../api/declarations';
import { getAttachments, downloadAttachment } from '../api/attachments';
import { getApprovalHistory, approveDeclaration, rejectDeclaration, rollbackDeclaration } from '../api/workflow';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration, Attachment, ApprovalRecord } from '../types';

const { TextArea } = Input;
const { Option } = Select;

function DeclarationDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      loadData(parseInt(id));
    }
  }, [id]);

  const loadData = async (declarationId: number) => {
    setLoading(true);
    try {
      const [decRes, attRes, histRes] = await Promise.all([
        getDeclaration(declarationId),
        getAttachments(declarationId),
        getApprovalHistory(declarationId)
      ]);
      
      if (decRes.success) setDeclaration(decRes.data || null);
      if (attRes.success) setAttachments(attRes.data || []);
      if (histRes.success) setHistory(histRes.data || []);
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

  const getTimelineColor = (action: string) => {
    switch (action) {
      case '通过':
        return 'green';
      case '驳回':
        return 'red';
      case '退回':
        return 'orange';
      case '提交':
        return 'blue';
      default:
        return 'gray';
    }
  };

  if (!declaration && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p>申报不存在</p>
        <Button onClick={() => navigate('/declarations')}>返回列表</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/declarations')} />
          <h2 className="page-title" style={{ margin: 0 }}>申报详情</h2>
          <Tag color={StatusColorMap[declaration?.status as keyof typeof StatusColorMap] || 'default'}>
            {StatusMap[declaration?.status || 'draft']}
          </Tag>
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

      <Card title="基本信息" style={{ marginBottom: 16 }} loading={loading}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="项目名称">{declaration?.title}</Descriptions.Item>
          <Descriptions.Item label="关联指南">{declaration?.guideline_title || '-'}</Descriptions.Item>
          <Descriptions.Item label="申请人">{declaration?.applicant}</Descriptions.Item>
          <Descriptions.Item label="企业名称">{declaration?.company}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{declaration?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="电子邮箱">{declaration?.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(declaration?.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(declaration?.updated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="项目内容" span={2}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{declaration?.content}</div>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="附件材料" style={{ marginBottom: 16 }} loading={loading}>
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
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={item.original_name}
                  description={`${formatFileSize(item.file_size)} · 上传于 ${dayjs(item.uploaded_at).format('YYYY-MM-DD HH:mm')}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
            暂无附件
          </div>
        )}
      </Card>

      <Card title="审批记录" loading={loading}>
        <Timeline
          className="status-timeline"
          items={history.map(record => ({
            color: getTimelineColor(record.action),
            children: (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {record.step_name || `步骤 ${record.step}`} - {record.action}
                </div>
                <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                  审批人: {record.approver}
                </div>
                {record.comment && (
                  <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
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
        {history.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
            暂无审批记录
          </div>
        )}
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
              <Option value={0}>草稿</Option>
              <Option value={1}>待初审</Option>
              <Option value={2}>待复审</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="comment"
            label="退回原因"
          >
            <TextArea rows={4} placeholder="请输入退回原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default DeclarationDetail;
