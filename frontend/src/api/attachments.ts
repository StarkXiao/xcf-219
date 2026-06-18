import api from './request';
import type { Attachment, ApiResponse } from '../types';

export const getAttachments = (declarationId: number) => {
  return api.get<any, ApiResponse<Attachment[]>>(`/attachments/declaration/${declarationId}`);
};

export const uploadAttachments = (declarationId: number, files: File[]) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  return api.post<any, ApiResponse<Attachment[]>>(`/attachments/declaration/${declarationId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const downloadAttachment = (id: number) => {
  return `/api/attachments/${id}/download`;
};

export const deleteAttachment = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/attachments/${id}`);
};
