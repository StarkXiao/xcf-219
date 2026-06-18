import { useState, useEffect } from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Space,
  Empty,
  Spin,
  Statistic,
  Row,
  Col,
  Tooltip,
  Progress
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { getRecommendedMaterials } from '../api/policy-match';
import { RecommendedMaterial } from '../types';

interface RecommendedMaterialsProps {
  guidelineId: number | null | undefined;
  uploadedMaterialIds?: number[];
  onMaterialClick?: (material: RecommendedMaterial) => void;
  showUploadButton?: boolean;
}

function RecommendedMaterials({
  guidelineId,
  uploadedMaterialIds = [],
  onMaterialClick,
  showUploadButton = true
}: RecommendedMaterialsProps) {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<RecommendedMaterial[]>([]);
  const [stats, setStats] = useState({ total: 0, required: 0, optional: 0 });
  const [guidelineInfo, setGuidelineInfo] = useState<{ id: number; title: string; category: string } | null>(null);

  useEffect(() => {
    if (guidelineId) {
      loadMaterials(guidelineId);
    } else {
      setMaterials([]);
      setStats({ total: 0, required: 0, optional: 0 });
      setGuidelineInfo(null);
    }
  }, [guidelineId]);

  const loadMaterials = async (id: number) => {
    setLoading(true);
    try {
      const res = await getRecommendedMaterials(id);
      if (res.success && res.data) {
        setMaterials(res.data.materials || []);
        setStats(res.data.stats || { total: 0, required: 0, optional: 0 });
        setGuidelineInfo(res.data.guideline);
      }
    } catch (error) {
      console.error('加载推荐材料失败:', error);
    }
    setLoading(false);
  };

  const isUploaded = (materialId: number) => {
    return uploadedMaterialIds.includes(materialId);
  };

  const requiredMaterials = materials.filter(m => m.required || m.is_category_required);
  const optionalMaterials = materials.filter(m => !m.required && !m.is_category_required);

  const uploadedRequiredCount = requiredMaterials.filter(m => isUploaded(m.id)).length;
  const completionRate = requiredMaterials.length > 0
    ? Math.round((uploadedRequiredCount / requiredMaterials.length) * 100)
    : 0;

  if (!guidelineId) {
    return (
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>推荐材料清单</span>
          </Space>
        }
      >
        <Empty
          description="请先选择申报指南，系统将为您推荐所需的申报材料"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>推荐材料清单</span>
          </Space>
        }
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  const renderMaterialItem = (material: RecommendedMaterial) => {
    const uploaded = isUploaded(material.id);
    const isRequired = material.required || material.is_category_required;

    return (
      <List.Item
        key={material.id}
        style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}
        actions={[
          showUploadButton && (
            <Button
              key="upload"
              type="link"
              size="small"
              icon={uploaded ? <CheckCircleOutlined /> : <DownloadOutlined />}
              onClick={() => onMaterialClick?.(material)}
            >
              {uploaded ? '已上传' : '上传'}
            </Button>
          )
        ].filter(Boolean)}
      >
        <List.Item.Meta
          title={
            <Space>
              {isRequired && (
                <Tag color="red" style={{ marginRight: 8 }}>
                  必需
                </Tag>
              )}
              {!isRequired && (
                <Tag color="default" style={{ marginRight: 8 }}>
                  可选
                </Tag>
              )}
              <span style={{ fontWeight: 500 }}>{material.name}</span>
              {uploaded && (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  已上传
                </Tag>
              )}
            </Space>
          }
          description={
            <div>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                {material.description}
              </div>
              <Tooltip title={material.recommendation_reason}>
                <Tag color="blue" icon={<InfoCircleOutlined />}>
                  为什么需要这个材料？
                </Tag>
              </Tooltip>
              <Space size="small" style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                <span>格式: {material.allowed_extensions?.join(', ') || '不限'}</span>
                <span>大小: {material.max_size ? (material.max_size / 1024 / 1024).toFixed(0) + 'MB' : '不限'}</span>
              </Space>
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>推荐材料清单</span>
          {guidelineInfo && <Tag color="geekblue">{guidelineInfo.title}</Tag>}
        </Space>
      }
      extra={
        <Button size="small" onClick={() => guidelineId && loadMaterials(guidelineId)}>
          刷新
        </Button>
      }
    >
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="材料总数"
            value={stats.total}
            valueStyle={{ fontSize: 16 }}
            prefix={<FileTextOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="必需材料"
            value={stats.required}
            valueStyle={{ fontSize: 16, color: '#ff4d4f' }}
            prefix={<ExclamationCircleOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="完成进度"
            value={completionRate}
            suffix="%"
            valueStyle={{ fontSize: 16, color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
      </Row>

      {requiredMaterials.length > 0 && (
        <Progress
          percent={completionRate}
          status={completionRate === 100 ? 'success' : 'active'}
          style={{ marginBottom: 16 }}
          format={() => `必需材料完成 ${uploadedRequiredCount}/${requiredMaterials.length}`}
        />
      )}

      {requiredMaterials.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, marginBottom: 8, color: '#ff4d4f' }}>
            必需材料 ({requiredMaterials.length})
          </div>
          <List
            dataSource={requiredMaterials}
            renderItem={renderMaterialItem}
            style={{ background: '#fff7f7', borderRadius: 4, padding: '0 12px' }}
          />
        </div>
      )}

      {optionalMaterials.length > 0 && (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 8, color: '#1890ff' }}>
            可选材料 ({optionalMaterials.length})
          </div>
          <List
            dataSource={optionalMaterials}
            renderItem={renderMaterialItem}
            style={{ background: '#f0f9ff', borderRadius: 4, padding: '0 12px' }}
          />
        </div>
      )}

      {materials.length === 0 && (
        <Empty
          description="暂无推荐材料"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );
}

export default RecommendedMaterials;
