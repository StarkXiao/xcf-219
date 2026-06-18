import { useState, useEffect } from 'react';
import {
  Card, Table, Select, Input, Button, Space, Tag, Row, Col, Statistic,
  Modal, Drawer, Timeline, Tooltip, Divider, Alert, Descriptions, Collapse, Badge
} from 'antd';
import {
  SearchOutlined, HistoryOutlined, EyeOutlined, DiffOutlined,
  FieldTimeOutlined, UserOutlined, GlobalOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getLogs, getLogStatistics, getLogById } from '../api/logs';
import type { OperationLog } from '../types';

const { Option } = Select;

const MODULE_OPTIONS = [
  { value: '申报指南', label: '申报指南' },
  { value: '申报表单', label: '申报表单' },
  { value: '版本管理', label: '版本管理' },
  { value: '附件', label: '附件' },
  { value: '状态流转', label: '状态流转' },
  { value: '审批', label: '审批' },
  { value: '操作日志', label: '操作日志' }
];

const ACTION_OPTIONS = [
  { value: '创建', label: '创建' },
  { value: '更新', label: '更新' },
  { value: '删除', label: '删除' },
  { value: '删除(软删除)', label: '删除(软删除)' },
  { value: '恢复删除', label: '恢复删除' },
  { value: '查询', label: '查询' },
  { value: '查看详情', label: '查看详情' },
  { value: '查看回收站', label: '查看回收站' },
  { value: '清空回收站', label: '清空回收站' },
  { value: '上传', label: '上传' },
  { value: '下载', label: '下载' },
  { value: '自动保存', label: '自动保存' },
  { value: '保存版本', label: '保存版本' },
  { value: '恢复版本', label: '恢复版本' },
  { value: '审批通过', label: '审批通过' },
  { value: '审批驳回', label: '审批驳回' },
  { value: '审批退回', label: '审批退回' },
  { value: '提交', label: '提交' }
];

type ExtendedLog = OperationLog & {
  before_data_parsed?: Record<string, any>;
  after_data_parsed?: Record<string, any>;
  changed_fields_parsed?: string[];
};

function Logs() {
  const [logs, setLogs] = useState<ExtendedLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [module, setModule] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [user, setUser] = useState('');
  const [targetId, setTargetId] = useState<string>('');
  const [statistics, setStatistics] = useState<{
    total: number;
    by_module: { module: string; count: number }[];
    by_action: { action: string; count: number }[];
    by_user?: { user: string; count: number }[];
    by_day?: { date: string; count: number }[];
  } | null>(null);

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<ExtendedLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadLogs();
    loadStatistics();
  }, [page, pageSize]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await getLogs({
        module,
        action,
        user,
        target_id: targetId ? parseInt(targetId) : undefined,
        page,
        pageSize,
        include_data: true
      });
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

  const handleViewDetail = async (record: ExtendedLog) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await getLogById(record.id);
      if (res.success && res.data) {
        setCurrentDetail(res.data);
      } else {
        setCurrentDetail(record);
      }
    } catch (e) {
      setCurrentDetail(record);
    }
    setDetailLoading(false);
  };

  const getModuleColor = (mod: string) => {
    const colors: Record<string, string> = {
      '申报指南': 'blue',
      '申报表单': 'green',
      '版本管理': 'geekblue',
      '附件': 'orange',
      '状态流转': 'purple',
      '审批': 'cyan',
      '操作日志': 'magenta',
      '日志': 'magenta'
    };
    return colors[mod] || 'default';
  };

  const getActionColor = (act: string) => {
    const colors: Record<string, string> = {
      '创建': 'green',
      '更新': 'blue',
      '删除': 'red',
      '删除(软删除)': 'orange',
      '恢复删除': 'cyan',
      '查询': 'default',
      '查看详情': 'cyan',
      '查看回收站': 'orange',
      '清空回收站': 'red',
      '上传': 'orange',
      '下载': 'purple',
      '自动保存': 'geekblue',
      '保存版本': 'geekblue',
      '恢复版本': 'gold',
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
      width: 70
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 100,
      render: (t: string) => (
        <Space size={4}>
          <UserOutlined />
          <span>{t}</span>
        </Space>
      )
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      filters: MODULE_OPTIONS.map(m => ({ text: m.label, value: m.value })),
      onFilter: (v, rec) => (rec as any).module === v,
      render: (text: string) => text ? <Tag color={getModuleColor(text)}>{text}</Tag> : '-'
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (text: string) => <Tag color={getActionColor(text)}>{text}</Tag>
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 80,
      render: (text: number | null) => text ? (
        <Badge color="blue" text={`#${text}`} />
      ) : '-'
    },
    {
      title: '版本',
      dataIndex: 'version_number',
      key: 'version_number',
      width: 70,
      render: (v: number | null) => v ? <Tag color="purple">v{v}</Tag> : '-'
    },
    {
      title: '变更字段',
      dataIndex: 'changed_fields_parsed',
      key: 'fields',
      width: 160,
      render: (fields: string[] | undefined, record: ExtendedLog) => {
        const list = fields || record.changed_fields_parsed;
        if (!list || !list.length) return <span style={{ color: '#ccc' }}>—</span>;
        return (
          <Tooltip title={list.join('、')}>
            <Space size={4} wrap>
              {list.slice(0, 3).map(f => (
                <Tag key={f} color="blue" style={{ fontSize: 11, padding: '0 4px', margin: 0 }}>
                  {f}
                </Tag>
              ))}
              {list.length > 3 && <Tag style={{ fontSize: 11 }}>+{list.length - 3}</Tag>}
            </Space>
          </Tooltip>
        );
      }
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (t: string) => (
        <Tooltip title={t}>
          <span>{t}</span>
        </Tooltip>
      )
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
      render: (t: string) => t ? (
        <Tooltip title={t}>
          <Space size={4}>
            <GlobalOutlined style={{ color: '#999' }} />
            <span style={{ fontSize: 12 }}>{t}</span>
          </Space>
        </Tooltip>
      ) : '-'
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      sorter: (a: ExtendedLog, b: ExtendedLog) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend' as const,
      render: (text: string) => (
        <Space size={4}>
          <FieldTimeOutlined style={{ color: '#999' }} />
          <span>{dayjs(text).format('YYYY-MM-DD HH:mm:ss')}</span>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: ExtendedLog) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];

  const renderDetailDiff = () => {
    if (!currentDetail) return null;
    const { before_data_parsed: before, after_data_parsed: after, changed_fields_parsed: fields } = currentDetail;
    const fieldsToShow = fields && fields.length ? fields : ['title', 'content', 'status', 'applicant', 'company'];

    if (!before && !after) {
      return <Empty description="本次操作无变更数据记录" />;
    }

    return (
      <Collapse
        defaultActiveKey={['summary', 'fields']}
        items={[
          {
            key: 'summary',
            label: '变更摘要',
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="变更前" style={{ borderLeft: '3px solid #ff4d4f' }}>
                    {before ? (
                      <Descriptions size="small" column={1} bordered>
                        {['title', 'applicant', 'company', 'status'].map(k => (
                          before[k] !== undefined && (
                            <Descriptions.Item key={k} label={k}>
                              {String(before[k]).substring(0, 50)}
                            </Descriptions.Item>
                          )
                        ))}
                      </Descriptions>
                    ) : <span style={{ color: '#999' }}>无（新增操作）</span>}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="变更后" style={{ borderLeft: '3px solid #52c41a' }}>
                    {after ? (
                      <Descriptions size="small" column={1} bordered>
                        {['title', 'applicant', 'company', 'status'].map(k => (
                          after[k] !== undefined && (
                            <Descriptions.Item key={k} label={k}>
                              {String(after[k]).substring(0, 50)}
                            </Descriptions.Item>
                          )
                        ))}
                      </Descriptions>
                    ) : <span style={{ color: '#999' }}>无（删除操作）</span>}
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: 'fields',
            label: `字段级变更 (${fields?.length || 0} 个字段)`,
            children: (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {fieldsToShow.map((f: string) => {
                  const bVal = before?.[f];
                  const aVal = after?.[f];
                  const changed = (bVal ?? '') !== (aVal ?? '');
                  return (
                    <Card
                      key={f}
                      size="small"
                      title={
                        <Space>
                          <Tag color={changed ? 'blue' : 'default'}>{f}</Tag>
                          {changed && <span style={{ color: '#52c41a', fontSize: 12 }}>已变更</span>}
                        </Space>
                      }
                    >
                      <Row gutter={12}>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>变更前</div>
                          <div
                            style={{
                              background: changed ? '#fff1f0' : '#fafafa',
                              padding: '8px 12px',
                              borderRadius: 4,
                              whiteSpace: 'pre-wrap',
                              borderLeft: `3px solid ${changed ? '#ff4d4f' : '#e8e8e8'}`,
                              fontSize: 13,
                              maxHeight: 120,
                              overflow: 'auto'
                            }}
                          >
                            {bVal !== undefined && bVal !== null ? String(bVal) : '(空)'}
                          </div>
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>变更后</div>
                          <div
                            style={{
                              background: changed ? '#f6ffed' : '#fafafa',
                              padding: '8px 12px',
                              borderRadius: 4,
                              whiteSpace: 'pre-wrap',
                              borderLeft: `3px solid ${changed ? '#52c41a' : '#e8e8e8'}`,
                              fontSize: 13,
                              maxHeight: 120,
                              overflow: 'auto'
                            }}
                          >
                            {aVal !== undefined && aVal !== null ? String(aVal) : '(空)'}
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </Space>
            )
          },
          {
            key: 'raw',
            label: '原始数据',
            children: (
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12, overflow: 'auto', maxHeight: 300 }}>
                {JSON.stringify({ before, after, fields }, null, 2)}
              </pre>
            )
          }
        ]}
      />
    );
  };

  return (
    <div>
      <div className="page-header">
        <Space>
          <h2 className="page-title" style={{ margin: 0 }}>
            <HistoryOutlined /> 操作日志
          </h2>
          <Tag color="blue">全量追踪</Tag>
        </Space>
      </div>

      {statistics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card>
              <Statistic title="总操作数" value={statistics.total} />
            </Card>
          </Col>
          <Col span={10}>
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
          <Col span={10}>
            <Card title="按操作统计" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {statistics.by_action.slice(0, 12).map(item => (
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
            showSearch
            optionFilterProp="label"
          >
            {MODULE_OPTIONS.map(m => <Option key={m.value} value={m.value} label={m.label}>{m.label}</Option>)}
          </Select>
          <Select
            placeholder="选择操作"
            value={action}
            onChange={setAction}
            style={{ width: 150 }}
            allowClear
            showSearch
            optionFilterProp="label"
          >
            {ACTION_OPTIONS.map(a => <Option key={a.value} value={a.value} label={a.label}>{a.label}</Option>)}
          </Select>
          <Input
            placeholder="搜索用户"
            prefix={<UserOutlined />}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            style={{ width: 160 }}
            onPressEnter={handleSearch}
            allowClear
          />
          <Input
            placeholder="目标ID"
            prefix="#"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value.replace(/[^\d]/g, ''))}
            style={{ width: 120 }}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button onClick={() => { setModule(undefined); setAction(undefined); setUser(''); setTargetId(''); }}>
            重置
          </Button>
        </div>

        <Table
          columns={columns as any}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      </Card>

      <Drawer
        title={
          <Space>
            <DiffOutlined />
            <span>日志详情</span>
          </Space>
        }
        width={800}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
        extra={
          currentDetail?.version_number && (
            <Tag color="purple" icon={<HistoryOutlined />}>关联版本 v{currentDetail.version_number}</Tag>
          )
        }
      >
        {currentDetail && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="日志ID">#{currentDetail.id}</Descriptions.Item>
              <Descriptions.Item label="操作时间">{new Date(currentDetail.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="用户">{currentDetail.user}</Descriptions.Item>
              <Descriptions.Item label="IP地址">{currentDetail.ip || '-'}</Descriptions.Item>
              <Descriptions.Item label="模块">
                <Tag color={getModuleColor(currentDetail.module || '')}>{currentDetail.module || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="操作">
                <Tag color={getActionColor(currentDetail.action)}>{currentDetail.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标ID">
                {currentDetail.target_id ? `#${currentDetail.target_id}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联版本">
                {currentDetail.version_number ? `v${currentDetail.version_number}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent" span={2}>
                <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
                  {(currentDetail as any).user_agent || '-'}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="操作详情" span={2}>
                {currentDetail.detail || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">
              <Space>
                <DiffOutlined />
                <span>变更数据对比</span>
              </Space>
            </Divider>
            {renderDetailDiff()}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Empty({ description }: { description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
      {description}
    </div>
  );
}

export default Logs;
