import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, Empty } from 'antd';
import { SearchOutlined, RollbackOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { restoreDeclaration } from '../api/declarations';
import type { RecycleBinItem } from '../types';

const { Option } = Select;

function RecycleBin() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/declarations/recycle-bin?keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.list || []);
        setTotal(json.data.total || 0);
      }
    } catch (error) {
      console.error('加载回收站失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [keyword, page, pageSize]);

  const handleRestore = async (id: number) => {
    try {
      const res = await restoreDeclaration(id);
      if (res.success) {
        alert('恢复成功');
        loadData();
      }
    } catch (error) {
      alert('恢复失败');
    }
  };

  const handlePermanentDelete = (id: number) => {
    if (confirm('确定永久删除该申报吗？此操作不可恢复！')) {
      fetch(`/api/declarations/${id}?permanent=true`, { method: 'DELETE' })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            alert('永久删除成功');
            loadData();
          }
        });
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '项目名称',
      dataIndex: 'title',
      render: (text: string, record: RecycleBinItem) => (
        <span style={{ color: '#999' }}>{text}</span>
      )
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 100
    },
    {
      title: '企业名称',
      dataIndex: 'company',
      width: 200
    },
    {
      title: '关联指南',
      dataIndex: 'guideline_title',
      width: 200,
      render: (title: string) => title || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => <Tag>{status}</Tag>
    },
    {
      title: '删除时间',
      dataIndex: 'deleted_at',
      width: 180
    },
    {
      title: '删除人',
      dataIndex: 'deleted_by',
      width: 100
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: RecycleBinItem) => (
        <Space size="small">
          <Button type="link" icon={<RollbackOutlined />} onClick={() => handleRestore(record.id)}>
            恢复
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handlePermanentDelete(record.id)}>
            永久删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>回收站</h2>
      </div>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input
            placeholder="搜索项目名称或内容"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            onPressEnter={() => { setPage(1); loadData(); }}
            style={{ width: 300 }}
            allowClear
          />
          <Button type="primary" onClick={() => { setPage(1); loadData(); }}>搜索</Button>
        </div>

        {items.length === 0 && !loading ? (
          <Empty description="回收站暂无内容" style={{ padding: '60px 0' }} />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              }
            }}
          />
        )}
      </Card>
    </div>
  );
}

export default RecycleBin;
