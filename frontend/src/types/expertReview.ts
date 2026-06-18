import type { Attachment } from './index';

export type ExpertLevel = 'general' | 'senior';
export type ExpertStatus = 'active' | 'inactive';
export type GroupStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'completed';
export type Recommendation = 'pending' | 'strongly_recommend' | 'recommend' | 'conditionally_recommend' | 'not_recommend';

export interface Expert {
  id: number;
  name: string;
  code: string | null;
  title: string | null;
  organization: string | null;
  field: string | null;
  specialties: string | null;
  phone: string | null;
  email: string | null;
  level: ExpertLevel;
  status: ExpertStatus;
  review_count: number;
  avg_score: number;
  last_review_at: string | null;
  created_at: string;
  updated_at: string;
  recent_tasks?: ReviewTask[];
}

export interface ScoringCriterion {
  id: number;
  guideline_id: number | null;
  name: string;
  code: string;
  description: string | null;
  max_score: number;
  weight: number;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface ReviewGroup {
  id: number;
  name: string;
  guideline_id: number | null;
  guideline_title?: string;
  description: string | null;
  declaration_ids: number[];
  expert_ids: number[];
  status: GroupStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_tasks?: number;
  submitted_tasks?: number;
  declarations?: Array<{
    id: number;
    title: string;
    applicant: string;
    company: string;
    status: string;
    current_step: number;
    guideline_title?: string;
  }>;
  experts?: Expert[];
  tasks?: ReviewTask[];
}

export interface ReviewTask {
  id: number;
  group_id: number;
  declaration_id: number;
  expert_id: number;
  guideline_id: number | null;
  status: TaskStatus;
  assigned_at: string;
  started_at: string | null;
  submitted_at: string | null;
  deadline: string | null;
  total_score: number | null;
  review_comment: string | null;
  is_anonymous: number;
  created_at: string;
  updated_at: string;
  declaration_title?: string;
  applicant?: string;
  company?: string;
  phone?: string;
  email?: string;
  declaration_content?: string;
  guideline_title?: string;
  expert_name?: string;
  expert_code?: string;
  expert_field?: string;
  group_name?: string;
  scores?: ScoreRecord[];
  criteria?: ScoringCriterion[];
  attachments?: Attachment[];
}

export interface ScoreRecord {
  id: number;
  task_id: number;
  declaration_id: number;
  expert_id: number;
  criterion_id: number;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  criterion_name?: string;
  criterion_code?: string;
  max_score?: number;
  weight?: number;
  criterion_description?: string;
}

export interface ReviewSummary {
  id: number;
  declaration_id: number;
  guideline_id: number | null;
  group_id: number | null;
  expert_count: number;
  submitted_count: number;
  avg_total_score: number | null;
  min_total_score: number | null;
  max_total_score: number | null;
  score_distribution: Record<string, number> | null;
  final_recommendation: Recommendation | null;
  final_comment: string | null;
  workflow_written: number;
  written_at: string | null;
  written_by: string | null;
  created_at: string;
  updated_at: string;
  declaration_title?: string;
  applicant?: string;
  company?: string;
  status?: string;
  guideline_title?: string;
  group_name?: string;
  expert_reviews?: Array<{
    task_id: number;
    total_score: number | null;
    review_comment: string | null;
    submitted_at: string | null;
    expert_id: number;
    is_anonymous: number;
    expert_name?: string;
    expert_field?: string;
    expert_level?: string;
    expert_display: string;
    expert_info: Record<string, any>;
  }>;
  criterion_stats?: Array<{
    criterion_id: number;
    criterion_name: string;
    criterion_code: string;
    max_score: number;
    weight: number;
    avg_score: number | null;
    min_score: number | null;
    max_score_individual: number | null;
    score_count: number;
  }>;
  individual_scores?: Array<{
    task_id: number;
    criterion_id: number;
    criterion_name: string;
    score: number;
    comment: string | null;
    expert_id: number;
  }>;
}

export interface ExpertReviewStats {
  expert_total: number;
  expert_active: number;
  group_total: number;
  task_total: number;
  task_pending: number;
  task_in_progress: number;
  task_submitted: number;
  summary_total: number;
  summary_written: number;
  recommendation_distribution: Record<Recommendation, number>;
  field_distribution: Array<{ field: string; count: number }>;
  recent_activities: Array<{
    id: number;
    user: string;
    action: string;
    module: string;
    target_id: number | null;
    detail: string;
    created_at: string;
  }>;
}

export interface ExpertLevelOption {
  value: ExpertLevel;
  label: string;
  color: string;
}

export interface ExpertStatusOption {
  value: ExpertStatus;
  label: string;
  color: string;
}

export interface GroupStatusOption {
  value: GroupStatus;
  label: string;
  color: string;
}

export interface TaskStatusOption {
  value: TaskStatus;
  label: string;
  color: string;
}

export interface RecommendationOption {
  value: Recommendation;
  label: string;
  color: string;
}

export const ExpertLevelMap: Record<ExpertLevel, string> = {
  general: '普通专家',
  senior: '资深专家'
};

export const ExpertLevelColorMap: Record<ExpertLevel, string> = {
  general: 'default',
  senior: 'gold'
};

export const ExpertStatusMap: Record<ExpertStatus, string> = {
  active: '活跃',
  inactive: '停用'
};

export const ExpertStatusColorMap: Record<ExpertStatus, string> = {
  active: 'success',
  inactive: 'default'
};

export const GroupStatusMap: Record<GroupStatus, string> = {
  pending: '待分配',
  in_progress: '评审中',
  completed: '已完成',
  cancelled: '已取消'
};

export const GroupStatusColorMap: Record<GroupStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  cancelled: 'default'
};

export const TaskStatusMap: Record<TaskStatus, string> = {
  pending: '待分配',
  assigned: '已分配',
  in_progress: '评审中',
  submitted: '已提交',
  completed: '已完成'
};

export const TaskStatusColorMap: Record<TaskStatus, string> = {
  pending: 'default',
  assigned: 'blue',
  in_progress: 'processing',
  submitted: 'success',
  completed: 'success'
};

export const RecommendationMap: Record<Recommendation, string> = {
  pending: '评审中',
  strongly_recommend: '强烈推荐',
  recommend: '推荐立项',
  conditionally_recommend: '有条件推荐',
  not_recommend: '不予推荐'
};

export const RecommendationColorMap: Record<Recommendation, string> = {
  pending: 'default',
  strongly_recommend: 'success',
  recommend: 'green',
  conditionally_recommend: 'orange',
  not_recommend: 'red'
};
