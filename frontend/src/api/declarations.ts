import api from './request';
import type {
  Declaration,
  ApiResponse,
  DeclarationStats,
  QualificationCheckResult,
  TodoKanbanSummary,
  SavedFilter,
  BatchCheckResult,
  BatchSubmitResult
} from '../types';

export const getDeclarations = (params?: {
  status?: string;
  keyword?: string;
  applicant?: string;
  include_deleted?: boolean;
}) => {
  return api.get<any, ApiResponse<Declaration[]>>('/declarations', { params });
};

export const getDeclaration = (id: number) => {
  return api.get<any, ApiResponse<Declaration>>(`/declarations/${id}`);
};

export const createDeclaration = (data: Partial<Declaration>) => {
  return api.post<any, ApiResponse<{ id: number; status: string; version_number: number }>>('/declarations', data);
};

export const updateDeclaration = (
  id: number,
  data: Partial<Declaration> & { change_note?: string }
) => {
  return api.put<
    any,
    ApiResponse<{
      version_number: number;
      changed_fields: string[];
      skipped?: boolean;
    }>
  >(`/declarations/${id}`, data);
};

export const submitDeclaration = (id: number) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/declarations/${id}/submit`);
};

export const deleteDeclaration = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/declarations/${id}`);
};

export const getDeclarationStats = () => {
  return api.get<any, ApiResponse<DeclarationStats>>('/declarations/stats');
};

export const restoreDeclaration = (
  id: number,
  data?: { restore_note?: string }
) => {
  return api.post<any, ApiResponse<{ status: string }>>(
    `/declarations/${id}/restore`,
    data || {}
  );
};

export const checkQualification = (data: {
  guideline_id?: number | null;
  company?: string;
  applicant?: string;
  phone?: string;
  email?: string;
  content?: string;
  declaration_id?: number;
}) => {
  return api.post<any, ApiResponse<QualificationCheckResult>>(
    '/declarations/qualification-check',
    data
  );
};

export const getTodoKanbanSummary = (params?: { role?: string }) => {
  return api.get<any, ApiResponse<TodoKanbanSummary>>('/declarations/todo-kanban/summary', { params });
};

export const batchExportDeclarations = (ids: number[]) => {
  return api.post('/declarations/batch/export', { ids }, { responseType: 'blob' });
};

export const batchSubmitDeclarations = (ids: number[]) => {
  return api.post<any, ApiResponse<BatchSubmitResult>>('/declarations/batch/submit', { ids });
};

export const batchQualificationCheck = (ids: number[]) => {
  return api.post<any, ApiResponse<{ data: BatchCheckResult[]; summary: { total: number; passed: number; failed: number; avg_score: number } }>>(
    '/declarations/batch/qualification-check',
    { ids }
  );
};

export const batchFollowDeclarations = (ids: number[], followed: boolean) => {
  return api.post<any, ApiResponse<Array<{ id: number; title: string; is_followed: number }>>>(
    '/declarations/batch/follow',
    { ids, followed }
  );
};

export const toggleFollowDeclaration = (id: number, followed: boolean) => {
  return api.post<any, ApiResponse<{ is_followed: number }>>(`/declarations/${id}/follow`, { followed });
};

export const getSavedFilters = (module = 'declarations') => {
  return api.get<any, ApiResponse<SavedFilter[]>>('/declarations/filters', { params: { module } });
};

export const createSavedFilter = (data: { name: string; module?: string; filter_data: Record<string, any>; is_default?: number }) => {
  return api.post<any, ApiResponse<SavedFilter>>('/declarations/filters', data);
};

export const updateSavedFilter = (id: number, data: { name?: string; filter_data?: Record<string, any>; is_default?: number }) => {
  return api.put<any, ApiResponse<SavedFilter>>(`/declarations/filters/${id}`, data);
};

export const deleteSavedFilter = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/declarations/filters/${id}`);
};
