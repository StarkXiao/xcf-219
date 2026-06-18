import api from './request';
import type { Declaration, ApiResponse, DeclarationStats, QualificationCheckResult, DeclarationResubmission } from '../types';

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

export const resubmitDeclaration = (id: number, data: { supplement_note?: string }) => {
  return api.post<any, ApiResponse<{ status: string }>>(
    `/declarations/${id}/resubmit`,
    data
  );
};

export const getDeclarationResubmissions = (id: number) => {
  return api.get<any, ApiResponse<DeclarationResubmission[]>>(
    `/declarations/${id}/resubmissions`
  );
};
