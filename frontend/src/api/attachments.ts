import api from './request';
import type { Attachment, MissingCheckResult, DuplicatesResult, UploadResultData, ApiResponse } from '../types';

export const getAttachments = (declarationId: number) => {
  return api.get<any, ApiResponse<Attachment[]>>('/attachments', {
    params: { declaration_id: declarationId }
  });
};

export const getAttachment = (id: number) => {
  return api.get<any, ApiResponse<Attachment>>(`/attachments/${id}`);
};

export const uploadAttachments = (declarationId: number, files: File[]) => {
  const formData = new FormData();
  formData.append('declaration_id', String(declarationId));
  files.forEach(file => {
    formData.append('files', file);
  });
  return api.post<any, ApiResponse<UploadResultData>>('/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteAttachment = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/attachments/${id}`);
};

export const downloadAttachment = (id: number) => {
  return `/api/attachments/${id}/download`;
};

export const getMissingCheck = (declarationId: number) => {
  return api.get<any, ApiResponse<MissingCheckResult>>(
    `/attachments/missing-check/${declarationId}`
  );
};

export const getDuplicates = (declarationId: number) => {
  return api.get<any, ApiResponse<DuplicatesResult>>(
    `/attachments/duplicates/${declarationId}`
  );
};

export const batchDownloadAttachments = (declarationId: number) => {
  return `/api/attachments/batch-download/${declarationId}`;
};

export const validateFiles = (declarationId: number, files: File[]) => {
  const formData = new FormData();
  formData.append('declaration_id', String(declarationId));
  files.forEach(file => {
    formData.append('files', file);
  });
  return api.post<any, ApiResponse<any>>('/attachments/validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
