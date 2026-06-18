import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Select, Input, Button, Space, Tag, Row, Col, Statistic,
  Drawer, Timeline, Tooltip, Divider, Alert, Descriptions, Collapse, Badge,
  DatePicker, Empty as AntEmpty
} from 'antd';
import {
  SearchOutlined, HistoryOutlined, EyeOutlined, DiffOutlined,
  FieldTimeOutlined, UserOutlined, GlobalOutlined, CalendarOutlined,
  FileTextOutlined,
  LinkOutlined, DoubleLeftOutlined, DoubleRightOutlined,
  FilterOutlined, UnorderedListOutlined
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  getLogs, getLogStatistics, getLogById, getLogFilterOptions,
  getTargetDetail, type LogFilterParams, type TargetInfo,
  type TargetDetailResponse
} from '../api/logs';
import type { OperationLog } from '../types';
import { StatusMap, StatusColorMap } from '../types';

const { RangePicker } = DatePicker;
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
  target_info?: TargetInfo | null;
  previous_log?: OperationLog | null;
  next_log?: OperationLog | null;
};

type FilterState = {
  module?: string;
  action?: string;
  user?: string;
  targetId?: string;
  dateRange?: [Dayjs, Dayjs] | null;
  detailKeyword?: string;
};

function Logs() {
  const [logs, setLogs] = useState<ExtendedLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<FilterState>({
    module: undefined,
    action: undefined,
    user: '',
    targetId: '',
    dateRange: null,
    detailKeyword: ''
  });
  const [statistics, setStatistics] = useState<{
    total: number;
    by_module: { module: string; count: number }[];
    by_action: { action: string; count: number }[];
    by_user?: { user: string; count: number }[];
    by_day?: { date: string; count: number }[];
  } | null>(null);

  const [filterOptions, setFilterOptions] = useState<{
    modules: string[];
    actions: string[];
    users: string[];
  }>({ modules: [], actions: [], users: [] });

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<ExtendedLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [targetDetail, setTargetDetail] = useState<TargetDetailResponse | null>(null);
  const [targetDetailLoading, setTargetDetailLoading] = useState(false);

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await getLogFilterOptions();
      if (res.success && res.data) {
        setFilterOptions(res.data);
      }
    } catch (e) {
      console.error('加载筛选选项失败:', e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: LogFilterParams = {
        module: filters.module,
        action: filters.action,
        user: filters.user || undefined,
        target_id: filters.targetId ? parseInt(filters.targetId) : undefined,
        detail_keyword: filters.detailKeyword || undefined,
        page,
        pageSize,
        include_data: true
      };
      if (filters.dateRange && filters.dateRange[0]) {
        params.start_date = filters.dateRange[0].format('YYYY-MM-DD');
      }
      if (filters.dateRange && filters.dateRange[1]) {
        params.end_date = filters.dateRange[1].format('YYYY-MM-DD');
      }
      const res = await getLogs(params);
      if (res.success) {
        setLogs(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    }
    setLoading(false);
  }, [filters, page, pageSize]);

  const loadStatistics = useCallback(async () => {
    try {
      const params: { start_date?: string; end_date?: string } = {};
      if (filters.dateRange && filters.dateRange[0]) {
        params.start_date = filters.dateRange[0].format('YYYY-MM-DD');
      }
      if (filters.dateRange && filters.dateRange[1]) {
        params.end_date = filters.dateRange[1].format('YYYY-MM-DD');
      }
      const res = await getLogStatistics(Object.keys(params).length ? params : undefined);
      if (res.success) {
        setStatistics(res.data || null);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }, [filters.dateRange]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadStatistics();
    loadFilterOptions();
  }, [loadStatistics, loadFilterOptions]);

  const handleSearch = () => {
    setPage(1);
    loadLogs();
  };

  const handleReset = () => {
    setFilters({
      module: undefined,
      action: undefined,
      user: '',
      targetId: '',
      dateRange: null,
      detailKeyword: ''
    });
    setPage(1);
  };

  useEffect(() => {
    if (
      filters.module === undefined &&
      filters.action === undefined &&
      filters.user === '' &&
      filters.targetId === '' &&
      filters.dateRange === null &&
      filters.detailKeyword === ''
    ) {
      loadLogs();
    }
  }, [
    filters.module, filters.action, filters.user,
    filters.targetId, filters.dateRange, filters.detailKeyword
  ]);

  const loadTargetDetail = async (module: string, targetId: number) => {
    setTargetDetailLoading(true);
    try {
      const res = await getTargetDetail(module, targetId);
      if (res.success && res.data) {
        setTargetDetail(res.data);
      } else {
        setTargetDetail(null);
      }
    } catch (e) {
      setTargetDetail(null);
    }
    setTargetDetailLoading(false);
  };

  const handleViewDetail = async (record: ExtendedLog) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setTargetDetail(null);
    try {
      const res = await getLogById(record.id);
      if (res.success && res.data) {
        setCurrentDetail(res.data);
        if (res.data.module && res.data.target_id) {
          loadTargetDetail(res.data.module, res.data.target_id);
        }
      } else {
        setCurrentDetail(record);
      }
    } catch (e) {
      setCurrentDetail(record);
    }
    setDetailLoading(false);
  };

  const handleNavigateLog = async (direction: 'prev' | 'next') => {
    if (!currentDetail) return;
    const target = direction === 'prev' ? currentDetail.previous_log : currentDetail.next_log;
    if (target?.id) {
      handleViewDetail(target as ExtendedLog);
    }
  };

  const handleQuickFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
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
          <span
            style={{ cursor: 'pointer', color: '#1677ff' }}
            onClick={() => handleQuickFilter('user', t)}
          >
            {t}
          </span>
        </Space>
      )
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      filters: MODULE_OPTIONS.map(m => ({ text: m.label, value: m.value })),
      onFilter: (v: string | number | boolean, rec: ExtendedLog) => rec.module === v,
      render: (text: string) => text ? (
        <Tag
          color={getModuleColor(text)}
          style={{ cursor: 'pointer' }}
          onClick={() => handleQuickFilter('module', text)}
        >
          {text}
        </Tag>
      ) : '-'
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (text: string) => (
        <Tag
          color={getActionColor(text)}
          style={{ cursor: 'pointer' }}
          onClick={() => handleQuickFilter('action', text)}
        >
          {text}
        </Tag>
      )
    },
    {
      title: '目标单据',
      key: 'target',
      width: 200,
      render: (_: any, record: ExtendedLog) => {
        const data = (record as any);
        return (
          <Space direction="vertical" size={2}>
            {record.target_id ? (
              <Badge color="blue" text={`#${record.target_id}`} />
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
          {record.module === '申报表单' || record.module === '版本管理' ||
          record.module === '状态流转' || record.module === '审批' ? (
            data.after_data_parsed?.title ? (
              <Tooltip title={data.after_data_parsed.title}>
                <span
                  style={{
                    fontSize: 12,
                    color: '#666',
                    maxWidth: 160,
                    display: 'inline-block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FileTextOutlined style={{ marginRight: 4 }} />
                  {data.after_data_parsed.title}
                </span>
              </Tooltip>
            ) : data.before_data_parsed?.title ? (
              <Tooltip title={data.before_data_parsed.title}>
                <span
                  style={{
                    fontSize: 12,
                    color: '#999',
                    maxWidth: 160,
                    display: 'inline-block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FileTextOutlined style={{ marginRight: 4 }} />
                  {data.before_data_parsed.title}
                </span>
              </Tooltip>
            ) : null
          ) : null}
          </Space>
        );
      }
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
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: ExtendedLog) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.target_id && record.module && (
            <Button
              type="link"
              size="small"
              icon={<FilterOutlined />}
              onClick={() => {
                handleQuickFilter('targetId', String(record.target_id));
                handleQuickFilter('module', record.module);
              }}
              title="筛选同目标"
            >
              同目标
            </Button>
          )}
        </Space>
      )
    }
  ];

  const renderDetailDiff = () => {
    if (!currentDetail) return null;
    const { before_data_parsed: before, after_data_parsed: after, changed_fields_parsed: fields } = currentDetail;
    const fieldsToShow = fields && fields.length ? fields : Object.keys({ ...before, ...after }).slice(0, 20);

    if (!before && !after) {
      return <AntEmpty description="本次操作无变更数据记录" />;
    }

    return (
      <Collapse
        defaultActiveKey={['summary', 'fields']}
        items={[
          {
            key: 'summary',
            label: (
              <Space>
                <DiffOutlined />
                <span>变更摘要</span>
              </Space>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="变更前" style={{ borderLeft: '3px solid #ff4d4f' }}>
                    {before ? (
                      <Descriptions size="small" column={1} bordered>
                        {['title', 'applicant', 'company', 'status'].map(k => (
                          before[k] !== undefined && (
                            <Descriptions.Item key={k} label={k}>
                              {String(before[k]).substring(0, 80)}
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
                              {String(after[k]).substring(0, 80)}
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
            label: (
              <Space>
                <UnorderedListOutlined />
                <span>字段级变更 ({fields?.length || 0} 个字段</span>
              </Space>
            ),
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
            label: (
              <Space>
                <HistoryOutlined />
                <span>原始数据 (JSON)</span>
              </Space>
            ),
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

  const renderTargetInfo = () => {
    if (!targetDetail?.target_info) return null;
    const info = targetDetail.target_info;
    return (
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        icon={<LinkOutlined />}
        message={
          <Space>
            <strong>关联目标单据</strong>
            <Tag color={info.type === 'declaration' ? 'green' : 'blue'}>
              {info.type === 'declaration' ? '申报单' : '申报指南'}
            </Tag>
            {info.is_deleted ? <Tag color="red">已删除</Tag> : null}
          </Space>
        }
        description={
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>
              <FileTextOutlined style={{ marginRight: 6 }} />
              {info.display_title}
            </div>
            {info.display_subtitle && (
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                {info.display_subtitle}
              </div>
            )}
            {info.status && (
              <div style={{ fontSize: 12 }}>
                状态: <Tag color={StatusColorMap[info.status] || 'default'}>
                  {StatusMap[info.status] || info.status}
                </Tag>
              </div>
            )}
          </div>
        }
      />
    );
  };

  const renderRelatedTimeline = () => {
    if (!targetDetail || !targetDetail.related_logs?.length) return null;
    return (
      <Card
        size="small"
        title={
          <Space>
            <HistoryOutlined />
            <span>同目标操作历史 ({targetDetail.related_count} 条)</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Timeline
          style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 8 }}
          items={targetDetail.related_logs.map((log, idx) => ({
            color: log.id === currentDetail?.id ? 'blue' : 'gray',
            dot: log.id === currentDetail?.id ? <EyeOutlined /> : undefined,
            children: (
              <div
                style={{
                  padding: log.id === currentDetail?.id ? '6px 8px' : '2px 0',
                  background: log.id === currentDetail?.id ? '#e6f4ff' : 'transparent',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
                onClick={() => log.id !== currentDetail?.id && handleViewDetail(log as ExtendedLog)}
              >
                <Space size={4} wrap>
                  <Tag color={getActionColor(log.action)} style={{ margin: 0 }}>{log.action}</Tag>
                  <span style={{ color: '#666' }}>{log.user}</span>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    {dayjs(log.created_at).format('MM-DD HH:mm:ss')}
                  </span>
                </Space>
                {log.detail && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {log.detail}
                  </div>
                )}
              </div>
            )
          }))}
        />
      </Card>
    );
  };

  const renderNavigationBar = () => {
    if (!currentDetail) return null;
    const hasPrev = !!currentDetail.previous_log;
    const hasNext = !!currentDetail.next_log;
    return (
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Button
            size="small"
            icon={<DoubleLeftOutlined />}
            disabled={!hasPrev}
            onClick={() => handleNavigateLog('prev')}
          >
            上一条
          </Button>
        </Col>
        <Col>
          <Space size={4}>
          <span style={{ fontSize: 12, color: '#999' }}>
            前后相邻日志
          </span>
          </Space>
        </Col>
        <Col>
          <Button
            size="small"
            icon={<DoubleRightOutlined />}
            disabled={!hasNext}
            onClick={() => handleNavigateLog('next')}
          >
            下一条
          </Button>
        </Col>
      </Row>
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
                  <Tag
                    key={item.module}
                    color={getModuleColor(item.module)}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleQuickFilter('module', item.module)}
                  >
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
                  <Tag
                    key={item.action}
                    color={getActionColor(item.action)}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleQuickFilter('action', item.action)}
                  >
                    {item.action}: {item.count}
                  </Tag>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Select
            placeholder="选择模块"
            value={filters.module}
            onChange={(v) => handleQuickFilter('module', v)}
            style={{ width: 150 }}
            allowClear
            showSearch
            optionFilterProp="label"
          >
            {MODULE_OPTIONS.map(m => <Option key={m.value} value={m.value} label={m.label}>{m.label}</Option>)}
            {filterOptions.modules.filter(m => !MODULE_OPTIONS.find(o => o.value === m)).map(m => (
              <Option key={m} value={m} label={m}>{m}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择操作"
            value={filters.action}
            onChange={(v) => handleQuickFilter('action', v)}
            style={{ width: 150 }}
            allowClear
            showSearch
            optionFilterProp="label"
          >
            {ACTION_OPTIONS.map(a => <Option key={a.value} value={a.value} label={a.label}>{a.label}</Option>)}
            {filterOptions.actions.filter(a => !ACTION_OPTIONS.find(o => o.value === a)).map(a => (
              <Option key={a} value={a} label={a}>{a}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择用户"
            mode="tags"
            value={filters.user ? [filters.user] : []}
            onChange={(v) => handleQuickFilter('user', v[0] || '')}
            style={{ width: 160 }}
            allowClear
            showSearch
            tokenSeparators={[',']}
          >
            {filterOptions.users.map(u => (
              <Option key={u} value={u}>{u}</Option>
            ))}
          </Select>
          <Input
            placeholder="目标单据ID"
            prefix="#"
            value={filters.targetId}
            onChange={(e) => handleQuickFilter('targetId', e.target.value.replace(/[^\d]/g, ''))}
            style={{ width: 140 }}
            allowClear
          />
          <RangePicker
            showTime={false}
            value={filters.dateRange}
            onChange={(dates) => handleQuickFilter('dateRange', dates as [Dayjs, Dayjs] | null)}
            style={{ width: 260 }}
          />
          <Input
            placeholder="详情关键字"
            prefix={<SearchOutlined />}
            value={filters.detailKeyword}
            onChange={(e) => handleQuickFilter('detailKeyword', e.target.value)}
            style={{ width: 160 }}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button onClick={handleReset}>重置</Button>
        </div>

        <Table
          columns={columns as any}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600 }}
          style={{ marginTop: 16 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
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
          <Space size="large">
            <Space>
              <DiffOutlined />
              <span style={{ fontWeight: 600 }}>日志详情 #{currentDetail?.id ?? '-'}</span>
            </Space>
            {currentDetail?.version_number && (
              <Tag color="purple" icon={<HistoryOutlined />}>关联版本 v{currentDetail.version_number}</Tag>
            )}
          </Space>
        }
        width={880}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
        extra={
          <Space>
            {currentDetail?.target_info?.type === 'declaration' && (
              <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => {
                  window.open(`/#/declarations/${currentDetail.target_info!.id}`, '_blank');
                }}
              >
                打开单据
              </Button>
            )}
          </Space>
        }
      >
        {currentDetail && (
          <div>
            {renderNavigationBar()}

            {renderTargetInfo()}

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="日志ID">#{currentDetail.id}</Descriptions.Item>
              <Descriptions.Item label="操作时间">
                {new Date(currentDetail.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="用户">
                <Space>
                  <UserOutlined />
                  <span
                    style={{ cursor: 'pointer', color: '#1677ff' }}
                    onClick={() => {
                      handleQuickFilter('user', currentDetail.user);
                      setDetailVisible(false);
                    }}
                  >
                    {currentDetail.user}
                  </span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="IP地址">{currentDetail.ip || '-'}</Descriptions.Item>
              <Descriptions.Item label="模块">
                <Tag
                  color={getModuleColor(currentDetail.module || '')}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    handleQuickFilter('module', currentDetail.module);
                    setDetailVisible(false);
                  }}
                >
                  {currentDetail.module || '-'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="操作">
                <Tag
                  color={getActionColor(currentDetail.action)}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    handleQuickFilter('action', currentDetail.action);
                    setDetailVisible(false);
                  }}
                >
                  {currentDetail.action}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标单据">
                {currentDetail.target_id ? (
                  <Space>
                    <Badge color="blue" text={`#${currentDetail.target_id}`} />
                    {currentDetail.module && (
                      <Button
                        type="link"
                        size="small"
                        icon={<FilterOutlined />}
                        onClick={() => {
                          handleQuickFilter('targetId', String(currentDetail.target_id));
                          handleQuickFilter('module', currentDetail.module);
                          setDetailVisible(false);
                        }}
                      >
                        仅看此目标
                      </Button>
                    )}
                  </Space>
                ) : '-'}
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

            {renderRelatedTimeline()}

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

export default Logs;
