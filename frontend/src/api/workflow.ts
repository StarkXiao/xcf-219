import api from './request';
import type { WorkflowStep, ApprovalRecord, ApiResponse, WorkflowInfo, WorkflowConfig, WorkflowRoleOption, ApprovalReasonCategory } from '../types';

export const getWorkflowSteps = () => {
  return api.get<any, ApiResponse<WorkflowStep[]>>('/workflow/steps');
};

export const getStatusOptions = () => {
  return api.get<any, ApiResponse<{ value: string; label: string }[]>>('/workflow/status-options');
};

export const getApprovalReasonCategories = (actionType?: 'approve' | 'reject' | 'rollback') => {
  const params = actionType ? { action_type: actionType } : {};
  return api.get<any, ApiResponse<ApprovalReasonCategory[]>>('/workflow/reason-categories', { params });
};

export const getApprovalHistory = (declarationId: number) => {
  return api.get<any, ApiResponse<ApprovalRecord[]>>(`/workflow/declaration/${declarationId}/history`);
};

export const getWorkflowInfo = (declarationId: number) => {
  return api.get<any, ApiResponse<WorkflowInfo>>(`/workflow/declaration/${declarationId}/workflow-info`);
};

export const approveDeclaration = (declarationId: number, data: { approver: string; comment: string; reason_category: string; step?: number }) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/workflow/declaration/${declarationId}/approve`, data);
};

export const rejectDeclaration = (declarationId: number, data: { approver: string; comment: string; reason_category: string; step?: number }) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/workflow/declaration/${declarationId}/reject`, data);
};

export const rollbackDeclaration = (declarationId: number, data: { approver: string; comment: string; reason_category: string; target_step?: number }) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/workflow/declaration/${declarationId}/rollback`, data);
};

export const getWorkflowConfigs = () => {
  return api.get<any, ApiResponse<WorkflowConfig[]>>('/workflow-configs');
};

export const getWorkflowConfigByGuideline = (guidelineId: number) => {
  return api.get<any, ApiResponse<WorkflowConfig | null>>(`/workflow-configs/guideline/${guidelineId}`);
};

export const getWorkflowConfig = (id: number) => {
  return api.get<any, ApiResponse<WorkflowConfig>>(`/workflow-configs/${id}`);
};

export const createWorkflowConfig = (data: Partial<WorkflowConfig> & { steps: WorkflowConfig['steps'] }) => {
  return api.post<any, ApiResponse<WorkflowConfig>>('/workflow-configs', data);
};

export const updateWorkflowConfig = (id: number, data: Partial<WorkflowConfig> & { steps: WorkflowConfig['steps'] }) => {
  return api.put<any, ApiResponse<WorkflowConfig>>(`/workflow-configs/${id}`, data);
};

export const deleteWorkflowConfig = (id: number) => {
  return api.delete<any, ApiResponse<null>>(`/workflow-configs/${id}`);
};

export const getWorkflowRoles = () => {
  return api.get<any, ApiResponse<WorkflowRoleOption[]>>('/workflow-configs/roles/list');
};
