import api from './request';
import type { 
  Attachment, 
  ApiResponse, 
  MaterialType, 
  ValidationResult, 
  UploadResultData,
  MissingCheckResult,
  DuplicatesResult 
} from '../types';

export const getAttachments = (declarationId: number) => {
  return api.get<any, ApiResponse<Attachment[]>>(`/attachments/declaration/${declarationId}`);
};

export const getMaterialTypes = (guidelineId?: number) => {
  const params = guidelineId ? { guidelineId } : {};
  return api.get<any, ApiResponse<MaterialType[]>>('/attachments/material-types', { params });
};

export const createMaterialType = (data: Partial<MaterialType> & { name: string; code: string }) => {
  return api.post<any, ApiResponse<{ id: number }>>('/attachments/material-types', data);
};

export const updateMaterialType = (id: number, data: Partial<MaterialType>) => {
  return api.put<any, ApiResponse<void>>(`/attachments/material-types/${id}`, data);
};

export const deleteMaterialType = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/attachments/material-types/${id}`);
};

export const validateAttachments = (
  declarationId: number,
  files: { name: string; size: number; material_type_id?: number | null }[]
) => {
  return api.post<any, ApiResponse<ValidationResult>>(`/attachments/validate/${declarationId}`, { files });
};

export const uploadAttachments = (
  declarationId: number,
  files: File[],
  materialTypeIds: (number | null)[] = []
) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  formData.append('materialTypeIds', materialTypeIds.map(id => id ?? '').join(','));

  return api.post<any, ApiResponse<UploadResultData>>(
    `/attachments/declaration/${declarationId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
};

export const getMissingCheck = (declarationId: number) => {
  return api.get<any, ApiResponse<MissingCheckResult>>(`/attachments/${declarationId}/missing-check`);
};

export const getDuplicates = (declarationId: number) => {
  return api.get<any, ApiResponse<DuplicatesResult>>(`/attachments/${declarationId}/duplicates`);
};

export const downloadAttachment = (id: number) => {
  return `/api/attachments/${id}/download`;
};

export const batchDownloadAttachments = (declarationId: number, attachmentIds?: number[]) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `/api/attachments/${declarationId}/batch-download`;
  form.target = '_blank';

  if (attachmentIds && attachmentIds.length > 0) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'attachmentIds';
    input.value = JSON.stringify(attachmentIds);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

export const batchDownloadAttachmentsBlob = async (declarationId: number, attachmentIds?: number[]) => {
  const response = await api.post<any, Blob>(
    `/attachments/${declarationId}/batch-download`,
    { attachmentIds: attachmentIds || [] },
    { responseType: 'blob' }
  );
  return response;
};

export const updateAttachmentMaterialType = (id: number, materialTypeId: number | null) => {
  return api.put<any, ApiResponse<void>>(`/attachments/${id}/material-type`, {
    material_type_id: materialTypeId
  });
};

export const deleteAttachment = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/attachments/${id}`);
};
