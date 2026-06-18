import { useState, useEffect } from 'react';
import {
  Card,
  List,
  Tag,
  Progress,
  Button,
  Space,
  Empty,
  Spin,
  Tooltip,
  Collapse,
  Statistic,
  Row,
  Col,
  Badge,
  Divider
} from 'antd';
import {
  ThunderboltOutlined,
  FileTextOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StarOutlined,
  FileDoneOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import {
  getPolicyRecommendations,
  quickCreateDeclaration,
  selectPolicy
} from '../api/policy-match';
import {
  PolicyMatchResult,
  MatchLevel,
  MatchLevelLabel,
  MatchLevelColor,
  MatchLevelColorMap,
  MatchDetail,
  GuidelineTag
} from '../types';
import { useNavigate } from 'react-router-dom';

interface PolicyRecommendPanelProps {
  companyName?: string;
  applicant?: string;
  projectTitle?: string;
  projectContent?: string;
  employeeCount?: number;
  techPersonRatio?: number;
  rdRatio?: number;
  ipCount?: number;
  registeredYears?: number;
  industry?: string;
  onSelect?: (guidelineId: number, matchId: number) => void;
  showQuickCreate?: boolean;
  matchSource?: string;
  matchContext?: string;
}

function PolicyRecommendPanel({
  companyName,
  applicant,
  projectTitle,
  projectContent,
  employeeCount,
  techPersonRatio,
  rdRatio,
  ipCount,
  registeredYears,
  industry,
  onSelect,
  showQuickCreate = true,
  matchSource = 'form',
  matchContext
}: PolicyRecommendPanelProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<PolicyMatchResult[]>([]);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [bestMatch, setBestMatch] = useState<PolicyMatchResult | null>(null);

  useEffect(() => {
    const hasInput = 
      (companyName && companyName.trim()) ||
      (projectTitle && projectTitle.trim()) ||
      (projectContent && projectContent.trim());

    if (hasInput) {
      const timer = setTimeout(() => {
        loadRecommendations();
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setMatchResults([]);
      setBestMatch(null);
    }
  }, [companyName, applicant, projectTitle, projectContent, employeeCount, techPersonRatio, rdRatio, ipCount, registeredYears, industry]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const res = await getPolicyRecommendations({
        company_name: companyName,
        applicant,
        project_title: projectTitle,
        project_content: projectContent,
        employee_count: employeeCount,
        tech_person_ratio: techPersonRatio,
        rd_ratio: rdRatio,
        ip_count: ipCount,
        registered_years: registeredYears,
        industry,
        top_n: 5,
        match_source: matchSource,
        match_context: matchContext
      });
      if (res.success && res.data) {
        setMatchResults(res.data.results || []);
        setBestMatch(res.data.best_match);
        setMatchId(res.data.match_id);
      }
    } catch (error) {
      console.error('加载推荐失败:', error);
    }
    setLoading(false);
  };

  const handleSelect = async (result: PolicyMatchResult) => {
    if (matchId) {
      try {
        await selectPolicy({
          match_id: matchId,
          guideline_id: result.guideline_id
        });
      } catch (e) {
        console.error('记录选择失败:', e);
      }
    }
    onSelect?.(result.guideline_id, matchId || 0);
  };

  const handleQuickCreate = async (result: PolicyMatchResult) => {
    try {
      const res = await quickCreateDeclaration({
        match_id: matchId || undefined,
        guideline_id: result.guideline_id,
        title: projectTitle || `${result.title} - ${companyName || '新申报'}`,
        applicant,
        company: companyName,
        content: projectContent
      });
      if (res.success && res.data) {
        navigate(`/declarations/${res.data.id}/edit`);
      }
    } catch (error: any) {
      console.error('快速创建失败:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    if (score >= 40) return '#faad14';
    return '#8c8c8c';
  };

  const renderMatchDetails = (details: MatchDetail[]) => {
    if (!details || details.length === 0) {
      return <Empty description="暂无匹配详情" image={null} />;
    }

    return (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {details.map((detail, index) => (
          <div
            key={index}
            style={{
              padding: '8px 12px',
              background: '#fafafa',
              borderRadius: 4,
              fontSize: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>{detail.label}</span>
              <span style={{ color: getScoreColor(detail.score) }}>
                {detail.score}/{detail.max_score}
              </span>
            </div>
            <div style={{ color: '#666' }}>{detail.description}</div>
            <Progress
              percent={Math.round((detail.score / detail.max_score) * 100)}
              size="small"
              showInfo={false}
              strokeColor={getScoreColor(detail.score)}
              style={{ marginTop: 4 }}
            />
          </div>
        ))}
      </Space>
    );
  };

  const renderTags = (tags: GuidelineTag[]) => {
    if (!tags || tags.length === 0) return null;
    return (
      <Space size={[4, 4]} wrap>
        {tags.slice(0, 5).map(tag => (
          <Tag key={tag.id} color="blue" style={{ margin: 0 }}>
            {tag.tag_name}
          </Tag>
        ))}
      </Space>
    );
  };

  if (loading && matchResults.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="正在为您匹配最优政策..." />
        </div>
      </Card>
    );
  }

  if (matchResults.length === 0) {
    return (
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <span>智能政策推荐</span>
          </Space>
        }
        size="small"
      >
        <Empty
          description="请输入企业信息或项目内容，系统将为您智能匹配最合适的申报政策"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          <span>智能政策推荐</span>
          <Tag color="geekblue">{matchResults.length} 个匹配结果</Tag>
        </Space>
      }
      size="small"
      extra={
        <Button size="small" onClick={loadRecommendations}>
          刷新
        </Button>
      }
    >
      {bestMatch && (
        <div
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)',
            borderRadius: 8,
            marginBottom: 12,
            border: '2px solid #52c41a'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Space style={{ marginBottom: 8 }}>
                <Badge status="success" text="最佳推荐" />
                <Tag color={MatchLevelColorMap[bestMatch.match_level]}>
                  {MatchLevelLabel[bestMatch.match_level]}
                </Tag>
              </Space>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {bestMatch.title}
              </div>
              {renderTags(bestMatch.tags)}
            </div>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={bestMatch.score}
                width={70}
                strokeColor={MatchLevelColor[bestMatch.match_level]}
              />
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>匹配度</div>
            </div>
          </div>
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={8}>
              <Statistic
                title="历史立项率"
                value={bestMatch.history_stats.approval_rate}
                suffix="%"
                valueStyle={{ fontSize: 14, color: '#52c41a' }}
                prefix={<RiseOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="材料数"
                value={bestMatch.material_count}
                valueStyle={{ fontSize: 14 }}
                prefix={<FileTextOutlined />}
              />
            </Col>
            <Col span={8}>
              {bestMatch.days_remaining !== null && bestMatch.days_remaining !== undefined && (
                <Statistic
                  title={bestMatch.days_remaining < 0 ? '已截止' : '剩余天数'}
                  value={Math.abs(bestMatch.days_remaining)}
                  valueStyle={{ fontSize: 14, color: bestMatch.days_remaining < 0 ? '#ff4d4f' : '#faad14' }}
                  prefix={<ClockCircleOutlined />}
                />
              )}
            </Col>
          </Row>
          {showQuickCreate && (
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Space>
                <Button size="small" onClick={() => handleSelect(bestMatch)}>
                  选用此指南
                </Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<FileDoneOutlined />}
                  onClick={() => handleQuickCreate(bestMatch)}
                >
                  快速创建申报
                </Button>
              </Space>
            </div>
          )}
        </div>
      )}

      <Divider style={{ margin: '12px 0' }} plain>
        更多推荐
      </Divider>

      <List
        dataSource={matchResults.slice(bestMatch ? 1 : 0)}
        renderItem={(item) => (
          <List.Item
            style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
            actions={[
              <Button
                key="select"
                type="link"
                size="small"
                onClick={() => handleSelect(item)}
              >
                选用
              </Button>,
              showQuickCreate && (
                <Button
                  key="create"
                  type="link"
                  size="small"
                  icon={<ArrowRightOutlined />}
                  onClick={() => handleQuickCreate(item)}
                >
                  快速创建
                </Button>
              )
            ].filter(Boolean)}
          >
            <List.Item.Meta
              title={
                <Space>
                  <span style={{ fontWeight: 500 }}>{item.title}</span>
                  <Tag color={MatchLevelColorMap[item.match_level]}>
                    {MatchLevelLabel[item.match_level]}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <Space style={{ marginBottom: 6 }}>
                    <Tag color="default">{item.category}</Tag>
                    {item.deadline && (
                      <span style={{ fontSize: 12, color: '#999' }}>
                        截止: {item.deadline}
                      </span>
                    )}
                  </Space>
                  {renderTags(item.tags)}
                </div>
              }
            />
            <div style={{ textAlign: 'center', minWidth: 60 }}>
              <Progress
                type="circle"
                percent={item.score}
                width={48}
                strokeColor={MatchLevelColor[item.match_level]}
              />
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {item.score}分
              </div>
            </div>
          </List.Item>
        )}
      />

      {matchResults.length > 0 && (
        <Collapse
          size="small"
          style={{ marginTop: 12 }}
          items={[
            {
              key: 'details',
              label: (
                <Space>
                  <StarOutlined />
                  <span>匹配详情说明</span>
                </Space>
              ),
              children: renderMatchDetails(bestMatch?.match_details || matchResults[0]?.match_details || [])
            }
          ]}
        />
      )}
    </Card>
  );
}

export default PolicyRecommendPanel;
