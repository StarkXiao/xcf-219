import api from './request';
import type { Declaration, ApiResponse } from '../types';

export const getDeclarations = (params?: { status?: string; keyword?: string; applicant?: string }) => {
  return api.get<any, ApiResponse<Declaration[]>>('/declarations', { params });
};

export const getDeclaration = (id: number) => {
  return api.get<any, ApiResponse<Declaration>>(`/declarations/${id}`);
};

export const createDeclaration = (data: Partial<Declaration>) => {
  return api.post<any, ApiResponse<{ id: number; status: string }>>('/declarations', data);
};

export const updateDeclaration = (id: number, data: Partial<Declaration>) => {
  return api.put<any, ApiResponse<void>>(`/declarations/${id}`, data);
};

export const submitDeclaration = (id: number) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/declarations/${id}/submit`);
};

export const deleteDeclaration = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/declarations/${id}`);
};
