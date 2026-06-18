import { useEffect, useState } from 'react';
import { Table, Button, Space, Input, Select, Modal, message, Tag, Tooltip, Badge } from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, DeleteFilled, HistoryOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDeclarations, deleteDeclaration, submitDeclaration, getDeclarationStats } from '../api/declarations';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration, DeclarationStats } from '../types';

const { Option } = Select;

function DeclarationList() {
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [stats, setStats] = useState<DeclarationStats | null>(null);

  useEffect(() => {
    loadDeclarations();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await getDeclarationStats();
      if (res.success) setStats(res.data ?? null);
    } catch (e) {}
  };

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
      title: '删除申报',
      icon: <DeleteOutlined style={{ color: '#faad14' }} />,
      content: (
        <div>
          <p>确定要删除 <strong>"{record.title}"</strong> 吗？</p>
          <div style={{ fontSize: 12, color: '#666', marginTop: 8, padding: 8, background: '#fffbe6', borderRadius: 4 }}>
            <strong>💡 提示：</strong>删除后将移至回收站，30天内可恢复。超过30天将自动永久删除。
            {record.version_count ? ` 将同时保留 ${record.version_count} 个历史版本。` : ''}
          </div>
        </div>
      ),
      okText: '移至回收站',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteDeclaration(record.id);
          if (res.success) {
            message.success('已移至回收站，可在回收站中恢复');
            loadDeclarations();
            loadStats();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>申报管理</h2>
          {stats && (
            <Space size="small" wrap>
              <Tag color="blue">总数: {stats.total}</Tag>
              <Tag color="default">草稿: {stats.draft}</Tag>
              <Tag color="purple">审批中: {stats.in_progress}</Tag>
              <Tag color="green">已立项: {stats.approved}</Tag>
              <Tag color="red">已驳回: {stats.rejected}</Tag>
            </Space>
          )}
        </div>
        <Space>
          <Tooltip title="查看误删的申报，可恢复或永久删除">
            <Badge count={stats?.deleted || 0} size="small" offset={[-4, 4]}>
              <Button
                icon={<DeleteFilled />}
                onClick={() => navigate('/recycle-bin')}
                danger={!!(stats?.deleted && stats.deleted > 0)}
              >
                回收站
              </Button>
            </Badge>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建申报
          </Button>
        </Space>
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
