import api from './request';
import type { OperationLog, ApiResponse } from '../types';

export const getLogs = (params?: { 
  module?: string; 
  action?: string; 
  user?: string; 
  page?: number; 
  pageSize?: number 
}) => {
  return api.get<any, ApiResponse<{
    list: OperationLog[];
    total: number;
    page: number;
    pageSize: number;
  }>>('/logs', { params });
};

export const getLogStatistics = () => {
  return api.get<any, ApiResponse<{
    total: number;
    by_module: { module: string; count: number }[];
    by_action: { action: string; count: number }[];
  }>>('/logs/statistics');
};
