import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Modal, Form, Select, DatePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getGuidelines, createGuideline, updateGuideline, deleteGuideline } from '../api/guidelines';
import type { Guideline } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;

function Guidelines() {
  const navigate = useNavigate();
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getGuidelines({ keyword });
      if (res.success) {
        setGuidelines(res.data || []);
      }
    } catch (error) {
      console.error('加载指南失败:', error);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    loadData();
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Guideline) => {
    setEditingId(record.id);
    form.setFieldsValue({
      title: record.title,
      category: record.category,
      deadline: record.deadline ? dayjs(record.deadline) : null,
      content: record.content
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await deleteGuideline(id);
      if (res.success) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : null
      };
      let res;
      if (editingId) {
        res = await updateGuideline(editingId, data);
      } else {
        res = await createGuideline(data);
      }
      if (res.success) {
        message.success(editingId ? '更新成功' : '创建成功');
        setModalOpen(false);
        loadData();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (text: string, record: Guideline) => (
        <a onClick={() => navigate(`/guidelines/${record.id}`)} style={{ color: '#1890ff' }}>
          {text}
        </a>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (category: string) => <Tag color="blue">{category || '未分类'}</Tag>
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      width: 140,
      render: (deadline: string) => deadline || '长期有效'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Guideline) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该指南吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title" style={{ margin: 0 }}>申报指南</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建指南
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input
            placeholder="搜索指南标题或内容"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={guidelines}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑指南' : '新建指南'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入指南标题" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="category" label="分类" style={{ flex: 1 }}>
              <Select placeholder="请选择分类">
                <Option value="科技项目">科技项目</Option>
                <Option value="企业发展">企业发展</Option>
                <Option value="资质认定">资质认定</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
            <Form.Item name="deadline" label="截止日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={12} placeholder="请输入指南详细内容" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Guidelines;
