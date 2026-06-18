import { useEffect, useState } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, message, Tag, Tooltip, Badge,
  Dropdown, Popconfirm, Drawer, Progress, Empty, App
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, DeleteFilled, HistoryOutlined, StarOutlined, StarFilled,
  ExportOutlined, SafetyCertificateOutlined, DownOutlined, SaveOutlined,
  DeleteColumnOutlined, FilterOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getDeclarations, deleteDeclaration, submitDeclaration, getDeclarationStats,
  batchExportDeclarations, batchSubmitDeclarations, batchQualificationCheck,
  batchFollowDeclarations, toggleFollowDeclaration,
  getSavedFilters, createSavedFilter, updateSavedFilter, deleteSavedFilter
} from '../api/declarations';
import { StatusMap, StatusColorMap } from '../types';
import type { Declaration, DeclarationStats, SavedFilter, BatchCheckResult } from '../types';

const { Option } = Select;

function DeclarationList() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [stats, setStats] = useState<DeclarationStats | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [checkDrawerOpen, setCheckDrawerOpen] = useState(false);
  const [checkResults, setCheckResults] = useState<BatchCheckResult[]>([]);
  const [checkSummary, setCheckSummary] = useState<{ total: number; passed: number; failed: number; avg_score: number } | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  useEffect(() => {
    loadDeclarations();
    loadStats();
    loadSavedFilters();
  }, []);

  const loadStats = async () => {
    try {
      const res = await getDeclarationStats();
      if (res.success) setStats(res.data ?? null);
    } catch (e) {}
  };

  const loadSavedFilters = async () => {
    try {
      const res = await getSavedFilters();
      if (res.success) {
        setSavedFilters(res.data || []);
        const defaultFilter = (res.data || []).find(f => f.is_default === 1);
        if (defaultFilter) {
          applyFilter(defaultFilter);
        }
      }
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

  const handleToggleFollow = async (record: Declaration) => {
    try {
      const newFollowed = !record.is_followed;
      const res = await toggleFollowDeclaration(record.id, newFollowed);
      if (res.success) {
        setDeclarations(prev => prev.map(d =>
          d.id === record.id ? { ...d, is_followed: res.data?.is_followed } : d
        ));
        message.success(newFollowed ? '已标记关注' : '已取消关注');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleBatchExport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的申报');
      return;
    }
    try {
      const res = await batchExportDeclarations(selectedRowKeys);
      const blob = new Blob([res as any], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `declarations_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success(`已成功导出 ${selectedRowKeys.length} 条申报`);
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleBatchSubmit = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要提交的申报');
      return;
    }
    const draftCount = declarations.filter(
      d => selectedRowKeys.includes(d.id) && d.status === 'draft'
    ).length;
    Modal.confirm({
      title: '批量提交确认',
      content: (
        <div>
          <p>共选择 <strong>{selectedRowKeys.length}</strong> 条申报。</p>
          <p>其中可提交（草稿状态）：<strong>{draftCount}</strong> 条</p>
          <p>不可提交（非草稿状态）：<strong>{selectedRowKeys.length - draftCount}</strong> 条</p>
          <p style={{ color: '#faad14', marginTop: 8 }}>提交后将进入审批流程，无法再编辑。</p>
        </div>
      ),
      onOk: async () => {
        try {
          const res = await batchSubmitDeclarations(selectedRowKeys);
          if (res.success) {
            const { success, failed } = res.data || { success: [], failed: [] };
            if (success.length > 0 && failed.length === 0) {
              message.success(`成功提交 ${success.length} 条申报`);
            } else if (success.length > 0 && failed.length > 0) {
              message.warning(`部分成功：${success.length} 条成功，${failed.length} 条失败`);
            } else {
              message.error(`提交失败：${failed.length} 条`);
            }
            loadDeclarations();
            setSelectedRowKeys([]);
          }
        } catch (error) {
          message.error('批量提交失败');
        }
      }
    });
  };

  const handleBatchCheck = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要校验的申报');
      return;
    }
    setCheckLoading(true);
    setCheckDrawerOpen(true);
    try {
      const res = await batchQualificationCheck(selectedRowKeys);
      if (res.success) {
        setCheckResults(res.data?.data || []);
        setCheckSummary(res.data?.summary || null);
      }
    } catch (error) {
      message.error('校验失败');
    }
    setCheckLoading(false);
  };

  const handleBatchFollow = async (followed: boolean) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的申报');
      return;
    }
    try {
      const res = await batchFollowDeclarations(selectedRowKeys, followed);
      if (res.success) {
        setDeclarations(prev => prev.map(d => {
          const updated = (res.data || []).find(u => u.id === d.id);
          return updated ? { ...d, is_followed: updated.is_followed } : d;
        }));
        message.success(`${followed ? '标记关注' : '取消关注'}成功，共 ${(res.data || []).length} 条`);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const applyFilter = (filter: SavedFilter) => {
    const data = filter.filter_data || {};
    setKeyword(data.keyword || '');
    setStatus(data.status || undefined);
    setTimeout(() => loadDeclarations(), 100);
  };

  const handleSaveFilter = async () => {
    if (!newFilterName.trim()) {
      message.warning('请输入筛选方案名称');
      return;
    }
    try {
      const res = await createSavedFilter({
        name: newFilterName.trim(),
        module: 'declarations',
        filter_data: { keyword, status },
        is_default: setAsDefault ? 1 : 0
      });
      if (res.success) {
        message.success('筛选方案已保存');
        setSaveFilterModalOpen(false);
        setNewFilterName('');
        setSetAsDefault(false);
        loadSavedFilters();
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleDeleteFilter = async (id: number, e: any) => {
    e.stopPropagation();
    Modal.confirm({
      title: '删除筛选方案',
      content: '确定要删除该筛选方案吗？',
      onOk: async () => {
        try {
          const res = await deleteSavedFilter(id);
          if (res.success) {
            message.success('已删除');
            loadSavedFilters();
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleSetDefaultFilter = async (filter: SavedFilter, e: any) => {
    e.stopPropagation();
    try {
      const res = await updateSavedFilter(filter.id, { is_default: 1 });
      if (res.success) {
        message.success('已设为默认筛选方案');
        loadSavedFilters();
      }
    } catch (error) {
      message.error('设置失败');
    }
  };

  const filterMenuItems = [
    ...savedFilters.map(filter => ({
      key: filter.id.toString(),
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span onClick={() => applyFilter(filter)} style={{ flex: 1, cursor: 'pointer' }}>
            {filter.is_default === 1 && <Tag color="blue" style={{ marginRight: 8 }}>默认</Tag>}
            {filter.name}
          </span>
          <Space size={4}>
            {filter.is_default !== 1 && (
              <Tooltip title="设为默认">
                <Button
                  type="text"
                  size="small"
                  icon={<StarOutlined />}
                  onClick={(e) => handleSetDefaultFilter(filter, e)}
                />
              </Tooltip>
            )}
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteColumnOutlined />}
                onClick={(e) => handleDeleteFilter(filter.id, e)}
              />
            </Tooltip>
          </Space>
        </div>
      )
    })),
    {
      key: 'save',
      label: <span onClick={() => setSaveFilterModalOpen(true)} style={{ color: '#1677ff' }}>＋ 保存当前筛选</span>
    }
  ];

  const columns = [
    {
      title: '关注',
      dataIndex: 'is_followed',
      key: 'is_followed',
      width: 60,
      align: 'center' as const,
      render: (_: any, record: Declaration) => (
        <Button
          type="text"
          icon={record.is_followed ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
          onClick={() => handleToggleFollow(record)}
        />
      )
    },
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[]),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      {
        key: 'draft',
        text: '选择所有草稿',
        onSelect: (changeableRowKeys: React.Key[]) => {
          const draftKeys = declarations.filter(d => d.status === 'draft').map(d => d.id);
          const newKeys = Array.from(new Set([...selectedRowKeys, ...draftKeys]));
          setSelectedRowKeys(newKeys.filter(k => changeableRowKeys.includes(k)));
        }
      }
    ]
  };

  const hasSelected = selectedRowKeys.length > 0;

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
        <Dropdown menu={{ items: filterMenuItems }} trigger={['click']}>
          <Button icon={<FilterOutlined />}>
            常用筛选 <DownOutlined />
          </Button>
        </Dropdown>
      </div>

      {hasSelected && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: '#e6f4ff',
          border: '1px solid #91caff',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space size={12}>
            <span style={{ fontWeight: 500 }}>
              已选择 <span style={{ color: '#1677ff' }}>{selectedRowKeys.length}</span> 项
            </span>
            <Button type="link" onClick={() => setSelectedRowKeys([])}>
              清空选择
            </Button>
          </Space>
          <Space wrap>
            <Button icon={<ExportOutlined />} onClick={handleBatchExport}>
              批量导出
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={handleBatchCheck}>
              批量校验
            </Button>
            <Button icon={<SendOutlined />} type="primary" onClick={handleBatchSubmit}>
              批量提交
            </Button>
            <Popconfirm
              title="确认批量标记关注？"
              onConfirm={() => handleBatchFollow(true)}
              okText="确认"
              cancelText="取消"
            >
              <Button icon={<StarFilled style={{ color: '#faad14' }} />}>
                批量关注
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认批量取消关注？"
              onConfirm={() => handleBatchFollow(false)}
              okText="确认"
              cancelText="取消"
            >
              <Button icon={<StarOutlined />}>
                取消关注
              </Button>
            </Popconfirm>
          </Space>
        </div>
      )}

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={declarations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="保存筛选方案"
        open={saveFilterModalOpen}
        onOk={handleSaveFilter}
        onCancel={() => {
          setSaveFilterModalOpen(false);
          setNewFilterName('');
          setSetAsDefault(false);
        }}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>方案名称</label>
            <Input
              placeholder="请输入筛选方案名称"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
              />
              设为默认筛选方案
            </label>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              当前筛选条件：关键词「{keyword || '无'}」，状态「{status ? StatusMap[status] : '全部'}」
            </div>
          </div>
        </div>
      </Modal>

      <Drawer
        title="批量资格校验结果"
        width={720}
        open={checkDrawerOpen}
        onClose={() => setCheckDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setCheckDrawerOpen(false)}>关闭</Button>
          </Space>
        }
      >
        {checkLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Progress type="circle" percent={100} status="active" />
            <p style={{ marginTop: 16, color: '#666' }}>正在校验中...</p>
          </div>
        ) : checkSummary ? (
          <div>
            <div style={{
              display: 'flex',
              gap: 16,
              marginBottom: 20,
              padding: 16,
              background: '#f5f5f5',
              borderRadius: 6
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{checkSummary.total}</div>
                <div style={{ color: '#666', fontSize: 12 }}>校验总数</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>{checkSummary.passed}</div>
                <div style={{ color: '#666', fontSize: 12 }}>可提交</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#ff4d4f' }}>{checkSummary.failed}</div>
                <div style={{ color: '#666', fontSize: 12 }}>需修正</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>{checkSummary.avg_score}</div>
                <div style={{ color: '#666', fontSize: 12 }}>平均分</div>
              </div>
            </div>

            {checkResults.length === 0 ? (
              <Empty description="暂无校验结果" />
            ) : (
              checkResults.map(item => (
                <div key={item.id} style={{
                  marginBottom: 16,
                  padding: 16,
                  border: '1px solid #e8e8e8',
                  borderRadius: 6
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.can_submit ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                      )}
                      <span style={{ fontWeight: 500 }}>{item.title}</span>
                      <Tag color={item.can_submit ? 'green' : 'red'}>
                        {item.can_submit ? '可提交' : '需修正'}
                      </Tag>
                    </div>
                    <Progress
                      percent={item.score}
                      size="small"
                      status={item.score >= 80 ? 'success' : item.score >= 60 ? 'normal' : 'exception'}
                      style={{ width: 120 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666', marginBottom: 8 }}>
                    <span>通过: {item.passed_checks}/{item.total_checks}</span>
                    {item.high_risk_count > 0 && <span style={{ color: '#ff4d4f' }}>高风险: {item.high_risk_count}</span>}
                    {item.medium_risk_count > 0 && <span style={{ color: '#faad14' }}>中风险: {item.medium_risk_count}</span>}
                  </div>
                  {item.risks.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {item.risks.map((risk, idx) => (
                        <Tag
                          key={idx}
                          color={risk.level === 'high' ? 'red' : risk.level === 'medium' ? 'orange' : 'blue'}
                          style={{ marginBottom: 4 }}
                        >
                          {risk.title}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default DeclarationList;
