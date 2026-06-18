import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Dropdown,
  Menu,
  message,
  Tooltip,
  Switch,
  Modal,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  StarFilled,
  StarOutlined,
  CheckSquareOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getDeclarations,
  createDeclaration,
  deleteDeclaration,
  checkQualification,
  getDeclarationStats
} from '../api/declarations';
import {
  StatusMap,
  StatusColorMap,
  type Declaration,
  type DeclarationStats,
  type SavedFilter
} from '../types';

const { Option } = Select;

function DeclarationList() {
  const navigate = useNavigate();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [stats, setStats] = useState<DeclarationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDeclarations({
        keyword: keyword || undefined,
        status: status || undefined
      });
      if (res.success) {
        setDeclarations(res.data || []);
      }
    } catch (error) {
      console.error('加载申报列表失败:', error);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await getDeclarationStats();
      if (res.success) {
        setStats(res.data || null);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
    setStatsLoading(false);
  };

  const handleSearch = () => {
    loadData();
  };

  const handleReset = () => {
    setKeyword('');
    setStatus('');
    loadData();
  };

  const handleAdd = async () => {
    try {
      const res = await createDeclaration({
        title: '新建申报单',
        applicant: '申请人',
        company: '企业名称',
        content: ''
      });
      if (res.success && res.data) {
        navigate(`/declarations/${res.data.id}/edit`);
      }
    } catch (error) {
      message.error('创建申报失败');
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确定删除该申报吗？',
      content: '删除后可在回收站中恢复',
      onOk: async () => {
        try {
          const res = await deleteDeclaration(id);
          if (res.success) {
            message.success('已移至回收站');
            loadData();
            loadStats();
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleBatchDelete = () => {
    Modal.confirm({
      title: `确定删除选中的 ${selectedRowKeys.length} 条申报吗？`,
      content: '删除后可在回收站中恢复',
      onOk: async () => {
        message.success(`批量删除 ${selectedRowKeys.length} 条记录`);
        setSelectedRowKeys([]);
        loadData();
      }
    });
  };

  const handleBatchCheck = async () => {
    const toCheck = declarations.filter((d) => selectedRowKeys.includes(d.id));
    let passCount = 0;
    let failCount = 0;
    for (const d of toCheck) {
      try {
        const res = await checkQualification({
          guideline_id: d.guideline_id,
          company: d.company,
          applicant: d.applicant,
          phone: d.phone,
          email: d.email,
          content: d.content,
          declaration_id: d.id
        });
        if (res.success && res.data?.can_submit) {
          passCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    Modal.info({
      title: '批量校验结果',
      content: `共校验 ${selectedRowKeys.length} 条：通过 ${passCount} 条，未通过 ${failCount} 条`
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60
    },
    {
      title: '关注',
      dataIndex: 'is_followed',
      width: 60,
      render: (followed: number) =>
        followed ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />
    },
    {
      title: '项目名称',
      dataIndex: 'title',
      render: (text: string, record: Declaration) => (
        <a onClick={() => navigate(`/declarations/${record.id}`)} style={{ color: '#1890ff' }}>
          {text}
        </a>
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
      title: '当前步骤',
      dataIndex: 'current_step_name',
      width: 120,
      render: (name: string, record: Declaration) =>
        name || record.status_label || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string, record: Declaration) => (
        <Tag color={StatusColorMap[status as keyof typeof StatusColorMap]}>
          {record.status_label || StatusMap[status] || status}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: Declaration) => (
        <Space size="small">
          <Button type="link" onClick={() => navigate(`/declarations/${record.id}`)}>
            详情
          </Button>
          {['draft', 'rejected'].includes(record.status) && (
            <Button type="link" onClick={() => navigate(`/declarations/${record.id}/edit`)}>
              编辑
            </Button>
          )}
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      )
    }
  ];

  const batchMenu = (
    <Menu>
      <Menu.Item key="check" icon={<CheckSquareOutlined />} onClick={handleBatchCheck}>
        批量资格校验
      </Menu.Item>
      <Menu.Item key="submit" icon={<PlayCircleOutlined />}>
        批量提交
      </Menu.Item>
      <Menu.Item key="export" icon={<ExportOutlined />}>
        批量导出
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
        批量删除
      </Menu.Item>
    </Menu>
  );

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h2 style={{ margin: 0 }}>申报管理</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建申报
          </Button>
        </Space>
      </div>

      <Card>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <Input
            placeholder="搜索项目名称或内容"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 260 }}
          />
          <Select
            placeholder="选择状态"
            value={status || undefined}
            onChange={(v) => setStatus(v)}
            allowClear
            style={{ width: 160 }}
          >
            <Option value="draft">草稿</Option>
            <Option value="submitted">待初审</Option>
            <Option value="reviewing">初审中</Option>
            <Option value="first_reviewed">待复审</Option>
            <Option value="second_reviewed">待终审</Option>
            <Option value="approved">已立项</Option>
            <Option value="rejected">已驳回</Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>

          {selectedRowKeys.length > 0 && (
            <Dropdown overlay={batchMenu} placement="bottomLeft">
              <Button icon={<FilterOutlined />}>
                批量操作 ({selectedRowKeys.length})
              </Button>
            </Dropdown>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={declarations}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[])
          }}
        />
      </Card>
    </div>
  );
}

export default DeclarationList;
