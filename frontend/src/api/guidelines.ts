import api from './request';
import type { Guideline, ApiResponse, GuidelineRelated, DeclarationTemplate, Faq, HistoryCase, MaterialType } from '../types';

export const getGuidelines = (params?: { category?: string; keyword?: string }) => {
  return api.get<any, ApiResponse<Guideline[]>>('/guidelines', { params });
};

export const getGuideline = (id: number) => {
  return api.get<any, ApiResponse<Guideline>>(`/guidelines/${id}`);
};

export const getGuidelineRelated = (id: number) => {
  return api.get<any, ApiResponse<GuidelineRelated>>(`/guidelines/${id}/related`);
};

export const createGuideline = (data: Partial<Guideline>) => {
  return api.post<any, ApiResponse<{ id: number }>>('/guidelines', data);
};

export const updateGuideline = (id: number, data: Partial<Guideline>) => {
  return api.put<any, ApiResponse<void>>(`/guidelines/${id}`, data);
};

export const deleteGuideline = (id: number) => {
  return api.delete<any, ApiResponse<void>>(`/guidelines/${id}`);
};

export const getGuidelineTemplates = (guidelineId: number) => {
  return api.get<any, ApiResponse<DeclarationTemplate[]>>(`/guidelines/${guidelineId}/templates`);
};

export const createGuidelineTemplate = (guidelineId: number, data: Partial<DeclarationTemplate>) => {
  return api.post<any, ApiResponse<{ id: number }>>(`/guidelines/${guidelineId}/templates`, data);
};

export const updateGuidelineTemplate = (templateId: number, data: Partial<DeclarationTemplate>) => {
  return api.put<any, ApiResponse<void>>(`/guidelines/templates/${templateId}`, data);
};

export const deleteGuidelineTemplate = (templateId: number) => {
  return api.delete<any, ApiResponse<void>>(`/guidelines/templates/${templateId}`);
};

export const getGuidelineFaqs = (guidelineId: number) => {
  return api.get<any, ApiResponse<Faq[]>>(`/guidelines/${guidelineId}/faqs`);
};

export const createGuidelineFaq = (guidelineId: number, data: Partial<Faq>) => {
  return api.post<any, ApiResponse<{ id: number }>>(`/guidelines/${guidelineId}/faqs`, data);
};

export const updateGuidelineFaq = (faqId: number, data: Partial<Faq>) => {
  return api.put<any, ApiResponse<void>>(`/guidelines/faqs/${faqId}`, data);
};

export const deleteGuidelineFaq = (faqId: number) => {
  return api.delete<any, ApiResponse<void>>(`/guidelines/faqs/${faqId}`);
};

export const getGuidelineMaterials = (guidelineId: number) => {
  return api.get<any, ApiResponse<MaterialType[]>>(`/guidelines/${guidelineId}/materials`);
};

export const getGuidelineCases = (guidelineId: number, limit?: number) => {
  return api.get<any, ApiResponse<HistoryCase[]>>(`/guidelines/${guidelineId}/cases`, { params: { limit } });
};
