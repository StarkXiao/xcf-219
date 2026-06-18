import api from './request';
import type {
  ApiResponse,
  PolicyMatchResult,
  PolicyRecommendResponse,
  PolicyMatchRecord,
  PolicyMatchStats,
  RecommendedMaterialsResponse
} from '../types';

export const getPolicyRecommendations = (data: {
  company_name?: string;
  applicant?: string;
  project_title?: string;
  project_content?: string;
  employee_count?: number;
  tech_person_ratio?: number;
  rd_ratio?: number;
  ip_count?: number;
  registered_years?: number;
  industry?: string;
  top_n?: number;
  match_source?: string;
  match_context?: string;
}) => {
  return api.post<any, ApiResponse<PolicyRecommendResponse>>(
    '/policy-match/recommend',
    data
  );
};

export const selectPolicy = (data: {
  match_id: number;
  guideline_id: number;
}) => {
  return api.post<any, ApiResponse<void>>('/policy-match/select', data);
};

export const getMatchRecords = (params?: {
  page?: number;
  pageSize?: number;
  company_name?: string;
  guideline_id?: number;
}) => {
  return api.get<any, ApiResponse<{
    list: PolicyMatchRecord[];
    total: number;
    page: number;
    pageSize: number;
  }>>('/policy-match/match-records', { params });
};

export const getMatchRecord = (id: number) => {
  return api.get<any, ApiResponse<PolicyMatchRecord>>(
    `/policy-match/match-records/${id}`
  );
};

export const getPolicyMatchStats = () => {
  return api.get<any, ApiResponse<PolicyMatchStats>>('/policy-match/stats');
};

export const getRecommendedMaterials = (guidelineId: number) => {
  return api.get<any, ApiResponse<RecommendedMaterialsResponse>>(
    `/policy-match/recommend-materials/${guidelineId}`
  );
};

export const quickCreateDeclaration = (data: {
  match_id?: number;
  guideline_id: number;
  title?: string;
  applicant?: string;
  company?: string;
  phone?: string;
  email?: string;
  content?: string;
}) => {
  return api.post<any, ApiResponse<{
    id: number;
    title: string;
    status: string;
    guideline_id: number;
  }>>('/policy-match/quick-create-declaration', data);
};
