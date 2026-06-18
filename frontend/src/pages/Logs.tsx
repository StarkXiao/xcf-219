import { useEffect, useState } from 'react';
import { Card, Table, Tag, Input, Select, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { OperationLog } from '../types';

const { Option } = Select;

function Logs() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (keyword) params.append('keyword', keyword);
      if (moduleFilter) params.append('module', moduleFilter);
      if (userFilter) params.append('user', userFilter);

      const res = await fetch(`/api/logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.list || []);
        setTotal(json.data.total || 0);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [keyword, moduleFilter, userFilter, page, pageSize]);

  const actionColorMap: Record<string, string> = {
    创建: 'green',
    更新: 'blue',
    删除: 'red',
    提交: 'cyan',
    审批通过: 'green',
    审批驳回: 'red',
    审批退回: 'orange',
    查看: 'default',
    登录: 'purple',
    查询: 'default',
    '政策匹配推荐': 'geekblue',
    '选择推荐政策': 'green'
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '用户',
      dataIndex: 'user',
      width: 120,
      render: (user: string) => user || 'system'
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 120,
      render: (action: string) => (
        <Tag color={actionColorMap[action] || 'default'}>{action}</Tag>
      )
    },
    {
      title: '模块',
      dataIndex: 'module',
      width: 120
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      width: 80
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: (detail: string) => (
        <div style={{
          maxWidth: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {detail || '-'}
        </div>
      )
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      width: 140
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      width: 180
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>操作日志</h2>
      </div>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            placeholder="搜索详情内容"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            onPressEnter={() => { setPage(1); loadData(); }}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="选择模块"
            value={moduleFilter || undefined}
            onChange={(v) => { setModuleFilter(v || ''); setPage(1); }}
            allowClear
            style={{ width: 160 }}
          >
            <Option value="申报表单">申报表单</Option>
            <Option value="申报指南">申报指南</Option>
            <Option value="附件">附件</Option>
            <Option value="状态流转">状态流转</Option>
            <Option value="筛选方案">筛选方案</Option>
            <Option value="政策匹配">政策匹配</Option>
          </Select>
          <Select
            placeholder="选择用户"
            value={userFilter || undefined}
            onChange={(v) => { setUserFilter(v || ''); setPage(1); }}
            allowClear
            style={{ width: 160 }}
          >
            <Option value="anonymous">anonymous</Option>
            <Option value="system">system</Option>
          </Select>
          <Space>
            <button
              className="ant-btn ant-btn-primary"
              onClick={() => { setPage(1); loadData(); }}
              style={{ height: 32, padding: '0 15px' }}
            >
              搜索
            </button>
            <button
              className="ant-btn"
              onClick={() => {
                setKeyword('');
                setModuleFilter('');
                setUserFilter('');
                setPage(1);
              }}
              style={{ height: 32, padding: '0 15px' }}
            >
              重置
            </button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      </Card>
    </div>
  );
}

export default Logs;
