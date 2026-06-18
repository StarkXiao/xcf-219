import api from './request';
import type { ApiResponse } from '../types';
import type {
  Expert,
  ScoringCriterion,
  ReviewGroup,
  ReviewTask,
  ReviewSummary,
  ExpertReviewStats,
  GroupStatus,
  TaskStatus,
  Recommendation
} from '../types/expertReview';

export const getExpertFields = () => {
  return api.get<any, ApiResponse<string[]>>('/expert-review/fields');
};

export const getExperts = (params?: { field?: string; status?: string; keyword?: string }) => {
  return api.get<any, ApiResponse<Expert[]>>('/expert-review/experts', { params });
};

export const getExpert = (id: number) => {
  return api.get<any, ApiResponse<Expert>>(`/expert-review/experts/${id}`);
};

export const createExpert = (data: Partial<Expert>) => {
  return api.post<any, ApiResponse<{ id: number }>>('/expert-review/experts', data);
};

export const updateExpert = (id: number, data: Partial<Expert>) => {
  return api.put<any, ApiResponse<Expert>>(`/expert-review/experts/${id}`, data);
};

export const deleteExpert = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/expert-review/experts/${id}`);
};

export const getScoringCriteria = (params?: { guideline_id?: number }) => {
  return api.get<any, ApiResponse<ScoringCriterion[]>>('/expert-review/criteria', { params });
};

export const getReviewGroups = (params?: { guideline_id?: number; status?: string }) => {
  return api.get<any, ApiResponse<ReviewGroup[]>>('/expert-review/groups', { params });
};

export const getReviewGroup = (id: number) => {
  return api.get<any, ApiResponse<ReviewGroup>>(`/expert-review/groups/${id}`);
};

export const createReviewGroup = (data: {
  name: string;
  guideline_id?: number | null;
  description?: string;
  declaration_ids?: number[];
  expert_ids?: number[];
  expert_count?: number;
  field?: string;
  deadline?: string;
}) => {
  return api.post<any, ApiResponse<{ id: number; task_count: number }>>('/expert-review/groups', data);
};

export const updateGroupStatus = (id: number, status: GroupStatus) => {
  return api.put<any, ApiResponse<void>>(`/expert-review/groups/${id}/status`, { status });
};

export const addDeclarationsToGroup = (id: number, declaration_ids: number[]) => {
  return api.post<any, ApiResponse<{ added: number }>>(`/expert-review/groups/${id}/add-declarations`, { declaration_ids });
};

export const addExpertsToGroup = (id: number, expert_ids: number[]) => {
  return api.post<any, ApiResponse<{ added: number }>>(`/expert-review/groups/${id}/add-experts`, { expert_ids });
};

export const getReviewTasks = (params?: {
  expert_id?: number;
  declaration_id?: number;
  group_id?: number;
  status?: TaskStatus | 'all';
}) => {
  return api.get<any, ApiResponse<ReviewTask[]>>('/expert-review/tasks', { params });
};

export const getReviewTask = (id: number) => {
  return api.get<any, ApiResponse<ReviewTask>>(`/expert-review/tasks/${id}`);
};

export const startReviewTask = (id: number) => {
  return api.post<any, ApiResponse<void>>(`/expert-review/tasks/${id}/start`);
};

export const submitReviewTask = (id: number, data: {
  scores: Array<{ criterion_id: number; score: number; comment?: string }>;
  review_comment?: string;
}) => {
  return api.post<any, ApiResponse<{ total_score: number }>>(`/expert-review/tasks/${id}/submit`, data);
};

export const getReviewSummaries = (params?: {
  declaration_id?: number;
  guideline_id?: number;
  group_id?: number;
  recommendation?: Recommendation | 'all';
}) => {
  return api.get<any, ApiResponse<ReviewSummary[]>>('/expert-review/summaries', { params });
};

export const getReviewSummary = (declarationId: number) => {
  return api.get<any, ApiResponse<ReviewSummary>>(`/expert-review/summaries/${declarationId}`);
};

export const updateSummaryComment = (declarationId: number, data: {
  final_comment?: string;
  final_recommendation?: Recommendation;
}) => {
  return api.post<any, ApiResponse<void>>(`/expert-review/summaries/${declarationId}/update-comment`, data);
};

export const writeToWorkflow = (declarationId: number, data?: {
  approver?: string;
  action?: 'approve' | 'reject';
  comment?: string;
}) => {
  return api.post<any, ApiResponse<{
    action: 'approve' | 'reject';
    previous_status: string;
    new_status: string;
    step_name: string;
  }>>(`/expert-review/summaries/${declarationId}/write-to-workflow`, data || {});
};

export const getExpertReviewStats = () => {
  return api.get<any, ApiResponse<ExpertReviewStats>>('/expert-review/stats');
};
