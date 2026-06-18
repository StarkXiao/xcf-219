import api from './request';
import type {
  ApiResponse,
  ProjectPhaseInstance,
  PhaseDeliverable,
  DeliverableAttachment,
  AcceptanceNode,
  AcceptanceRecord,
  ProgressLog,
  ProjectExecutionOverview
} from '../types';

export const getProjectOverview = (declarationId: number) => {
  return api.get<any, ApiResponse<ProjectExecutionOverview>>(`/project-execution/${declarationId}/overview`);
};

export const getProjectPhases = (declarationId: number) => {
  return api.get<any, ApiResponse<ProjectPhaseInstance[]>>(`/project-execution/${declarationId}/phases`);
};

export const updatePhase = (
  phaseId: number,
  data: {
    status?: string;
    progress?: number;
    start_date?: string | null;
    planned_end_date?: string | null;
    actual_end_date?: string | null;
    responsible_person?: string | null;
    remarks?: string | null;
    update_note?: string;
  }
) => {
  return api.put<any, ApiResponse<ProjectPhaseInstance>>(`/project-execution/phases/${phaseId}`, data);
};

export const getPhaseDeliverables = (phaseId: number) => {
  return api.get<any, ApiResponse<PhaseDeliverable[]>>(`/project-execution/phases/${phaseId}/deliverables`);
};

export const addPhaseDeliverable = (
  phaseId: number,
  data: {
    name: string;
    description?: string;
    required?: boolean;
    sort_order?: number;
  }
) => {
  return api.post<any, ApiResponse<PhaseDeliverable>>(`/project-execution/phases/${phaseId}/deliverables`, data);
};

export const updateDeliverable = (
  deliverableId: number,
  data: {
    name?: string;
    description?: string | null;
    required?: boolean;
    sort_order?: number;
    status?: string;
    remark?: string | null;
  }
) => {
  return api.put<any, ApiResponse<PhaseDeliverable>>(`/project-execution/deliverables/${deliverableId}`, data);
};

export const deleteDeliverable = (deliverableId: number) => {
  return api.delete<any, ApiResponse<void>>(`/project-execution/deliverables/${deliverableId}`);
};

export const uploadDeliverableAttachments = (
  deliverableId: number,
  files: File[],
  remark?: string
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (remark) {
    formData.append('remark', remark);
  }
  return api.post<any, ApiResponse<Array<{ id: number; original_name: string; filename: string; file_size: number }>>>(
    `/project-execution/deliverables/${deliverableId}/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
};

export const getDeliverableAttachments = (deliverableId: number) => {
  return api.get<any, ApiResponse<DeliverableAttachment[]>>(`/project-execution/deliverables/${deliverableId}/attachments`);
};

export const getAttachmentDownloadUrl = (attachmentId: number): string => {
  return `/api/project-execution/attachments/${attachmentId}/download`;
};

export const deleteAttachment = (attachmentId: number) => {
  return api.delete<any, ApiResponse<void>>(`/project-execution/attachments/${attachmentId}`);
};

export const getAcceptanceNodes = (phaseId: number) => {
  return api.get<any, ApiResponse<AcceptanceNode[]>>(`/project-execution/phases/${phaseId}/acceptance-nodes`);
};

export const addAcceptanceNode = (
  phaseId: number,
  data: {
    name: string;
    description?: string;
    sort_order?: number;
  }
) => {
  return api.post<any, ApiResponse<AcceptanceNode>>(`/project-execution/phases/${phaseId}/acceptance-nodes`, data);
};

export const updateAcceptanceNode = (
  nodeId: number,
  data: {
    name?: string;
    description?: string | null;
    sort_order?: number;
    status?: string;
    comment?: string | null;
  }
) => {
  return api.put<any, ApiResponse<AcceptanceNode>>(`/project-execution/acceptance-nodes/${nodeId}`, data);
};

export const deleteAcceptanceNode = (nodeId: number) => {
  return api.delete<any, ApiResponse<void>>(`/project-execution/acceptance-nodes/${nodeId}`);
};

export const getAcceptanceRecords = (nodeId: number) => {
  return api.get<any, ApiResponse<AcceptanceRecord[]>>(`/project-execution/acceptance-nodes/${nodeId}/records`);
};

export const getProgressLogs = (declarationId: number) => {
  return api.get<any, ApiResponse<ProgressLog[]>>(`/project-execution/${declarationId}/progress-logs`);
};
