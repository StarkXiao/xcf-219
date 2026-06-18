import api from './request';
import type { WorkflowStep, ApprovalRecord, ApiResponse } from '../types';

export const getWorkflowSteps = () => {
  return api.get<any, ApiResponse<WorkflowStep[]>>('/workflow/steps');
};

export const getStatusOptions = () => {
  return api.get<any, ApiResponse<{ value: string; label: string }[]>>('/workflow/status-options');
};

export const getApprovalHistory = (declarationId: number) => {
  return api.get<any, ApiResponse<ApprovalRecord[]>>(`/workflow/declaration/${declarationId}/history`);
};

export const approveDeclaration = (declarationId: number, data: { approver: string; comment?: string; step?: number }) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/workflow/declaration/${declarationId}/approve`, data);
};

export const rejectDeclaration = (declarationId: number, data: { approver: string; comment?: string; step?: number }) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/workflow/declaration/${declarationId}/reject`, data);
};

export const rollbackDeclaration = (declarationId: number, data: { approver: string; comment?: string; target_step?: number }) => {
  return api.post<any, ApiResponse<{ status: string }>>(`/workflow/declaration/${declarationId}/rollback`, data);
};
