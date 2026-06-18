import api from './request';
import type {
  ApiResponse,
  VersionsListResponse,
  DiffCompareResult,
  SaveTypeOption,
  RestorePreviewResult
} from '../types';

export const autosaveDraft = (declarationId: number, data: Record<string, any>) => {
  return api.post<any, ApiResponse<{ version_number: number; saved_at: string; skipped?: boolean }>>(
    `/versions/${declarationId}/autosave`,
    data
  );
};

export const saveVersion = (declarationId: number, data: { change_note?: string }) => {
  return api.post<any, ApiResponse<{ version_number: number }>>(
    `/versions/${declarationId}/save`,
    data
  );
};

export const getVersions = (declarationId: number, params?: { page?: number; pageSize?: number }) => {
  return api.get<any, ApiResponse<VersionsListResponse>>(
    `/versions/${declarationId}`,
    { params }
  );
};

export const compareVersions = (params: {
  declaration_id: number;
  v1?: number;
  v2?: number;
  type?: 'versions' | 'current_vs_version';
}) => {
  return api.post<any, ApiResponse<DiffCompareResult>>(
    `/versions/${params.declaration_id}/compare`,
    params
  );
};

export const restoreVersion = (versionId: number) => {
  return api.post<any, ApiResponse<{ version_number: number }>>(
    `/versions/restore/${versionId}`
  );
};

export const getSaveTypes = () => {
  return api.get<any, ApiResponse<SaveTypeOption[]>>(
    '/versions/save-types'
  );
};

export const previewRestoreVersion = (declarationId: number, versionNumber: number) => {
  return api.get<any, ApiResponse<RestorePreviewResult>>(
    `/versions/${declarationId}/preview-restore/${versionNumber}`
  );
};
