import api from './request';
import type { Guideline, ApiResponse } from '../types';

export const getGuidelines = (params?: { category?: string; keyword?: string }) => {
  return api.get<any, ApiResponse<Guideline[]>>('/guidelines', { params });
};

export const getGuideline = (id: number) => {
  return api.get<any, ApiResponse<Guideline>>(`/guidelines/${id}`);
};

export const createGuideline = (data: Partial<Guideline>) => {
  return api.post<any, ApiResponse<{ id: number }>>('/guidelines', data);
};

export const updateGuideline = (id: number, data: Partial<Guideline>) => {
  return api.put<any, ApiResponse<void>>(`/guidelines/${id}`, data);
};

export const deleteGuideline = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/guidelines/${id}`);
};
