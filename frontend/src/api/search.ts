import api from './request';
import type { ApiResponse } from '../types';

export interface SearchResultItem {
  id: number;
  module: string;
  module_name: string;
  title: string;
  snippet: string;
  route_path: string;
  target_id: number | null;
  created_at: string | null;
  extra: Record<string, any>;
}

export interface SearchByModule {
  [key: string]: {
    name: string;
    count: number;
    items: SearchResultItem[];
  };
}

export interface SearchResult {
  results: SearchResultItem[];
  total: number;
  by_module: SearchByModule;
}

export interface SearchModule {
  key: string;
  name: string;
}

export const searchAll = (params: { keyword: string; modules?: string; limit?: number }) => {
  return api.get<any, ApiResponse<SearchResult>>('/search', { params });
};

export const getSearchModules = () => {
  return api.get<any, ApiResponse<SearchModule[]>>('/search/modules');
};
