import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, DatePicker, message, Tag, Card, Tabs, Switch,
  Checkbox, Tooltip, Popconfirm, Empty, Collapse, List, Descriptions, Row, Col, Statistic,
  Divider, Alert, Avatar, Badge, Steps, Typography, Spin
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined,
  MinusCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, FormOutlined, FileTextOutlined,
  PaperClipOutlined, CheckCircleOutlined, QuestionCircleOutlined, HistoryOutlined,
  CopyOutlined, RocketOutlined, TeamOutlined, ThunderboltOutlined, InfoCircleOutlined,
  FileSearchOutlined, BulbOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  getGuidelines, createGuideline, updateGuideline, deleteGuideline,
  getGuidelineRelated, createGuidelineTemplate, updateGuidelineTemplate,
  deleteGuidelineTemplate, createGuidelineFaq, updateGuidelineFaq,
  deleteGuidelineFaq, getGuidelineTemplates, getGuidelineFaqs
} from '../api/guidelines';
import {
  getWorkflowConfigByGuideline, createWorkflowConfig, updateWorkflowConfig,
  deleteWorkflowConfig, getWorkflowRoles
} from '../api/workflow';
import type {
  Guideline, WorkflowConfig, WorkflowConfigStep, WorkflowRoleOption,
  GuidelineRelated, DeclarationTemplate, Faq, MaterialType, HistoryCase
} from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

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
  const navigate = useNavigate();
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

  const [detailLoading, setDetailLoading] = useState(false);
  const [relatedData, setRelatedData] = useState<GuidelineRelated | null>(null);
  const [detailTab, setDetailTab] = useState('content');

  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeclarationTemplate | null>(null);
  const [templateForm] = Form.useForm();

  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [faqForm] = Form.useForm();

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

  const handleDetail = async (record: Guideline) => {
    setCurrentGuideline(record);
    setDetailLoading(true);
    setDetailTab('content');
    setDetailVisible(true);
    try {
      const res = await getGuidelineRelated(record.id);
      if (res.success && res.data) {
        setRelatedData(res.data);
      }
    } catch (error) {
      message.error('加载关联信息失败');
    }
    setDetailLoading(false);
  };

  const handleDelete = (record: Guideline) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除"${record.title}"吗？关联的工作流配置、模板、FAQ也会被删除。`,
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

  const handleStartDeclaration = (guideline: Guideline, templateId?: number) => {
    const params = new URLSearchParams();
    params.append('guideline_id', String(guideline.id));
    if (templateId) {
      params.append('template_id', String(templateId));
    }
    navigate(`/declarations/new?${params.toString()}`);
  };

  const handleUseTemplate = (template: DeclarationTemplate) => {
    if (currentGuideline) {
      handleStartDeclaration(currentGuideline, template.id);
      setDetailVisible(false);
    }
  };

  const handleCopyTemplateContent = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      message.success('模板内容已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const handleViewCase = (caseItem: HistoryCase) => {
    navigate(`/declarations/${caseItem.id}`);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    templateForm.resetFields();
    templateForm.setFieldsValue({ sort_order: 0, is_default: 0 });
    setTemplateModalVisible(true);
  };

  const handleEditTemplate = (tpl: DeclarationTemplate) => {
    setEditingTemplate(tpl);
    templateForm.setFieldsValue(tpl);
    setTemplateModalVisible(true);
  };

  const handleSaveTemplate = async () => {
    if (!currentGuideline) return;
    try {
      const values = await templateForm.validateFields();
      let res;
      if (editingTemplate) {
        res = await updateGuidelineTemplate(editingTemplate.id, values);
      } else {
        res = await createGuidelineTemplate(currentGuideline.id, values);
      }
      if (res.success) {
        message.success(editingTemplate ? '模板更新成功' : '模板创建成功');
        setTemplateModalVisible(false);
        const detailRes = await getGuidelineRelated(currentGuideline.id);
        if (detailRes.success && detailRes.data) {
          setRelatedData(detailRes.data);
        }
      }
    } catch (error) {
      message.error('保存模板失败');
    }
  };

  const handleDeleteTemplate = (tpl: DeclarationTemplate) => {
    if (!currentGuideline) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模板"${tpl.title}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteGuidelineTemplate(tpl.id);
          if (res.success) {
            message.success('删除成功');
            const detailRes = await getGuidelineRelated(currentGuideline.id);
            if (detailRes.success && detailRes.data) {
              setRelatedData(detailRes.data);
            }
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleAddFaq = () => {
    setEditingFaq(null);
    faqForm.resetFields();
    faqForm.setFieldsValue({ sort_order: 0 });
    setFaqModalVisible(true);
  };

  const handleEditFaq = (faq: Faq) => {
    setEditingFaq(faq);
    faqForm.setFieldsValue(faq);
    setFaqModalVisible(true);
  };

  const handleSaveFaq = async () => {
    if (!currentGuideline) return;
    try {
      const values = await faqForm.validateFields();
      let res;
      if (editingFaq) {
        res = await updateGuidelineFaq(editingFaq.id, values);
      } else {
        res = await createGuidelineFaq(currentGuideline.id, values);
      }
      if (res.success) {
        message.success(editingFaq ? 'FAQ更新成功' : 'FAQ创建成功');
        setFaqModalVisible(false);
        const detailRes = await getGuidelineRelated(currentGuideline.id);
        if (detailRes.success && detailRes.data) {
          setRelatedData(detailRes.data);
        }
      }
    } catch (error) {
      message.error('保存FAQ失败');
    }
  };

  const handleDeleteFaq = (faq: Faq) => {
    if (!currentGuideline) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除问题"${faq.question}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteGuidelineFaq(faq.id);
          if (res.success) {
            message.success('删除成功');
            const detailRes = await getGuidelineRelated(currentGuideline.id);
            if (detailRes.success && detailRes.data) {
              setRelatedData(detailRes.data);
            }
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
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

  const renderStats = () => {
    if (!relatedData) return null;
    const { stats } = relatedData;
    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic
            title="申报总数"
            value={stats.total_declarations}
            prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="已立项"
            value={stats.approved_count}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="立项通过率"
            value={stats.approval_rate}
            suffix="%"
            valueStyle={{ color: stats.approval_rate >= 60 ? '#52c41a' : '#faad14' }}
            prefix={<ThunderboltOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="进行中"
            value={stats.pending_count}
            valueStyle={{ color: '#1890ff' }}
            prefix={<TeamOutlined />}
          />
        </Col>
      </Row>
    );
  };

  const renderContentTab = () => {
    if (!relatedData) return null;
    const { guideline } = relatedData;
    return (
      <div>
        {renderStats()}
        <Card
          bordered={false}
          style={{ background: '#fafafa' }}
          title={
            <Space>
              <Tag color="blue">{guideline.category}</Tag>
              <Text type="secondary">
                截止日期: {guideline.deadline || '长期有效'}
                {guideline.deadline && dayjs(guideline.deadline).isBefore(dayjs()) && (
                  <Tag color="red" style={{ marginLeft: 8 }}>已截止</Tag>
                )}
                {guideline.deadline && dayjs(guideline.deadline).diff(dayjs(), 'day') <= 7 && dayjs(guideline.deadline).isAfter(dayjs()) && (
                  <Tag color="orange" style={{ marginLeft: 8 }}>即将截止</Tag>
                )}
              </Text>
            </Space>
          }
          extra={
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => handleStartDeclaration(guideline)}
            >
              立即申报
            </Button>
          }
        >
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {guideline.content}
          </div>
        </Card>

        <Divider orientation="left" plain>
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <Text strong>申报小贴士</Text>
          </Space>
        </Divider>
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="快速开始申报"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                1. 查看左侧「申报模板」标签，选择合适的模板一键开始申报
              </Paragraph>
              <Paragraph style={{ marginBottom: 8 }}>
                2. 查看「材料清单」标签，提前准备好所需材料
              </Paragraph>
              <Paragraph style={{ marginBottom: 8 }}>
                3. 参考「历史案例」标签，了解以往成功申报的经验
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                4. 如有疑问，查看「常见问题」标签获取解答
              </Paragraph>
            </div>
          }
        />
      </div>
    );
  };

  const renderTemplatesTab = () => {
    if (!relatedData) return null;
    const { templates } = relatedData;
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">共 {templates.length} 个模板</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTemplate}>
            新增模板
          </Button>
        </div>
        {templates.length === 0 ? (
          <Empty description="暂无申报模板" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
            dataSource={templates}
            renderItem={(tpl) => (
              <List.Item>
                <Card
                  hoverable
                  title={
                    <Space>
                      {tpl.is_default === 1 && <Tag color="gold">默认</Tag>}
                      <Text strong>{tpl.title}</Text>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Tooltip title="使用此模板申报">
                        <Button
                          type="primary"
                          size="small"
                          icon={<FormOutlined />}
                          onClick={() => handleUseTemplate(tpl)}
                        >
                          立即使用
                        </Button>
                      </Tooltip>
                      <Tooltip title="复制内容">
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopyTemplateContent(tpl.content)}
                        />
                      </Tooltip>
                      <Tooltip title="编辑">
                        <Button size="small" icon={<EditOutlined />} onClick={() => handleEditTemplate(tpl)} />
                      </Tooltip>
                      <Popconfirm title="确定删除此模板？" onConfirm={() => handleDeleteTemplate(tpl)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  }
                  style={{ height: '100%' }}
                >
                  <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {tpl.description || '暂无描述'}
                  </Paragraph>
                  <div
                    style={{
                      maxHeight: 120,
                      overflow: 'hidden',
                      background: '#f5f5f5',
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#666',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {tpl.content}
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>
    );
  };

  const renderMaterialsTab = () => {
    if (!relatedData) return null;
    const { materials } = relatedData;
    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          共 {materials.length} 项材料要求
        </Text>
        {materials.length === 0 ? (
          <Empty description="暂无材料要求" />
        ) : (
          <List
            dataSource={materials}
            renderItem={(mt: MaterialType & { usage_count?: number }) => (
              <List.Item key={mt.id}>
                <Card
                  style={{ width: '100%' }}
                  size="small"
                  title={
                    <Space>
                      {mt.required ? (
                        <Tag color="red" icon={<InfoCircleOutlined />}>必需</Tag>
                      ) : (
                        <Tag color="blue">可选</Tag>
                      )}
                      <Text strong>{mt.name}</Text>
                      <Text type="secondary" code>{mt.code}</Text>
                    </Space>
                  }
                >
                  <Paragraph style={{ marginBottom: 8 }}>
                    {mt.description || '暂无描述'}
                  </Paragraph>
                  <Space size="large">
                    <Text type="secondary">
                      <PaperClipOutlined style={{ marginRight: 4 }} />
                      允许格式: {mt.allowed_extensions || '不限'}
                    </Text>
                    <Text type="secondary">
                      最大大小: {mt.max_size ? `${Math.round(mt.max_size / 1024 / 1024)}MB` : '不限'}
                    </Text>
                    {mt.usage_count !== undefined && mt.usage_count > 0 && (
                      <Tag color="green">已上传 {mt.usage_count} 次</Tag>
                    )}
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>
    );
  };

  const renderCasesTab = () => {
    if (!relatedData) return null;
    const { history_cases } = relatedData;
    return (
      <div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          共 {history_cases.length} 个成功案例
        </Text>
        {history_cases.length === 0 ? (
          <Empty description="暂无历史案例" />
        ) : (
          <List
            dataSource={history_cases}
            renderItem={(caseItem) => (
              <List.Item
                key={caseItem.id}
                actions={[
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewCase(caseItem)}
                  >
                    查看详情
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<FileSearchOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                  title={
                    <Space>
                      <Text strong>{caseItem.title}</Text>
                      <Tag color="green" icon={<CheckCircleOutlined />}>已立项</Tag>
                      {caseItem.approval_count !== undefined && caseItem.approval_count > 0 && (
                        <Tag color="blue">{caseItem.approval_count} 轮审批</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <Space>
                        <Text type="secondary"><TeamOutlined /> {caseItem.company}</Text>
                        <Text type="secondary">申请人: {caseItem.applicant}</Text>
                        <Text type="secondary">
                          <HistoryOutlined /> {dayjs(caseItem.created_at).format('YYYY-MM-DD')}
                        </Text>
                      </Space>
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ marginBottom: 0, color: '#666' }}
                      >
                        {caseItem.content}
                      </Paragraph>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    );
  };

  const renderFaqsTab = () => {
    if (!relatedData) return null;
    const { faqs } = relatedData;
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">共 {faqs.length} 个常见问题</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFaq}>
            新增问题
          </Button>
        </div>
        {faqs.length === 0 ? (
          <Empty description="暂无常见问题" />
        ) : (
          <Collapse accordion>
            {faqs.map((faq) => (
              <Panel
                key={faq.id}
                header={
                  <Space>
                    <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                    <span>{faq.question}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <Space>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleEditFaq(faq); }}
                        />
                        <Popconfirm
                          title="确定删除此问题？"
                          onConfirm={(e) => { e?.stopPropagation(); handleDeleteFaq(faq); }}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </Space>
                    </span>
                  </Space>
                }
              >
                <div style={{ whiteSpace: 'pre-wrap', padding: '8px 0' }}>
                  {faq.answer}
                </div>
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    );
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
      width: 140,
      render: (text: string | null) => (
        <Space>
          {text || '长期有效'}
          {text && dayjs(text).isBefore(dayjs()) && (
            <Tag color="red">已截止</Tag>
          )}
          {text && dayjs(text).diff(dayjs(), 'day') <= 7 && dayjs(text).isAfter(dayjs()) && (
            <Tag color="orange">即将截止</Tag>
          )}
        </Space>
      )
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
      width: 340,
      render: (_: any, record: Guideline) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>查看</Button>
          <Button type="primary" size="small" icon={<RocketOutlined />} onClick={() => handleStartDeclaration(record)}>申报</Button>
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
          currentGuideline && (
            <Button
              key="declare"
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => handleStartDeclaration(currentGuideline)}
            >
              立即申报
            </Button>
          ),
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={960}
        destroyOnClose
      >
        <Spin spinning={detailLoading} tip="加载中...">
          <Tabs activeKey={detailTab} onChange={setDetailTab}>
            <TabPane
              tab={
                <span>
                  <FileTextOutlined />
                  指南内容
                </span>
              }
              key="content"
            >
              {renderContentTab()}
            </TabPane>
            <TabPane
              tab={
                <span>
                  <FormOutlined />
                  申报模板
                  {relatedData?.stats.template_count !== undefined && relatedData.stats.template_count > 0 && (
                    <Badge
                      count={relatedData.stats.template_count}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </span>
              }
              key="templates"
            >
              {renderTemplatesTab()}
            </TabPane>
            <TabPane
              tab={
                <span>
                  <PaperClipOutlined />
                  材料清单
                  {relatedData && (
                    <Badge
                      count={relatedData.materials.filter(m => m.required).length}
                      style={{ marginLeft: 4, backgroundColor: '#ff4d4f' }}
                      title="必需材料数"
                    />
                  )}
                </span>
              }
              key="materials"
            >
              {renderMaterialsTab()}
            </TabPane>
            <TabPane
              tab={
                <span>
                  <HistoryOutlined />
                  历史案例
                  {relatedData?.stats.approved_count !== undefined && relatedData.stats.approved_count > 0 && (
                    <Badge
                      count={relatedData.stats.approved_count}
                      style={{ marginLeft: 4, backgroundColor: '#52c41a' }}
                    />
                  )}
                </span>
              }
              key="cases"
            >
              {renderCasesTab()}
            </TabPane>
            <TabPane
              tab={
                <span>
                  <QuestionCircleOutlined />
                  常见问题
                  {relatedData?.stats.faq_count !== undefined && relatedData.stats.faq_count > 0 && (
                    <Badge
                      count={relatedData.stats.faq_count}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </span>
              }
              key="faqs"
            >
              {renderFaqsTab()}
            </TabPane>
          </Tabs>
        </Spin>
      </Modal>

      <Modal
        title={editingTemplate ? '编辑申报模板' : '新增申报模板'}
        open={templateModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => setTemplateModalVisible(false)}
        width={640}
        destroyOnClose
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="title"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="如：科技型中小企业创新基金申报模板" />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <Input placeholder="简要说明模板的适用场景" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序" initialValue={0}>
                <Input type="number" placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_default" label="设为默认模板" valuePropName="checked" initialValue={false}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="content"
            label="模板内容"
            rules={[{ required: true, message: '请输入模板内容' }]}
          >
            <TextArea rows={12} placeholder="请输入申报模板内容，使用换行分隔各章节" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingFaq ? '编辑常见问题' : '新增常见问题'}
        open={faqModalVisible}
        onOk={handleSaveFaq}
        onCancel={() => setFaqModalVisible(false)}
        width={640}
        destroyOnClose
      >
        <Form form={faqForm} layout="vertical">
          <Form.Item
            name="question"
            label="问题"
            rules={[{ required: true, message: '请输入问题' }]}
          >
            <Input placeholder="请输入问题" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}>
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
          <Form.Item
            name="answer"
            label="回答"
            rules={[{ required: true, message: '请输入回答' }]}
          >
            <TextArea rows={6} placeholder="请输入详细的回答内容" />
          </Form.Item>
        </Form>
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
