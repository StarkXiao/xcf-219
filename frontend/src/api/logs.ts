import api from './request';
import type { OperationLog, ApiResponse, OperationTimelineEvent } from '../types';

export interface LogFilterParams {
  module?: string;
  action?: string;
  user?: string;
  target_id?: number;
  start_date?: string;
  end_date?: string;
  detail_keyword?: string;
  page?: number;
  pageSize?: number;
  include_data?: boolean;
}

export interface LogFilterOptions {
  modules: string[];
  actions: string[];
  users: string[];
}

export interface TargetInfo {
  type: 'declaration' | 'guideline';
  id: number;
  display_title: string;
  display_subtitle?: string;
  status_text?: string;
  title?: string;
  applicant?: string;
  company?: string;
  status?: string;
  current_step?: number;
  is_deleted?: number;
  category?: string;
  deadline?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TargetDetailResponse {
  module: string;
  target_id: number;
  target_info: TargetInfo | null;
  related_logs: OperationLog[];
  related_count: number;
}

export interface LogDetailExtra {
  target_info?: TargetInfo | null;
  previous_log?: OperationLog | null;
  next_log?: OperationLog | null;
}

export const getLogs = (params?: LogFilterParams) => {
  return api.get<any, ApiResponse<{
    list: (OperationLog & {
      before_data_parsed?: Record<string, any>;
      after_data_parsed?: Record<string, any>;
      changed_fields_parsed?: string[];
    })[];
    total: number;
    page: number;
    pageSize: number;
  }>>('/logs', { params });
};

export const getLogById = (id: number) => {
  return api.get<any, ApiResponse<OperationLog & {
    before_data_parsed?: Record<string, any>;
    after_data_parsed?: Record<string, any>;
    changed_fields_parsed?: string[];
    target_info?: TargetInfo | null;
    previous_log?: OperationLog | null;
    next_log?: OperationLog | null;
  }>>(`/logs/${id}`);
};

export const getLogsByTarget = (
  module: string,
  targetId: number,
  params?: { page?: number; pageSize?: number; include_data?: boolean }
) => {
  return api.get<any, ApiResponse<{
    module: string;
    target_id: number;
    list: OperationLog[];
    total: number;
    page: number;
    pageSize: number;
  }>>(`/logs/target/${encodeURIComponent(module)}/${targetId}`, { params });
};

export const getTargetDetail = (module: string, targetId: number) => {
  return api.get<any, ApiResponse<TargetDetailResponse>>(
    `/logs/target/detail/${encodeURIComponent(module)}/${targetId}`
  );
};

export const getLogFilterOptions = () => {
  return api.get<any, ApiResponse<LogFilterOptions>>('/logs/options/filters');
};

export const getDeclarationTimeline = (declarationId: number) => {
  return api.get<any, ApiResponse<{
    declaration_id: number;
    timeline: OperationTimelineEvent[];
    total: number;
  }>>(`/logs/module/declaration/${declarationId}`);
};

export const getLogStatistics = (params?: { start_date?: string; end_date?: string }) => {
  return api.get<any, ApiResponse<{
    total: number;
    by_module: { module: string; count: number }[];
    by_action: { action: string; count: number }[];
    by_user?: { user: string; count: number }[];
    by_day?: { date: string; count: number }[];
  }>>('/logs/statistics', { params });
};
