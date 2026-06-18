import api from './request';
import type {
  DeclarationVersion,
  VersionsListResponse,
  DiffCompareResult,
  SaveTypeOption,
  RestorePreviewResult,
  ApiResponse,
  RecycleBinListResponse
} from '../types';

export const getVersions = (
  declarationId: number,
  params?: { page?: number; pageSize?: number; save_type?: string }
) => {
  return api.get<any, ApiResponse<VersionsListResponse>>(
    `/versions/declaration/${declarationId}`,
    { params }
  );
};

export const getVersion = (versionId: number) => {
  return api.get<any, ApiResponse<DeclarationVersion>>(`/versions/${versionId}`);
};

export const getLatestVersion = (declarationId: number) => {
  return api.get<any, ApiResponse<DeclarationVersion>>(
    `/versions/declaration/${declarationId}/latest`
  );
};

export const autosaveDraft = (declarationId: number, data: any) => {
  return api.post<any, ApiResponse<{
    version_number: number;
    saved_at: string;
    changes: string[];
  }> & { skipped?: boolean }>(`/versions/declaration/${declarationId}/autosave`, data);
};

export const saveVersion = (
  declarationId: number,
  data: any & { change_note?: string }
) => {
  return api.post<any, ApiResponse<{
    version_number: number;
    saved_at: string;
    change_summary: string;
    changes: string[];
  }>>(`/versions/declaration/${declarationId}/save-version`, data);
};

export const compareVersions = (params: {
  declaration_id: number;
  version1?: number;
  version2?: number;
  type?: 'versions' | 'current_vs_version';
}) => {
  return api.get<any, ApiResponse<DiffCompareResult>>('/versions/diff/compare', { params });
};

export const restoreVersion = (
  versionId: number,
  data?: { restore_note?: string }
) => {
  return api.post<any, ApiResponse<{
    declaration_id: number;
    restored_from_version: number;
    new_version_number: number;
    changes: string[];
  }>>(`/versions/${versionId}/restore`, data || {});
};

export const previewRestoreVersion = (
  declarationId: number,
  versionNumber: number
) => {
  return api.post<any, ApiResponse<RestorePreviewResult>>(
    `/versions/declaration/${declarationId}/preview-restore`,
    { version_number: versionNumber }
  );
};

export const getSaveTypes = () => {
  return api.get<any, ApiResponse<SaveTypeOption[]>>('/versions/save-types');
};

export const getRecycleBin = (params?: {
  keyword?: string;
  page?: number;
  pageSize?: number;
}) => {
  return api.get<any, ApiResponse<RecycleBinListResponse>>(
    '/declarations/recycle-bin',
    { params }
  );
};

export const restoreFromRecycleBin = (
  declarationId: number,
  data?: { restore_note?: string }
) => {
  return api.post<any, ApiResponse<{ status: string }>>(
    `/declarations/${declarationId}/restore`,
    data || {}
  );
};

export const permanentlyDeleteDeclaration = (declarationId: number) => {
  return api.delete<any, ApiResponse<void>>(
    `/declarations/${declarationId}?permanent=true`
  );
};

export const clearRecycleBin = (params?: { older_than_days?: number }) => {
  return api.post<any, ApiResponse<{
    deleted_count: number;
    deleted_ids: number[];
  }>>('/declarations/recycle-bin/clear', params || {});
};
