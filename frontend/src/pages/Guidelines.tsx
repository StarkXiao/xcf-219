import { useEffect, useState } from 'react';
import { Table, Button, Space, Input, Select, Modal, Form, DatePicker, message, Tag, Card, Tabs, Switch, Checkbox, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined, MinusCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getGuidelines, createGuideline, updateGuideline, deleteGuideline } from '../api/guidelines';
import { getWorkflowConfigByGuideline, createWorkflowConfig, updateWorkflowConfig, deleteWorkflowConfig, getWorkflowRoles } from '../api/workflow';
import type { Guideline, WorkflowConfig, WorkflowConfigStep, WorkflowRoleOption } from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

function generateStepKey(name: string, order: number): string {
  const pinyin: Record<string, string> = {
    '初': 'chu', '复': 'fu', '终': 'zhong', '审': 'shen',
    '形': 'xing', '式': 'shi', '公': 'gong', '示': 'shi',
    '认': 'ren', '定': 'ding', '评': 'ping', '专': 'zhuan',
    '家': 'jia', '核': 'he', '查': 'cha', '批': 'pi'
  };
  const key = name.split('').map(c => pinyin[c] || c).join('');
  return `${key}_${order}`;
}

function Guidelines() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentGuideline, setCurrentGuideline] = useState<Guideline | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [form] = Form.useForm();

  const [workflowModalVisible, setWorkflowModalVisible] = useState(false);
  const [workflowGuideline, setWorkflowGuideline] = useState<Guideline | null>(null);
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowConfigStep[]>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [roleOptions, setRoleOptions] = useState<WorkflowRoleOption[]>([]);
  const [workflowSaving, setWorkflowSaving] = useState(false);

  useEffect(() => {
    loadGuidelines();
    loadRoles();
  }, []);

  const loadGuidelines = async () => {
    setLoading(true);
    try {
      const res = await getGuidelines({ keyword, category });
      if (res.success) {
        setGuidelines(res.data || []);
      }
    } catch (error) {
      message.error('加载申报指南失败');
    }
    setLoading(false);
  };

  const loadRoles = async () => {
    try {
      const res = await getWorkflowRoles();
      if (res.success) {
        setRoleOptions(res.data || []);
      }
    } catch {
      setRoleOptions([
        { value: '初审员', label: '初审员' },
        { value: '复审员', label: '复审员' },
        { value: '终审员', label: '终审员' },
        { value: '评审专家', label: '评审专家' },
        { value: '领导', label: '领导' }
      ]);
    }
  };

  const handleSearch = () => {
    loadGuidelines();
  };

  const handleAdd = () => {
    setCurrentGuideline(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Guideline) => {
    setCurrentGuideline(record);
    form.setFieldsValue({
      ...record,
      deadline: record.deadline ? dayjs(record.deadline) : null
    });
    setModalVisible(true);
  };

  const handleDetail = (record: Guideline) => {
    setCurrentGuideline(record);
    setDetailVisible(true);
  };

  const handleDelete = (record: Guideline) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除"${record.title}"吗？关联的工作流配置也会被删除。`,
      onOk: async () => {
        try {
          const res = await deleteGuideline(record.id);
          if (res.success) {
            message.success('删除成功');
            loadGuidelines();
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : null
      };
      
      let res;
      if (currentGuideline) {
        res = await updateGuideline(currentGuideline.id, data);
      } else {
        res = await createGuideline(data);
      }
      
      if (res.success) {
        message.success(currentGuideline ? '更新成功' : '创建成功');
        setModalVisible(false);
        loadGuidelines();
      }
    } catch (error) {
      message.error(currentGuideline ? '更新失败' : '创建失败');
    }
  };

  const handleWorkflowConfig = async (record: Guideline) => {
    setWorkflowGuideline(record);
    setWorkflowName(`${record.title}审批流`);
    setWorkflowDescription('');

    try {
      const res = await getWorkflowConfigByGuideline(record.id);
      if (res.success && res.data) {
        setWorkflowConfig(res.data);
        setWorkflowName(res.data.name);
        setWorkflowDescription(res.data.description || '');
        setWorkflowSteps(res.data.steps.map(s => ({ ...s })));
      } else {
        setWorkflowConfig(null);
        setWorkflowSteps([
          {
            name: '初审',
            step_key: 'initial_review',
            role: '初审员',
            step_order: 1,
            pending_status: 'submitted',
            approved_status: 'first_reviewed',
            allow_rollback: true,
            rollback_targets: [0]
          },
          {
            name: '复审',
            step_key: 'second_review',
            role: '复审员',
            step_order: 2,
            pending_status: 'first_reviewed',
            approved_status: 'second_reviewed',
            allow_rollback: true,
            rollback_targets: [1, 0]
          },
          {
            name: '终审',
            step_key: 'final_review',
            role: '领导',
            step_order: 3,
            pending_status: 'second_reviewed',
            approved_status: 'approved',
            allow_rollback: true,
            rollback_targets: [2, 1, 0]
          }
        ]);
      }
    } catch {
      setWorkflowConfig(null);
      setWorkflowSteps([]);
    }

    setWorkflowModalVisible(true);
  };

  const addWorkflowStep = () => {
    const order = workflowSteps.length + 1;
    const prevStep = workflowSteps[workflowSteps.length - 1];
    const pendingStatus = prevStep ? prevStep.approved_status : 'submitted';
    const approvedStatus = `step_${order}_approved`;

    setWorkflowSteps([...workflowSteps, {
      name: `步骤${order}`,
      step_key: generateStepKey(`步骤${order}`, order),
      role: '初审员',
      step_order: order,
      pending_status: pendingStatus,
      approved_status: approvedStatus,
      allow_rollback: true,
      rollback_targets: Array.from({ length: order }, (_, i) => i)
    }]);
  };

  const removeWorkflowStep = (index: number) => {
    const newSteps = workflowSteps.filter((_, i) => i !== index);
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
      step.rollback_targets = Array.from({ length: i + 1 }, (_, j) => j);
    });
    if (newSteps.length > 0) {
      newSteps[newSteps.length - 1].approved_status = 'approved';
      for (let i = 1; i < newSteps.length; i++) {
        newSteps[i].pending_status = newSteps[i - 1].approved_status;
      }
    }
    setWorkflowSteps([...newSteps]);
  };

  const moveStepUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...workflowSteps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
    });
    if (newSteps.length > 0) {
      newSteps[0].pending_status = 'submitted';
      for (let i = 1; i < newSteps.length; i++) {
        newSteps[i].pending_status = newSteps[i - 1].approved_status;
      }
      newSteps[newSteps.length - 1].approved_status = 'approved';
    }
    setWorkflowSteps(newSteps);
  };

  const moveStepDown = (index: number) => {
    if (index === workflowSteps.length - 1) return;
    moveStepUp(index + 1);
  };

  const updateStep = (index: number, field: keyof WorkflowConfigStep, value: any) => {
    const newSteps = [...workflowSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    if (field === 'name' && !newSteps[index].step_key?.includes('_')) {
      newSteps[index].step_key = generateStepKey(value, newSteps[index].step_order);
    }
    setWorkflowSteps(newSteps);
  };

  const updateRollbackTargets = (stepIndex: number, targetStepOrder: number, checked: boolean) => {
    const newSteps = [...workflowSteps];
    const step = { ...newSteps[stepIndex] };
    let targets = [...(step.rollback_targets || [])];
    if (checked) {
      if (!targets.includes(targetStepOrder)) {
        targets.push(targetStepOrder);
        targets.sort((a, b) => a - b);
      }
    } else {
      targets = targets.filter(t => t !== targetStepOrder);
    }
    step.rollback_targets = targets;
    newSteps[stepIndex] = step;
    setWorkflowSteps(newSteps);
  };

  const saveWorkflowConfig = async () => {
    if (!workflowGuideline) return;

    if (workflowSteps.length === 0) {
      message.error('至少需要一个审批步骤');
      return;
    }

    for (const step of workflowSteps) {
      if (!step.name || !step.role) {
        message.error(`步骤${step.step_order}的名称和角色不能为空`);
        return;
      }
    }

    setWorkflowSaving(true);
    try {
      const data = {
        guideline_id: workflowGuideline.id,
        name: workflowName,
        description: workflowDescription,
        steps: workflowSteps
      };

      if (workflowConfig) {
        const res = await updateWorkflowConfig(workflowConfig.id, data);
        if (res.success) {
          message.success('工作流配置更新成功');
          setWorkflowModalVisible(false);
        }
      } else {
        const res = await createWorkflowConfig(data);
        if (res.success) {
          message.success('工作流配置创建成功');
          setWorkflowModalVisible(false);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存工作流配置失败');
    }
    setWorkflowSaving(false);
  };

  const handleDeleteWorkflowConfig = async () => {
    if (!workflowConfig) return;
    try {
      const res = await deleteWorkflowConfig(workflowConfig.id);
      if (res.success) {
        message.success('工作流配置已删除');
        setWorkflowModalVisible(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 120,
      render: (text: string | null) => text || '长期有效'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Guideline) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>查看</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" icon={<SettingOutlined />} onClick={() => handleWorkflowConfig(record)}>审批流</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">申报指南</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增指南
        </Button>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索标题或内容"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 300 }}
          onPressEnter={handleSearch}
        />
        <Select
          placeholder="选择分类"
          value={category}
          onChange={setCategory}
          style={{ width: 150 }}
          allowClear
        >
          <Option value="科技项目">科技项目</Option>
          <Option value="企业发展">企业发展</Option>
          <Option value="资质认定">资质认定</Option>
          <Option value="其他">其他</Option>
        </Select>
        <Button type="primary" onClick={handleSearch}>搜索</Button>
      </div>

      <Table
        columns={columns}
        dataSource={guidelines}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={currentGuideline ? '编辑申报指南' : '新增申报指南'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              <Option value="科技项目">科技项目</Option>
              <Option value="企业发展">企业发展</Option>
              <Option value="资质认定">资质认定</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="deadline"
            label="截止日期"
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期" />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={8} placeholder="请输入详细内容" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={currentGuideline?.title}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
        destroyOnClose
      >
        {currentGuideline && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">{currentGuideline.category}</Tag>
              <span style={{ color: '#999', marginLeft: 8 }}>
                截止日期: {currentGuideline.deadline || '长期有效'}
              </span>
            </div>
            <Card bordered={false} style={{ background: '#fafafa', whiteSpace: 'pre-wrap' }}>
              {currentGuideline.content}
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title={`审批流配置 - ${workflowGuideline?.title || ''}`}
        open={workflowModalVisible}
        onCancel={() => setWorkflowModalVisible(false)}
        width={920}
        footer={[
          workflowConfig ? (
            <Popconfirm
              key="delete"
              title="确定删除此工作流配置？"
              onConfirm={handleDeleteWorkflowConfig}
            >
              <Button danger>删除配置</Button>
            </Popconfirm>
          ) : null,
          <Button key="cancel" onClick={() => setWorkflowModalVisible(false)}>取消</Button>,
          <Button key="save" type="primary" loading={workflowSaving} onClick={saveWorkflowConfig}>
            保存配置
          </Button>
        ]}
        destroyOnClose
      >
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>配置名称</label>
              <Input
                value={workflowName}
                onChange={e => setWorkflowName(e.target.value)}
                placeholder="审批流名称"
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>配置描述</label>
              <Input
                value={workflowDescription}
                onChange={e => setWorkflowDescription(e.target.value)}
                placeholder="描述（可选）"
              />
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>审批步骤配置</strong>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addWorkflowStep}>
              添加步骤
            </Button>
          </div>

          {workflowSteps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无审批步骤，请点击"添加步骤"
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {workflowSteps.map((step, index) => (
                <Card
                  key={index}
                  size="small"
                  style={{
                    marginBottom: 12,
                    borderLeft: `3px solid ${index === workflowSteps.length - 1 ? '#52c41a' : '#1890ff'}`
                  }}
                  title={
                    <Space>
                      <Tag color={index === workflowSteps.length - 1 ? 'green' : 'blue'}>
                        步骤 {step.step_order}
                      </Tag>
                      {index === workflowSteps.length - 1 && <Tag color="green">最终审批</Tag>}
                    </Space>
                  }
                  extra={
                    <Space size={4}>
                      <Tooltip title="上移"><Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveStepUp(index)} /></Tooltip>
                      <Tooltip title="下移"><Button size="small" icon={<ArrowDownOutlined />} disabled={index === workflowSteps.length - 1} onClick={() => moveStepDown(index)} /></Tooltip>
                      <Tooltip title="删除"><Button size="small" danger icon={<MinusCircleOutlined />} onClick={() => removeWorkflowStep(index)} /></Tooltip>
                    </Space>
                  }
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>步骤名称</label>
                      <Input
                        value={step.name}
                        onChange={e => updateStep(index, 'name', e.target.value)}
                        placeholder="如：初审、专家评审"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>审批角色</label>
                      <Select
                        value={step.role}
                        onChange={val => updateStep(index, 'role', val)}
                        style={{ width: '100%' }}
                        placeholder="选择角色"
                        showSearch
                        allowClear
                      >
                        {roleOptions.map(r => (
                          <Option key={r.value} value={r.value}>{r.label}</Option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>等待状态 (pending_status)</label>
                      <Input
                        value={step.pending_status}
                        onChange={e => updateStep(index, 'pending_status', e.target.value)}
                        placeholder="如：submitted"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#666' }}>
                        通过后状态 (approved_status)
                        {step.approved_status === 'approved' && <Tag color="green" style={{ marginLeft: 4 }}>终态</Tag>}
                      </label>
                      <Input
                        value={step.approved_status}
                        onChange={e => updateStep(index, 'approved_status', e.target.value)}
                        placeholder={index === workflowSteps.length - 1 ? 'approved' : '如：first_reviewed'}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Space>
                      <Switch
                        size="small"
                        checked={step.allow_rollback}
                        onChange={val => updateStep(index, 'allow_rollback', val)}
                      />
                      <span style={{ fontSize: 13 }}>允许退回</span>
                    </Space>

                    {step.allow_rollback && (
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, color: '#666', marginRight: 8 }}>可退回至：</span>
                        <Checkbox
                          checked={step.rollback_targets?.includes(0)}
                          onChange={e => updateRollbackTargets(index, 0, e.target.checked)}
                        >
                          草稿
                        </Checkbox>
                        {workflowSteps.filter((_, i) => i < index).map((prevStep, i) => (
                          <Checkbox
                            key={prevStep.step_order}
                            checked={step.rollback_targets?.includes(prevStep.step_order)}
                            onChange={e => updateRollbackTargets(index, prevStep.step_order, e.target.checked)}
                          >
                            {prevStep.name}
                          </Checkbox>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {workflowSteps.length > 0 && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 4,
              fontSize: 13
            }}>
              <strong>审批路径预览：</strong>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <Tag>草稿</Tag>
                <span>→</span>
                {workflowSteps.map((step, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Tag color="blue">{step.name}({step.role})</Tag>
                    {i < workflowSteps.length - 1 && <span>→</span>}
                  </span>
                ))}
                <span>→</span>
                <Tag color="green">已立项</Tag>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Guidelines;
