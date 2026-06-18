import api from './request';
import type { OperationLog, ApiResponse, OperationTimelineEvent } from '../types';

export const getLogs = (params?: { 
  module?: string; 
  action?: string; 
  user?: string;
  target_id?: number;
  page?: number; 
  pageSize?: number;
  include_data?: boolean;
}) => {
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
