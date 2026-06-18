import api from './request';
import type { EnterpriseProfile, ApiResponse } from '../types';

export const searchEnterprises = (keyword: string, limit = 10) => {
  return api.get<any, ApiResponse<EnterpriseProfile[]>>('/enterprise-profiles/search', {
    params: { keyword, limit }
  });
};

export const getEnterpriseProfile = (id: number) => {
  return api.get<any, ApiResponse<EnterpriseProfile>>(`/enterprise-profiles/${id}`);
};

export const getEnterpriseProfileByName = (name: string) => {
  return api.get<any, ApiResponse<EnterpriseProfile | null>>(
    `/enterprise-profiles/by-name/${encodeURIComponent(name)}`
  );
};

export const createEnterpriseProfile = (data: Partial<EnterpriseProfile>) => {
  return api.post<any, ApiResponse<EnterpriseProfile>>('/enterprise-profiles', data);
};

export const updateEnterpriseProfile = (id: number, data: Partial<EnterpriseProfile>) => {
  return api.put<any, ApiResponse<EnterpriseProfile>>(`/enterprise-profiles/${id}`, data);
};
