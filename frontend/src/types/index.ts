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
  is_deleted?: number;
  deleted_at?: string | null;
  last_auto_save_at?: string | null;
  version_count?: number;
  is_in_recycle_bin?: boolean;
}

export type SaveType = 'auto' | 'manual' | 'submit' | 'status_change' | 'rollback' | 'restore';

export interface DeclarationVersion {
  id: number;
  declaration_id: number;
  version_number: number;
  title: string;
  guideline_id: number | null;
  applicant: string;
  company: string;
  phone: string;
  email: string;
  content: string;
  status: string;
  current_step: number;
  save_type: SaveType;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
  snapshot_json?: string;
  snapshot?: DeclarationSnapshot;
  reverse_number?: number;
  current_title?: string;
  current_status?: string;
}

export interface DeclarationSnapshot {
  title: string;
  guideline_id: number | null;
  applicant: string;
  company: string;
  phone: string;
  email: string;
  content: string;
  status: string;
  current_step: number;
}

export interface LineDiff {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  line_number_before: number | null;
  line_number_after: number | null;
}

export interface FieldDiff {
  field: string;
  field_label: string;
  before: any;
  after: any;
  line_diff: {
    added: number;
    removed: number;
    lines: LineDiff[];
  };
  char_change_count: number;
}

export interface DiffResult {
  has_changes: boolean;
  changed_fields: string[];
  changes: FieldDiff[];
  summary: string;
}

export interface DiffCompareResult {
  declaration_id: number;
  before: {
    label: string;
    version_number: number | null;
    saved_at: string;
    saved_by: string | null;
    save_type: string;
  };
  after: {
    label: string;
    version_number: number | null;
    saved_at: string;
    saved_by: string | null;
    save_type: string;
  };
  diff: DiffResult;
}

export interface VersionsListResponse {
  declaration_id: number;
  declaration_title: string;
  latest_version: number;
  list: DeclarationVersion[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SaveTypeOption {
  value: SaveType;
  label: string;
  color: string;
  icon: string;
}

export interface RestorePreviewResult {
  current_version: number;
  target_version: number;
  target_created_at: string;
  target_created_by: string | null;
  diff: DiffResult;
}

export interface RecycleBinItem {
  id: number;
  title: string;
  applicant: string;
  company: string;
  phone: string;
  email: string;
  content: string;
  status: string;
  current_step: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  deleted_by?: string | null;
  last_auto_save_at?: string | null;
  version_count?: number;
  guideline_id?: number | null;
  guideline_title?: string;
  is_deleted?: number;
}

export interface RecycleBinListResponse {
  list: RecycleBinItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeclarationStats {
  total: number;
  draft: number;
  in_progress: number;
  approved: number;
  rejected: number;
  deleted: number;
  total_versions: number;
}

export interface OperationTimelineEvent {
  id: number;
  user: string;
  action: string;
  module: string;
  target_id: number;
  detail: string;
  version_number: number | null;
  created_at: string;
  timestamp: string;
  event_type: 'version' | 'workflow' | 'declaration';
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
  version_number?: number | null;
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
