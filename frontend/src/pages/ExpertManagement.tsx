import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Descriptions,
  Row,
  Col,
  Statistic,
  Popconfirm,
  App as AntdApp,
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined
} from '@ant-design/icons';
import {
  getExperts,
  getExpertFields,
  createExpert,
  updateExpert,
  deleteExpert,
  getExpert
} from '../api/expertReview';
import type { Expert, ExpertLevel, ExpertStatus } from '../types/expertReview';
import {
  ExpertLevelMap,
  ExpertLevelColorMap,
  ExpertStatusMap,
  ExpertStatusColorMap
} from '../types/expertReview';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const ExpertManagement: React.FC = () => {
  const { message, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ExpertStatus | 'all'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null);
  const [detailExpert, setDetailExpert] = useState<Expert | null>(null);
  const [form] = Form.useForm();

  const fetchFields = async () => {
    try {
      const res = await getExpertFields();
      if (res.success && res.data) setFields(res.data);
    } catch (e) { /* ignore */ }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (keyword) params.keyword = keyword;
      if (fieldFilter !== 'all') params.field = fieldFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getExperts(params);
      if (res.success && res.data) setExperts(res.data as unknown as Expert[]);
    } catch (e: any) {
      message.error('获取专家列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingExpert(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (expert: Expert) => {
    setEditingExpert(expert);
    form.setFieldsValue({
      name: expert.name,
      code: expert.code,
      title: expert.title,
      organization: expert.organization,
      field: expert.field,
      specialties: expert.specialties,
      phone: expert.phone,
      email: expert.email,
      level: expert.level,
      status: expert.status
    });
    setModalOpen(true);
  };

  const handleView = async (expert: Expert) => {
    try {
      const res = await getExpert(expert.id);
      if (res.success && res.data) {
        setDetailExpert(res.data);
        setDetailOpen(true);
      }
    } catch (e: any) {
      message.error('获取专家详情失败');
    }
  };

  const handleDelete = async (expert: Expert) => {
    try {
      const res = await deleteExpert(expert.id);
      if (res.success) {
        message.success('删除成功');
        fetchData();
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingExpert) {
        const res = await updateExpert(editingExpert.id, values);
        if (res.success) {
          message.success('更新成功');
          setModalOpen(false);
          fetchData();
        }
      } else {
        const res = await createExpert(values);
        if (res.success) {
          message.success('添加成功');
          setModalOpen(false);
          fetchData();
        }
      }
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '保存失败');
    }
  };

  const columns = [
    {
      title: '专家编号',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (v: string) => <Text code>{v || '-'}</Text>
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (v: string, record: Expert) => (
        <a onClick={() => handleView(record)} style={{ fontWeight: 500 }}>{v}</a>
      )
    },
    {
      title: '职称',
      dataIndex: 'title',
      key: 'title',
      width: 120
    },
    {
      title: '所在单位',
      dataIndex: 'organization',
      key: 'organization',
      ellipsis: true
    },
    {
      title: '领域',
      dataIndex: 'field',
      key: 'field',
      width: 100,
      render: (v: string) => v ? <Tag color="purple">{v}</Tag> : '-'
    },
    {
      title: '专长',
      dataIndex: 'specialties',
      key: 'specialties',
      width: 180,
      render: (v: string) => v ? (
        <Space size={[4, 4]} wrap>
          {v.split(/[,，]/).map((s, i) => (
            <Tag key={i} color="blue" style={{ margin: 0, fontSize: 12 }}>{s.trim()}</Tag>
          ))}
        </Space>
      ) : '-'
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (v: ExpertLevel) => (
        <Tag color={ExpertLevelColorMap[v]}>{ExpertLevelMap[v]}</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: ExpertStatus) => (
        <Tag color={ExpertStatusColorMap[v]}>{ExpertStatusMap[v]}</Tag>
      )
    },
    {
      title: '评审统计',
      key: 'stats',
      width: 150,
      render: (_: any, r: Expert) => (
        <Space direction="vertical" size={2}>
          <Text>共 <Text strong>{r.review_count || 0}</Text> 次</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            均分: {r.avg_score ? r.avg_score.toFixed(1) : '-'}
          </Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: Expert) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确定删除该专家？"
            description="如该专家已有评审任务，则无法删除"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const activeCount = experts.filter(e => e.status === 'active').length;
  const seniorCount = experts.filter(e => e.level === 'senior').length;

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Statistic
                title="专家总数"
                value={experts.length}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="活跃专家"
                value={activeCount}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="资深专家"
                value={seniorCount}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
          </Row>
        </Card>

        <Card
          title="专家库"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增专家</Button>
            </Space>
          }
        >
          <Space style={{ marginBottom: 16 }} wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索姓名/编号/单位/专长"
              allowClear
              style={{ width: 280 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={fetchData}
            />
            <Select
              value={fieldFilter}
              onChange={setFieldFilter}
              style={{ width: 160 }}
              placeholder="选择领域"
              allowClear
              onClear={() => { setFieldFilter('all'); }}
            >
              <Option value="all">全部领域</Option>
              {fields.map(f => (
                <Option key={f} value={f}>{f}</Option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(v: ExpertStatus | 'all') => setStatusFilter(v)}
              style={{ width: 140 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="active">活跃</Option>
              <Option value="inactive">停用</Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>搜索</Button>
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={experts}
            columns={columns}
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 位专家`
            }}
          />
        </Card>
      </Space>

      <Modal
        title={editingExpert ? '编辑专家' : '新增专家'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入专家姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="专家编号">
                <Input placeholder="自动生成或自定义" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="职称">
                <Input placeholder="如：教授、研究员、高工" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level" label="专家级别" initialValue="general">
                <Select>
                  <Option value="general">普通专家</Option>
                  <Option value="senior">资深专家</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="organization" label="所在单位">
            <Input placeholder="请输入工作单位名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="field" label="专业领域">
                <Select
                  allowClear
                  showSearch
                  placeholder="选择或输入领域"
                  mode={undefined}
                  options={fields.map(f => ({ value: f, label: f }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="active">
                <Select>
                  <Option value="active">活跃</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="specialties" label="专业专长">
            <Input.TextArea
              rows={2}
              placeholder="多个专长用逗号分隔，如：人工智能,机器学习,大数据"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="联系电话"
                rules={[{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }]}
              >
                <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ type: 'email', message: '邮箱格式不正确' }]}
              >
                <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="专家详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => {
            setDetailOpen(false);
            if (detailExpert) handleEdit(detailExpert);
          }}>编辑</Button>,
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>
        ]}
        width={720}
        destroyOnClose
      >
        {detailExpert && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="姓名" span={1}>
                <Text strong style={{ fontSize: 16 }}>{detailExpert.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="编号">{detailExpert.code || '-'}</Descriptions.Item>
              <Descriptions.Item label="职称">{detailExpert.title || '-'}</Descriptions.Item>
              <Descriptions.Item label="级别">
                <Tag color={ExpertLevelColorMap[detailExpert.level]}>{ExpertLevelMap[detailExpert.level]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="所在单位" span={2}>{detailExpert.organization || '-'}</Descriptions.Item>
              <Descriptions.Item label="专业领域">
                {detailExpert.field ? <Tag color="purple">{detailExpert.field}</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={ExpertStatusColorMap[detailExpert.status]}>
                  {ExpertStatusMap[detailExpert.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="专业专长" span={2}>
                {detailExpert.specialties ? (
                  <Space size={[4, 4]} wrap>
                    {detailExpert.specialties.split(/[,，]/).map((s, i) => (
                      <Tag key={i} color="blue">{s.trim()}</Tag>
                    ))}
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="电话">
                {detailExpert.phone ? <Space><PhoneOutlined />{detailExpert.phone}</Space> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {detailExpert.email ? <Space><MailOutlined />{detailExpert.email}</Space> : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="评审统计" type="inner">
              <Row gutter={16}>
                <Col xs={12} sm={8}>
                  <Statistic title="累计评审次数" value={detailExpert.review_count || 0} />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic
                    title="平均打分"
                    value={detailExpert.avg_score ? detailExpert.avg_score.toFixed(2) : '-'}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic
                    title="最近评审时间"
                    value={detailExpert.last_review_at ? dayjs(detailExpert.last_review_at).format('YYYY-MM-DD') : '无'}
                  />
                </Col>
              </Row>
            </Card>

            {detailExpert.recent_tasks && detailExpert.recent_tasks.length > 0 && (
              <Card size="small" title="最近评审任务" type="inner">
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={detailExpert.recent_tasks}
                  pagination={false}
                  columns={[
                    { title: '申报项目', dataIndex: 'declaration_title' },
                    { title: '分组', dataIndex: 'group_name' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (v) => <Tag>{v}</Tag>
                    },
                    {
                      title: '得分',
                      dataIndex: 'total_score',
                      render: (v) => v ? v.toFixed(2) : '-'
                    },
                    {
                      title: '分配时间',
                      dataIndex: 'assigned_at',
                      render: (v) => dayjs(v).format('YYYY-MM-DD')
                    }
                  ]}
                />
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ExpertManagement;
