import { useEffect, useState } from 'react';
import { Table, Button, Space, Input, Select, Modal, Form, DatePicker, message, Tag, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getGuidelines, createGuideline, updateGuideline, deleteGuideline } from '../api/guidelines';
import type { Guideline } from '../types';

const { TextArea } = Input;
const { Option } = Select;

function Guidelines() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentGuideline, setCurrentGuideline] = useState<Guideline | null>(null);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [form] = Form.useForm();

  useEffect(() => {
    loadGuidelines();
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
      content: `确定要删除"${record.title}"吗？`,
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
      width: 200,
      render: (_: any, record: Guideline) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>查看</Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
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
    </div>
  );
}

export default Guidelines;
