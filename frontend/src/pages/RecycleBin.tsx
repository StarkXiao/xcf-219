import { useEffect, useState } from 'react';
import {
  Card, Table, Button, message, Input, Space, Tag, Modal, Breadcrumb,
  Empty, Tooltip, Popconfirm, Alert, Row, Col, Statistic
} from 'antd';
import {
  ArrowLeftOutlined, DeleteOutlined, UndoOutlined, SearchOutlined,
  ExclamationCircleOutlined, DeleteFilled, ReloadOutlined, FileTextOutlined,
  UserOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getRecycleBin, restoreFromRecycleBin, permanentlyDeleteDeclaration, clearRecycleBin
} from '../api/versions';
import type { RecycleBinItem, RecycleBinListResponse, StatusMap, StatusColorMap } from '../types';
import { StatusMap as StatusMapImport, StatusColorMap as StatusColorMapImport } from '../types';

function RecycleBin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecycleBinListResponse | null>(null);
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [stats, setStats] = useState<{ total: number }>({ total: 0 });

  const StatusMap: Record<string, string> = StatusMapImport as any;
  const StatusColorMap: Record<string, string> = StatusColorMapImport as any;

  useEffect(() => {
    loadData(1);
  }, []);

  const loadData = async (page = 1, searchKeyword?: string) => {
    setLoading(searchKeyword ? '搜索中' as any : true);
    if (searchKeyword !== undefined) setSearching(true);
    try {
      const res = await getRecycleBin({
        keyword: searchKeyword !== undefined ? searchKeyword : keyword,
        page,
        pageSize: 20
      });
      if (res.success) {
        setData(res.data ?? null);
        setStats({ total: res.data?.total ?? 0 });
      }
    } catch (e) {
      message.error('加载回收站失败');
    }
    setLoading(false);
    setSearching(false);
  };

  const handleRestore = (item: RecycleBinItem) => {
    Modal.confirm({
      title: '恢复申报',
      icon: <UndoOutlined style={{ color: '#52c41a' }} />,
      content: (
        <div>
          <p>确定要恢复申报 <strong>"{item.title}"</strong> 吗？</p>
          <p style={{ fontSize: 12, color: '#999' }}>
            恢复后将返回申报列表，可继续编辑或提交。
            {item.status === 'draft' && '草稿状态的申报将保留版本历史。'}
          </p>
        </div>
      ),
      okText: '恢复',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await restoreFromRecycleBin(item.id);
          if (res.success) {
            message.success(`已恢复: ${item.title}`);
            loadData(1);
          }
        } catch (e: any) {
          message.error(e.response?.data?.message || '恢复失败');
        }
      }
    });
  };

  const handlePermanentDelete = (item: RecycleBinItem) => {
    Modal.confirm({
      title: '永久删除',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      okType: 'danger',
      content: (
        <div>
          <Alert type="error" showIcon message="此操作不可撤销！" style={{ marginBottom: 12 }} />
          <p>确定要永久删除 <strong>"{item.title}"</strong> 吗？</p>
          <ul style={{ fontSize: 12, color: '#999', paddingLeft: 20 }}>
            <li>所有版本历史将被永久删除</li>
            <li>所有审批记录将被永久删除</li>
            <li>所有附件文件将被永久删除</li>
            <li>此操作无法撤销</li>
          </ul>
        </div>
      ),
      okText: '永久删除',
      onOk: async () => {
        try {
          const res = await permanentlyDeleteDeclaration(item.id);
          if (res.success) {
            message.success('已永久删除');
            loadData(1);
          }
        } catch (e: any) {
          message.error(e.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleBatchRestore = async () => {
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: `批量恢复 ${selectedRowKeys.length} 个申报`,
      content: '确定要恢复选中的所有申报吗？',
      okText: '恢复',
      onOk: async () => {
        const successCount = 0;
        let failed = 0;
        for (const id of selectedRowKeys) {
          try {
            await restoreFromRecycleBin(Number(id));
          } catch (e) {
            failed++;
          }
        }
        const restored = selectedRowKeys.length - failed;
        if (restored > 0) message.success(`已恢复 ${restored} 个`);
        if (failed > 0) message.error(`${failed} 个恢复失败`);
        setSelectedRowKeys([]);
        loadData(1);
      }
    });
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '清空回收站',
      icon: <DeleteFilled style={{ color: '#ff4d4f' }} />,
      okType: 'danger',
      content: (
        <div>
          <Alert type="error" showIcon message="此操作将永久删除回收站中的所有内容，不可撤销！" style={{ marginBottom: 12 }} />
          <p>当前回收站共 <strong>{stats.total}</strong> 条记录。</p>
          <p>你可以选择：</p>
          <Space direction="vertical">
            <Button size="small" onClick={async () => {
              try {
                const res = await clearRecycleBin({ older_than_days: 7 });
                if (res.success) {
                  message.success(`已清理7天前的记录：${res.data?.deleted_count ?? 0} 条`);
                  loadData(1);
                  Modal.destroyAll();
                }
              } catch (e) { message.error('清理失败'); }
            }}>仅清理7天前的记录</Button>
            <Button size="small" onClick={async () => {
              try {
                const res = await clearRecycleBin({ older_than_days: 30 });
                if (res.success) {
                  message.success(`已清理30天前的记录：${res.data?.deleted_count ?? 0} 条`);
                  loadData(1);
                  Modal.destroyAll();
                }
              } catch (e) { message.error('清理失败'); }
            }}>仅清理30天前的记录</Button>
          </Space>
        </div>
      ),
      okText: '全部永久删除',
      onOk: async () => {
        try {
          const res = await clearRecycleBin();
          if (res.success) {
            message.success(`已清空回收站，共删除 ${res.data?.deleted_count ?? 0} 条`);
            setSelectedRowKeys([]);
            loadData(1);
          }
        } catch (e) {
          message.error('清空失败');
        }
      }
    });
  };

  const handleSearch = () => {
    loadData(1, keyword);
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: RecycleBinItem) => (
        <Space direction="vertical" size={0}>
          <Space>
            <FileTextOutlined />
            <strong>{text}</strong>
          </Space>
          {record.guideline_title && (
            <span style={{ fontSize: 12, color: '#999' }}>
              指南: {record.guideline_title}
            </span>
          )}
        </Space>
      )
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 100,
      render: (t: string) => (
        <Space><UserOutlined />{t}</Space>
      )
    },
    {
      title: '企业名称',
      dataIndex: 'company',
      key: 'company',
      width: 160,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag color={StatusColorMap[s] || 'default'}>
          {StatusMap[s] || s}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => (
        <Space><ClockCircleOutlined />{new Date(t).toLocaleString()}</Space>
      )
    },
    {
      title: '删除时间',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      width: 160,
      sorter: (a: RecycleBinItem, b: RecycleBinItem) =>
        new Date(a.deleted_at).getTime() - new Date(b.deleted_at).getTime(),
      defaultSortOrder: 'descend' as const,
      render: (t: string) => {
        const date = new Date(t);
        const daysAgo = Math.floor((Date.now() - date.getTime()) / 86400000);
        return (
          <Tooltip title={date.toLocaleString()}>
            <Space>
              <DeleteOutlined />
              <span>
                {daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo}天前`}
              </span>
              {daysAgo >= 30 && <Tag color="warning">超30天</Tag>}
            </Space>
          </Tooltip>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: RecycleBinItem) => (
        <Space>
          <Tooltip title="恢复到申报列表">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<UndoOutlined />}
              onClick={() => handleRestore(record)}
            >
              恢复
            </Button>
          </Tooltip>
          <Tooltip title="永久删除（不可撤销）">
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handlePermanentDelete(record)}
            >
              永久删除
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Breadcrumb items={[
          { title: <a onClick={() => navigate('/declarations')}>申报管理</a> },
          { title: '回收站' }
        ]} style={{ marginBottom: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/declarations')}
            >
              返回列表
            </Button>
            <h2 className="page-title" style={{ margin: 0, display: 'inline-block' }}>
              <DeleteOutlined /> 回收站
            </h2>
            <Tag color="red">{stats.total} 条记录</Tag>
          </Space>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadData(1)}
            >
              刷新
            </Button>
            <Button
              danger
              icon={<DeleteFilled />}
              onClick={handleClearAll}
              disabled={stats.total === 0}
            >
              清空回收站
            </Button>
          </Space>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="回收站总数" value={stats.total} prefix={<DeleteOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
          <Col span={6}>
            <Statistic
              title="草稿状态"
              value={data?.list?.filter(d => d.status === 'draft').length || 0}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col span={12}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="搜索项目名称或内容..."
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                allowClear
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={searching}>
                搜索
              </Button>
            </Space.Compact>
          </Col>
        </Row>
      </Card>

      <Card>
        {selectedRowKeys.length > 0 && (
          <Alert
            message={
              <Space>
                已选择 <strong>{selectedRowKeys.length}</strong> 项
                <Button size="small" type="primary" icon={<UndoOutlined />} onClick={handleBatchRestore}>
                  批量恢复
                </Button>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
              </Space>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          loading={loading}
          dataSource={data?.list || []}
          columns={columns as any}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: () => ({ disabled: false })
          }}
          pagination={{
            current: data?.page || 1,
            pageSize: data?.pageSize || 20,
            total: data?.total || 0,
            showSizeChanger: false,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page) => loadData(page)
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <div>
                    <DeleteOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 12 }} />
                    <div>回收站为空</div>
                    <Button
                      type="link"
                      onClick={() => navigate('/declarations')}
                      style={{ marginTop: 12 }}
                    >
                      返回申报列表
                    </Button>
                  </div>
                }
              />
            )
          }}
        />
      </Card>
    </div>
  );
}

export default RecycleBin;
