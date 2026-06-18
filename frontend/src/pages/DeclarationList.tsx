import { useEffect, useState } from 'react';
import { Table, Button, Space, Input, Select, Modal, message, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDeclarations, deleteDeclaration, submitDeclaration } from '../api/declarations';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration } from '../types';

const { Option } = Select;

function DeclarationList() {
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  useEffect(() => {
    loadDeclarations();
  }, []);

  const loadDeclarations = async () => {
    setLoading(true);
    try {
      const res = await getDeclarations({ keyword, status });
      if (res.success) {
        setDeclarations(res.data || []);
      }
    } catch (error) {
      message.error('加载申报列表失败');
    }
    setLoading(false);
  };

  const handleSearch = () => {
    loadDeclarations();
  };

  const handleAdd = () => {
    navigate('/declarations/new');
  };

  const handleEdit = (id: number) => {
    navigate(`/declarations/${id}/edit`);
  };

  const handleDetail = (id: number) => {
    navigate(`/declarations/${id}`);
  };

  const handleSubmit = (record: Declaration) => {
    Modal.confirm({
      title: '确认提交',
      content: `确定要提交"${record.title}"吗？提交后将进入审批流程，无法再编辑。`,
      onOk: async () => {
        try {
          const res = await submitDeclaration(record.id);
          if (res.success) {
            message.success('提交成功');
            loadDeclarations();
          }
        } catch (error) {
          message.error('提交失败');
        }
      }
    });
  };

  const handleDelete = (record: Declaration) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除"${record.title}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteDeclaration(record.id);
          if (res.success) {
            message.success('删除成功');
            loadDeclarations();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const columns = [
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
      ellipsis: true,
      render: (text: string, record: Declaration) => (
        <a onClick={() => handleDetail(record.id)}>{text}</a>
      )
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
      title: '关联指南',
      dataIndex: 'guideline_title',
      key: 'guideline_title',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-'
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
      width: 240,
      render: (_: any, record: Declaration) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleDetail(record.id)}>
            详情
          </Button>
          {record.status === 'draft' && (
            <>
              <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record.id)}>
                编辑
              </Button>
              <Button type="link" icon={<SendOutlined />} onClick={() => handleSubmit(record)}>
                提交
              </Button>
              <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                删除
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">申报管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建申报
        </Button>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索项目名称或内容"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 300 }}
          onPressEnter={handleSearch}
        />
        <Select
          placeholder="选择状态"
          value={status}
          onChange={setStatus}
          style={{ width: 150 }}
          allowClear
        >
          <Option value="draft">草稿</Option>
          <Option value="submitted">待初审</Option>
          <Option value="first_reviewed">待复审</Option>
          <Option value="second_reviewed">待终审</Option>
          <Option value="approved">已立项</Option>
          <Option value="rejected">已驳回</Option>
        </Select>
        <Button type="primary" onClick={handleSearch}>搜索</Button>
      </div>

      <Table
        columns={columns}
        dataSource={declarations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}

export default DeclarationList;
