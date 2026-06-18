import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, Divider } from 'antd';
import { ArrowLeftOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getGuideline } from '../api/guidelines';
import type { Guideline } from '../types';

function GuidelineDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [guideline, setGuideline] = useState<Guideline | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(Number(id));
    }
  }, [id]);

  const loadData = async (guidelineId: number) => {
    setLoading(true);
    try {
      const res = await getGuideline(guidelineId);
      if (res.success && res.data) {
        setGuideline(res.data);
      }
    } catch (error) {
      console.error('加载指南详情失败:', error);
    }
    setLoading(false);
  };

  if (!guideline && !loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          指南不存在
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => navigate('/guidelines')}>返回列表</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/guidelines')}>
          返回指南列表
        </Button>
      </div>

      <Card
        loading={loading}
        title={guideline?.title}
        extra={
          <Space>
            <Button icon={<EditOutlined />}>编辑指南</Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="分类">
            <Tag color="blue">{guideline?.category || '未分类'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="截止日期">
            <Space>
              <CalendarOutlined />
              {guideline?.deadline || '长期有效'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {guideline?.created_at}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {guideline?.updated_at}
          </Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">指南内容</Divider>
        <div
          style={{
            padding: '0 8px',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {guideline?.content}
        </div>
      </Card>
    </div>
  );
}

export default GuidelineDetail;
