import { useEffect, useState } from 'react';
import {
  Card,
  Steps,
  Button,
  Space,
  Input,
  Select,
  Timeline,
  Tag,
  Divider,
  Table,
  Modal,
  Form,
  message
} from 'antd';
import {
  CaretRightOutlined,
  ReloadOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import {
  getWorkflowSteps,
  getStatusOptions,
  approveDeclaration,
  rejectDeclaration,
  rollbackDeclaration,
  getWorkflowInfo
} from '../api/workflow';
import type {
  WorkflowStep,
  ApprovalRecord,
  WorkflowInfo,
  Declaration,
  WorkflowConfig
} from '../types';
import { StatusMap, StatusColorMap } from '../types';

const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;

function WorkflowDemo() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<number | null>(null);
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'rollback'>('approve');
  const [rollbackTargetStep, setRollbackTargetStep] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);

  useEffect(() => {
    loadWorkflowSteps();
    loadStatusOptions();
    loadDeclarations();
  }, []);

  useEffect(() => {
    if (selectedDeclarationId) {
      loadWorkflowInfo(selectedDeclarationId);
      loadApprovalHistory(selectedDeclarationId);
    }
  }, [selectedDeclarationId]);

  const loadWorkflowSteps = async () => {
    try {
      const res = await getWorkflowSteps();
      if (res.success) {
        setSteps(res.data || []);
      }
    } catch (error) {
      console.error('加载工作流步骤失败:', error);
    }
  };

  const loadStatusOptions = async () => {
    try {
      const res = await getStatusOptions();
      if (res.success) {
        setStatusOptions(res.data || []);
      }
    } catch (error) {
      console.error('加载状态选项失败:', error);
    }
  };

  const loadDeclarations = async () => {
    try {
      const res = await fetch('/api/declarations');
      const json = await res.json();
      if (json.success) {
        setDeclarations(json.data || []);
      }
    } catch (error) {
      console.error('加载申报列表失败:', error);
    }
  };

  const loadWorkflowInfo = async (id: number) => {
    try {
      const res = await getWorkflowInfo(id);
      if (res.success) {
        setWorkflowInfo(res.data || null);
      }
    } catch (error) {
      console.error('加载工作流信息失败:', error);
    }
  };

  const loadApprovalHistory = async (id: number) => {
    try {
      const res = await fetch(`/api/workflow/declaration/${id}/history`);
      const json = await res.json();
      if (json.success) {
        setApprovalHistory(json.data || []);
      }
    } catch (error) {
      console.error('加载审批历史失败:', error);
    }
  };

  const handleAction = (type: 'approve' | 'reject' | 'rollback') => {
    setActionType(type);
    form.resetFields();
    setRollbackTargetStep(null);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (!selectedDeclarationId) return;
    setLoading(true);
    try {
      let res;
      if (actionType === 'approve') {
        res = await approveDeclaration(selectedDeclarationId, {
          approver: values.approver || '审批人',
          comment: values.comment
        });
      } else if (actionType === 'reject') {
        res = await rejectDeclaration(selectedDeclarationId, {
          approver: values.approver || '审批人',
          comment: values.comment
        });
      } else if (actionType === 'rollback') {
        res = await rollbackDeclaration(selectedDeclarationId, {
          approver: values.approver || '审批人',
          comment: values.comment,
          target_step: rollbackTargetStep || undefined
        });
      }
      if (res?.success) {
        message.success('操作成功');
        setModalOpen(false);
        loadWorkflowInfo(selectedDeclarationId);
        loadApprovalHistory(selectedDeclarationId);
        loadDeclarations();
      }
    } catch (error) {
      message.error('操作失败');
    }
    setLoading(false);
  };

  const currentStepIndex = workflowInfo?.current_step
    ? steps.findIndex((s) => s.step_order === workflowInfo.current_step)
    : -1;

  const declarationColumns = [
    {
      title: '选择',
      key: 'select',
      width: 80,
      render: (_: any, record: Declaration) => (
        <Button
          type={selectedDeclarationId === record.id ? 'primary' : 'default'}
          size="small"
          onClick={() => setSelectedDeclarationId(record.id)}
        >
          {selectedDeclarationId === record.id ? '已选' : '选择'}
        </Button>
      )
    },
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '项目名称',
      dataIndex: 'title'
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string, record: Declaration) => (
        <Tag color={StatusColorMap[status as keyof typeof StatusColorMap]}>
          {record.status_label || StatusMap[status] || status}
        </Tag>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>状态流转演示</h2>
      </div>

      <Card title="选择申报单" style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          columns={declarationColumns}
          dataSource={declarations}
          size="small"
          pagination={{ pageSize: 5 }}
          scroll={{ x: 800 }}
        />
      </Card>

      {selectedDeclarationId && (
        <>
          <Card title="工作流进度" style={{ marginBottom: 16 }}>
            <Steps current={currentStepIndex >= 0 ? currentStepIndex : 0} size="small">
              {steps.map((step) => (
                <Step
                  key={step.id}
                  title={step.step_name}
                  description={step.description}
                  status={
                    workflowInfo?.status === 'approved'
                      ? 'finish'
                      : workflowInfo?.status === 'rejected' &&
                          step.step_order === (workflowInfo.current_step || 0)
                        ? 'error'
                        : undefined
                  }
                />
              ))}
            </Steps>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleAction('approve')}
                  disabled={!workflowInfo?.can_approve}
                >
                  审批通过
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleAction('reject')}
                  disabled={!workflowInfo?.can_reject}
                >
                  审批驳回
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => handleAction('rollback')}
                  disabled={!workflowInfo?.can_rollback}
                >
                  审批退回
                </Button>
              </Space>
            </div>
          </Card>

          <Card title="审批历史">
            {approvalHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无审批记录
              </div>
            ) : (
              <Timeline
                items={approvalHistory.map((record) => ({
                  color: record.action === 'approve' ? 'green' : record.action === 'reject' ? 'red' : 'orange',
                  children: (
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <Tag color={record.action === 'approve' ? 'green' : record.action === 'reject' ? 'red' : 'orange'}>
                          {record.action_label || record.action}
                        </Tag>
                        <span style={{ marginLeft: 8, fontWeight: 500 }}>{record.step_name}</span>
                        <span style={{ color: '#999', marginLeft: 16 }}>审批人: {record.approver}</span>
                        <span style={{ color: '#999', marginLeft: 16 }}>{record.created_at}</span>
                      </div>
                      {record.comment && (
                        <div style={{ color: '#666', padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                          {record.comment}
                        </div>
                      )}
                    </div>
                  )
                }))}
              />
            )}
          </Card>
        </>
      )}

      <Modal
        title={
          actionType === 'approve'
            ? '审批通过'
            : actionType === 'reject'
              ? '审批驳回'
              : '审批退回'
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="approver" label="审批人" rules={[{ required: true, message: '请输入审批人' }]}>
            <Input placeholder="请输入审批人姓名" />
          </Form.Item>
          {actionType === 'rollback' && (
            <Form.Item label="退回目标步骤" name="target_step" rules={[{ required: true, message: '请选择目标步骤' }]}>
              <Select
                placeholder="请选择要退回的步骤"
                value={rollbackTargetStep || undefined}
                onChange={(v) => setRollbackTargetStep(v)}
              >
                {steps.map((step) => (
                  <Option key={step.id} value={step.step_order}>
                    {step.step_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item
            name="comment"
            label={actionType === 'reject' || actionType === 'rollback' ? '退回原因' : '审批意见'}
            rules={
              actionType === 'approve'
                ? []
                : [{ required: true, message: actionType === 'reject' ? '请填写驳回原因' : '请填写退回原因' }]
            }
          >
            <TextArea rows={4} placeholder="请输入审批意见" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type={actionType === 'reject' ? 'primary' : 'primary'} danger={actionType === 'reject'} htmlType="submit" loading={loading}>
                确认
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default WorkflowDemo;
