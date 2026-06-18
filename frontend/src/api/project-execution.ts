import request from './request';
import type {
  ProjectPhase,
  ProjectPhaseInstance,
  ProjectProgressLog,
  PhaseDeliverable,
  DeliverableAttachment,
  AcceptanceNode,
  AcceptanceRecord,
  ProjectExecutionSummary,
  ProjectPhasesResponse,
  ApiResponse
} from '../types';

export const projectExecutionApi = {
  getPhaseTemplates: (guidelineId?: number): Promise<ApiResponse<ProjectPhase[]>> => {
    const params = guidelineId ? `?guideline_id=${guidelineId}` : '';
    return request.get(`/project-execution/phases/templates${params}`);
  },

  getPhases: (declarationId: number): Promise<ApiResponse<ProjectPhasesResponse>> => {
    return request.get(`/project-execution/${declarationId}/phases`);
  },

  initializePhases: (declarationId: number): Promise<ApiResponse<null>> => {
    return request.post(`/project-execution/${declarationId}/phases/initialize`);
  },

  updatePhase: (
    phaseId: number,
    data: {
      status?: string;
      progress?: number;
      start_date?: string;
      planned_end_date?: string;
      actual_end_date?: string;
      responsible_person?: string;
      remarks?: string;
      update_note?: string;
    }
  ): Promise<ApiResponse<ProjectPhaseInstance>> => {
    return request.put(`/project-execution/phases/${phaseId}`, data);
  },

  updateProgress: (
    declarationId: number,
    data: {
      phase_instance_id?: number;
      progress_value: number;
      update_note?: string;
    }
  ): Promise<ApiResponse<null>> => {
    return request.post(`/project-execution/${declarationId}/progress`, data);
  },

  getProgressLogs: (
    declarationId: number,
    phaseInstanceId?: number,
    page = 1,
    pageSize = 50
  ): Promise<ApiResponse<ProjectProgressLog[]>> => {
    let params = `?page=${page}&pageSize=${pageSize}`;
    if (phaseInstanceId) params += `&phase_instance_id=${phaseInstanceId}`;
    return request.get(`/project-execution/${declarationId}/progress/logs${params}`);
  },

  getDeliverables: (phaseId: number): Promise<ApiResponse<PhaseDeliverable[]>> => {
    return request.get(`/project-execution/phases/${phaseId}/deliverables`);
  },

  addDeliverable: (
    phaseId: number,
    data: {
      name: string;
      description?: string;
      required?: number;
      sort_order?: number;
    }
  ): Promise<ApiResponse<{ id: number }>> => {
    return request.post(`/project-execution/phases/${phaseId}/deliverables`, data);
  },

  deleteDeliverable: (deliverableId: number): Promise<ApiResponse<null>> => {
    return request.delete(`/project-execution/deliverables/${deliverableId}`);
  },

  uploadDeliverableAttachments: (
    deliverableId: number,
    files: File[],
    remark?: string
  ): Promise<ApiResponse<Array<{ id: number; original_name: string }>>> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (remark) formData.append('remark', remark);
    return request.post(`/project-execution/deliverables/${deliverableId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  downloadAttachment: (attachmentId: number): string => {
    return `/api/project-execution/attachments/${attachmentId}/download`;
  },

  deleteAttachment: (attachmentId: number): Promise<ApiResponse<null>> => {
    return request.delete(`/project-execution/attachments/${attachmentId}`);
  },

  getAcceptanceNodes: (declarationId: number): Promise<ApiResponse<AcceptanceNode[]>> => {
    return request.get(`/project-execution/${declarationId}/acceptance-nodes`);
  },

  addAcceptanceNode: (
    declarationId: number,
    data: {
      phase_instance_id?: number;
      node_name: string;
      node_type?: string;
      description?: string;
      planned_date?: string;
      acceptance_criteria?: string;
    }
  ): Promise<ApiResponse<{ id: number }>> => {
    return request.post(`/project-execution/${declarationId}/acceptance-nodes`, data);
  },

  updateAcceptanceNode: (
    nodeId: number,
    data: {
      node_name?: string;
      description?: string;
      planned_date?: string;
      actual_date?: string;
      status?: string;
      acceptance_criteria?: string;
    }
  ): Promise<ApiResponse<AcceptanceNode>> => {
    return request.put(`/project-execution/acceptance-nodes/${nodeId}`, data);
  },

  submitAcceptanceRecord: (
    nodeId: number,
    data: {
      result: string;
      score?: number;
      comment?: string;
      issues_found?: string;
      suggestions?: string;
    }
  ): Promise<ApiResponse<{ id: number }>> => {
    return request.post(`/project-execution/acceptance-nodes/${nodeId}/records`, data);
  },

  getSummary: (declarationId: number): Promise<ApiResponse<ProjectExecutionSummary>> => {
    return request.get(`/project-execution/${declarationId}/summary`);
  }
};

export default projectExecutionApi;
