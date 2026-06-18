export interface Guideline {
  id: number;
  title: string;
  content: string;
  category: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Declaration {
  id: number;
  title: string;
  guideline_id: number | null;
  guideline_title?: string;
  guideline_content?: string;
  applicant: string;
  company: string;
  phone: string;
  email: string;
  content: string;
  status: string;
  current_step: number;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  declaration_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

export interface ApprovalRecord {
  id: number;
  declaration_id: number;
  step: number;
  step_name?: string;
  approver: string;
  action: string;
  comment: string;
  created_at: string;
}

export interface WorkflowStep {
  id: number;
  name: string;
  description: string;
  step_order: number;
  role: string;
}

export interface OperationLog {
  id: number;
  user: string;
  action: string;
  module: string;
  target_id: number | null;
  detail: string;
  ip: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export const StatusMap: Record<string, string> = {
  draft: '草稿',
  submitted: '待初审',
  reviewing: '初审中',
  first_reviewed: '待复审',
  second_reviewed: '待终审',
  approved: '已立项',
  rejected: '已驳回'
};

export const StatusColorMap: Record<string, string> = {
  draft: 'default',
  submitted: 'blue',
  reviewing: 'cyan',
  first_reviewed: 'purple',
  second_reviewed: 'orange',
  approved: 'green',
  rejected: 'red'
};
