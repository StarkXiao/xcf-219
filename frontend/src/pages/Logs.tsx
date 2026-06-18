import { useState, useEffect } from 'react';
import { Card, Table, Select, Input, Button, Space, Tag, Row, Col, Statistic, List } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLogs, getLogStatistics } from '../api/logs';
import type { OperationLog } from '../types';

const { Option } = Select;

function Logs() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [module, setModule] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [user, setUser] = useState('');
  const [statistics, setStatistics] = useState<{
    total: number;
    by_module: { module: string; count: number }[];
    by_action: { action: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    loadLogs();
    loadStatistics();
  }, [page, pageSize]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getLogs({ module, action, user, page, pageSize });
      if (res.success) {
        setLogs(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    }
    setLoading(false);
  };

  const loadStatistics = async () => {
    try {
      const res = await getLogStatistics();
      if (res.success) {
        setStatistics(res.data || null);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadLogs();
  };

  const getModuleColor = (mod: string) => {
    const colors: Record<string, string> = {
      '申报指南': 'blue',
      '申报表单': 'green',
      '附件': 'orange',
      '状态流转': 'purple',
      '审批': 'cyan',
      '日志': 'magenta'
    };
    return colors[mod] || 'default';
  };

  const getActionColor = (act: string) => {
    const colors: Record<string, string> = {
      '创建': 'green',
      '更新': 'blue',
      '删除': 'red',
      '查询': 'default',
      '查看详情': 'cyan',
      '上传': 'orange',
      '下载': 'purple',
      '审批通过': 'green',
      '审批驳回': 'red',
      '审批退回': 'orange',
      '提交': 'blue'
    };
    return colors[act] || 'default';
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 120
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
      render: (text: string) => text ? <Tag color={getModuleColor(text)}>{text}</Tag> : '-'
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (text: string) => <Tag color={getActionColor(text)}>{text}</Tag>
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 80,
      render: (text: number | null) => text || '-'
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">操作日志</h2>
      </div>

      {statistics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总操作数" value={statistics.total} />
            </Card>
          </Col>
          <Col span={9}>
            <Card title="按模块统计" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {statistics.by_module.map(item => (
                  <Tag key={item.module} color={getModuleColor(item.module)}>
                    {item.module}: {item.count}
                  </Tag>
                ))}
              </div>
            </Card>
          </Col>
          <Col span={9}>
            <Card title="按操作统计" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {statistics.by_action.slice(0, 8).map(item => (
                  <Tag key={item.action} color={getActionColor(item.action)}>
                    {item.action}: {item.count}
                  </Tag>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <div className="filter-bar">
          <Select
            placeholder="选择模块"
            value={module}
            onChange={setModule}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="申报指南">申报指南</Option>
            <Option value="申报表单">申报表单</Option>
            <Option value="附件">附件</Option>
            <Option value="状态流转">状态流转</Option>
            <Option value="审批">审批</Option>
          </Select>
          <Select
            placeholder="选择操作"
            value={action}
            onChange={setAction}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="创建">创建</Option>
            <Option value="更新">更新</Option>
            <Option value="删除">删除</Option>
            <Option value="查询">查询</Option>
            <Option value="查看详情">查看详情</Option>
            <Option value="上传">上传</Option>
            <Option value="审批通过">审批通过</Option>
            <Option value="审批驳回">审批驳回</Option>
          </Select>
          <Input
            placeholder="搜索用户"
            prefix={<SearchOutlined />}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
        </div>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            }
          }}
        />
      </Card>
    </div>
  );
}

export default Logs;
