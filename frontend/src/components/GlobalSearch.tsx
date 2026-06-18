import { useState, useEffect, useRef } from 'react';
import { Input, Dropdown, List, Tag, Empty, Spin } from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  FormOutlined,
  PaperClipOutlined,
  MessageOutlined,
  ExceptionOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchAll } from '../api/search';
import type { SearchResultItem } from '../api/search';

const { Search } = Input;

const moduleIcons: Record<string, React.ReactNode> = {
  guidelines: <FileTextOutlined style={{ color: '#1890ff' }} />,
  declarations: <FormOutlined style={{ color: '#52c41a' }} />,
  attachments: <PaperClipOutlined style={{ color: '#faad14' }} />,
  approval_records: <MessageOutlined style={{ color: '#722ed1' }} />,
  operation_logs: <ExceptionOutlined style={{ color: '#eb2f96' }} />
};

const moduleColors: Record<string, string> = {
  guidelines: 'blue',
  declarations: 'green',
  attachments: 'orange',
  approval_records: 'purple',
  operation_logs: 'magenta'
};

function GlobalSearch() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (keyword.trim()) {
      if (searchRef.current) {
        clearTimeout(searchRef.current);
      }
      searchRef.current = setTimeout(() => {
        doSearch(keyword.trim());
      }, 300);
    } else {
      setResults([]);
      setOpen(false);
    }

    return () => {
      if (searchRef.current) {
        clearTimeout(searchRef.current);
      }
    };
  }, [keyword]);

  const doSearch = async (query: string) => {
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchAll({ keyword: query, limit: 10 });
      if (res.success) {
        setResults(res.data?.results || []);
        setOpen(true);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setResults([]);
    }
    setLoading(false);
  };

  const handleSearch = (value: string) => {
    if (value.trim()) {
      doSearch(value.trim());
    }
  };

  const handleItemClick = (item: SearchResultItem) => {
    setOpen(false);
    let path = item.route_path;

    switch (item.module) {
      case 'guidelines':
        if (item.id) {
          path = `/guidelines/${item.id}`;
        }
        break;
      case 'declarations':
        if (item.id) {
          path = `/declarations/${item.id}`;
        }
        break;
      case 'attachments':
      case 'approval_records':
        if (item.target_id) {
          path = `/declarations/${item.target_id}`;
        }
        break;
      case 'operation_logs':
        path = '/logs';
        break;
      default:
        if (item.target_id) {
          path = `${item.route_path}/${item.target_id}`;
        }
    }

    navigate(path);
  };

  const dropdownContent = () => {
    if (loading) {
      return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Spin tip="搜索中..." />
        </div>
      );
    }

    if (results.length === 0 && keyword.trim()) {
      return (
        <Empty
          description="未找到相关结果"
          style={{ padding: '24px' }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    if (results.length === 0) {
      return null;
    }

    return (
      <div style={{ width: 520, maxHeight: 400, overflow: 'auto' }}>
        <List
          size="small"
          dataSource={results.slice(0, 20)}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '12px 16px' }}
              onClick={() => handleItemClick(item)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <List.Item.Meta
                avatar={moduleIcons[item.module] || <SearchOutlined />}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={moduleColors[item.module]} style={{ marginRight: 0 }}>
                      {item.module_name}
                    </Tag>
                    <span style={{ fontWeight: 500 }}>{item.title || '(无标题)'}</span>
                  </div>
                }
                description={
                  <div
                    style={{
                      color: '#666',
                      fontSize: 12,
                      lineHeight: '1.5',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {item.snippet || '(无内容)'}
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {results.length > 20 && (
          <div style={{ textAlign: 'center', padding: '8px', color: '#999', fontSize: 12 }}>
            共 {results.length} 条结果，仅显示前20条
          </div>
        )}
      </div>
    );
  };

  return (
    <Dropdown
      open={open && (loading || results.length > 0 || keyword.trim() !== '')}
      onOpenChange={(isOpen) => {
        if (!isOpen) setOpen(false);
      }}
      trigger={['focus']}
      dropdownRender={dropdownContent}
      placement="bottomRight"
    >
      <Search
        placeholder="搜索指南、申报单、附件、审批意见、日志..."
        allowClear
        enterButton={<SearchOutlined />}
        size="middle"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onSearch={handleSearch}
        onFocus={() => {
          if (keyword.trim() && results.length > 0) {
            setOpen(true);
          }
        }}
        style={{ width: 360 }}
      />
    </Dropdown>
  );
}

export default GlobalSearch;
