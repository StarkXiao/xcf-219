import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, message, Card, Tabs, Badge } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDeclarations } from '../api/declarations';
import { getApprovalHistory, approveDeclaration, rejectDeclaration } from '../api/workflow';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration, ApprovalRecord } from '../types';

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
    try {
      const res = await getApprovalHistory(record.id);
      if (res.success) {
        setApprovalHistory(res.data || []);
      }
    } catch (error) {
      console.error('加载审批记录失败:', error);
    }
    setDetailModalVisible(true);
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

  const pendingColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
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
      width: 100
    },
    {
      title: '企业名称',
      dataIndex: 'company',
      key: 'company',
      width: 150
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Declaration) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
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
  ];

  const allColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
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
      width: 100
    },
    {
      title: '企业名称',
      dataIndex: 'company',
      key: 'company',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Declaration) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      )
    }
  ];

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
        title="申报详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={700}
        destroyOnClose
      >
        {selectedDeclaration && (
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
              <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                {selectedDeclaration.content}
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
          >
            <TextArea rows={4} placeholder="请输入驳回原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Approval;
