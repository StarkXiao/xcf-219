import api from './request';
import type { ApiResponse, OperationTimelineEvent, OperationLog } from '../types';

export const getDeclarationTimeline = (declarationId: number) => {
  return api.get<any, ApiResponse<OperationTimelineEvent[]>>(
    `/logs/timeline/${declarationId}`
  );
};

export const getOperationLogs = (params?: {
  page?: number;
  pageSize?: number;
  module?: string;
  user?: string;
  keyword?: string;
}) => {
  return api.get<any, ApiResponse<{
    list: OperationLog[];
    total: number;
    page: number;
    pageSize: number;
  }>>('/logs', { params });
};
