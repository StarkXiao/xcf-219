import { useState, useEffect } from 'react';
import { Card, Steps, Button, Select, List, Tag, message, Space, Modal, Form, Input } from 'antd';
import { ArrowRightOutlined, CheckOutlined, CloseOutlined, RollbackOutlined } from '@ant-design/icons';
import { getDeclarations, createDeclaration, submitDeclaration } from '../api/declarations';
import { getApprovalHistory, approveDeclaration, rejectDeclaration, rollbackDeclaration } from '../api/workflow';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration, ApprovalRecord } from '../types';
import dayjs from 'dayjs';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const workflowSteps = [
  { title: '草稿', status: 'draft', desc: '申报人编辑' },
  { title: '待初审', status: 'submitted', desc: '提交初审' },
  { title: '待复审', status: 'first_reviewed', desc: '初审通过' },
  { title: '待终审', status: 'second_reviewed', desc: '复审通过' },
  { title: '已立项', status: 'approved', desc: '终审通过' },
];

function WorkflowDemo() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [history, setHistory] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadDeclarations();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId]);

  const loadDeclarations = async () => {
    try {
      const res = await getDeclarations();
      if (res.success) {
        setDeclarations(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedId(res.data[0].id);
        }
      }
    } catch (error) {
      message.error('加载申报列表失败');
    }
  };

  const loadDetail = async (id: number) => {
    setLoading(true);
    try {
      const [decRes, histRes] = await Promise.all([
        getDeclarations(),
        getApprovalHistory(id)
      ]);
      
      if (decRes.success) {
        const dec = (decRes.data || []).find(d => d.id === id);
        setDeclaration(dec || null);
      }
      if (histRes.success) {
        setHistory(histRes.data || []);
      }
    } catch (error) {
      message.error('加载详情失败');
    }
    setLoading(false);
  };

  const getCurrentStep = (status: string) => {
    const statusOrder = ['draft', 'submitted', 'first_reviewed', 'second_reviewed', 'approved', 'rejected'];
    const idx = statusOrder.indexOf(status);
    if (idx === -1) return 0;
    if (status === 'rejected') return 0;
    return idx;
  };

  const handleCreateDemo = async () => {
    try {
      const res = await createDeclaration({
        title: `演示申报 - ${dayjs().format('YYYYMMDDHHmmss')}`,
        applicant: '演示人员',
        company: '演示科技有限公司',
        phone: '13800138000',
        email: 'demo@example.com',
        content: '这是一个用于演示状态流转的测试申报。'
      });
      if (res.success) {
        message.success('创建演示申报成功');
        loadDeclarations();
        setSelectedId(res.data.id);
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleSubmit = () => {
    if (!selectedId) return;
    Modal.confirm({
      title: '确认提交',
      content: '确定要提交申报吗？提交后将进入初审流程。',
      onOk: async () => {
        try {
          const res = await submitDeclaration(selectedId);
          if (res.success) {
            message.success('提交成功');
            loadDetail(selectedId);
            loadDeclarations();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '提交失败');
        }
      }
    });
  };

  const handleApprove = async () => {
    if (!selectedId) return;
    try {
      const values = await form.validateFields();
      const res = await approveDeclaration(selectedId, values);
      if (res.success) {
        message.success('审批通过');
        setApproveModalVisible(false);
        form.resetFields();
        loadDetail(selectedId);
        loadDeclarations();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '审批失败');
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    try {
      const values = await form.validateFields();
      const res = await rejectDeclaration(selectedId, values);
      if (res.success) {
        message.success('已驳回');
        setRejectModalVisible(false);
        form.resetFields();
        loadDetail(selectedId);
        loadDeclarations();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleRollback = async () => {
    if (!selectedId) return;
    try {
      const values = await form.validateFields();
      const res = await rollbackDeclaration(selectedId, values);
      if (res.success) {
        message.success('已退回');
        setRollbackModalVisible(false);
        form.resetFields();
        loadDetail(selectedId);
        loadDeclarations();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const canSubmit = declaration?.status === 'draft';
  const canApprove = declaration && ['submitted', 'first_reviewed', 'second_reviewed'].includes(declaration.status);
  const canReject = declaration && ['submitted', 'first_reviewed', 'second_reviewed'].includes(declaration.status);
  const canRollback = declaration && ['submitted', 'first_reviewed', 'second_reviewed'].includes(declaration.status);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">状态流转演示</h2>
        <Button type="primary" onClick={handleCreateDemo}>
          创建演示申报
        </Button>
      </div>

      <Card title="选择申报项目" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>当前演示申报：</span>
          <Select
            value={selectedId}
            onChange={setSelectedId}
            style={{ width: 400 }}
            placeholder="请选择一个申报"
          >
            {declarations.map(d => (
              <Option key={d.id} value={d.id}>
                {d.title} - <Tag color={StatusColorMap[d.status as keyof typeof StatusColorMap]}>{StatusMap[d.status]}</Tag>
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      <Card title="审批流程" style={{ marginBottom: 16 }} loading={loading}>
        <Steps
          current={declaration ? getCurrentStep(declaration.status) : 0}
          status={declaration?.status === 'rejected' ? 'error' : 'process'}
          style={{ padding: '20px 0' }}
        >
          {workflowSteps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.desc}
            />
          ))}
        </Steps>

        {declaration?.status === 'rejected' && (
          <div style={{ textAlign: 'center', color: '#ff4d4f', padding: '16px 0' }}>
            <CloseOutlined style={{ fontSize: 24, marginRight: 8 }} />
            申报已被驳回
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          {canSubmit && (
            <Button type="primary" onClick={handleSubmit}>
              提交申报 <ArrowRightOutlined />
            </Button>
          )}
          {canApprove && (
            <Button 
              type="primary" 
              icon={<CheckOutlined />} 
              onClick={() => { form.resetFields(); setApproveModalVisible(true); }}
            >
              审批通过
            </Button>
          )}
          {canReject && (
            <Button 
              danger 
              icon={<CloseOutlined />} 
              onClick={() => { form.resetFields(); setRejectModalVisible(true); }}
            >
              驳回
            </Button>
          )}
          {canRollback && (
            <Button 
              icon={<RollbackOutlined />} 
              onClick={() => { form.resetFields(); setRollbackModalVisible(true); }}
            >
              退回
            </Button>
          )}
          {declaration?.status === 'approved' && (
            <Tag color="green" style={{ fontSize: 16, padding: '8px 24px' }}>
              <CheckOutlined /> 申报已立项
            </Tag>
          )}
        </div>
      </Card>

      <Card title="审批记录" loading={loading}>
        {history.length > 0 ? (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={item.action === '通过' ? 'green' : item.action === '驳回' ? 'red' : 'blue'}>
                        {item.action}
                      </Tag>
                      <span>{item.step_name || `步骤 ${item.step}`}</span>
                    </Space>
                  }
                  description={
                    <div>
                      <div>审批人: {item.approver}</div>
                      {item.comment && <div>意见: {item.comment}</div>}
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
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
            initialValue="张三"
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="comment"
            label="审批意见"
            initialValue="材料齐全，同意通过"
          >
            <TextArea rows={3} placeholder="请输入审批意见（可选）" />
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
            initialValue="李四"
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="comment"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
            initialValue="申报材料不完整，请补充相关证明文件"
          >
            <TextArea rows={3} placeholder="请输入驳回原因" />
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
            initialValue="王五"
          >
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          <Form.Item
            name="target_step"
            label="退回至"
            rules={[{ required: true, message: '请选择退回目标' }]}
            initialValue={0}
          >
            <Select placeholder="请选择退回目标">
              <Option value={0}>草稿（申请人修改）</Option>
              <Option value={1}>待初审</Option>
              <Option value={2}>待复审</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="comment"
            label="退回原因"
            initialValue="请补充财务数据后重新提交"
          >
            <TextArea rows={3} placeholder="请输入退回原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default WorkflowDemo;
