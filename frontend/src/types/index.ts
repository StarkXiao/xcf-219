export interface Guideline {
  id: number;
  title: string;
  content: string;
  category: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeclarationTemplate {
  id: number;
  guideline_id: number;
  title: string;
  content: string;
  description: string;
  sort_order: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface Faq {
  id: number;
  guideline_id: number;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HistoryCase {
  id: number;
  title: string;
  applicant: string;
  company: string;
  content: string;
  status: string;
  created_at: string;
  updated_at?: string;
  attachment_count?: number;
  approval_count?: number;
}

export interface GuidelineStats {
  total_declarations: number;
  approved_count: number;
  pending_count: number;
  template_count: number;
  faq_count: number;
  approval_rate: number;
}

export interface GuidelineRelated {
  guideline: Guideline;
  templates: DeclarationTemplate[];
  materials: MaterialType[];
  history_cases: HistoryCase[];
  faqs: Faq[];
  stats: GuidelineStats;
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
  workflow_config_id?: number | null;
  current_step_name?: string | null;
  current_step_role?: string | null;
  status_label?: string;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  is_deleted?: number;
  deleted_at?: string | null;
  last_auto_save_at?: string | null;
  version_count?: number;
  is_in_recycle_bin?: boolean;
  is_followed?: number;
  resubmit_count?: number;
  last_rejected_at?: string | null;
  last_reject_reason?: string | null;
}

export interface DeclarationResubmission {
  id: number;
  declaration_id: number;
  resubmit_count: number;
  supplement_note: string;
  created_by: string | null;
  created_at: string;
}

export interface SavedFilter {
  id: number;
  name: string;
  module: string;
  filter_data: Record<string, any>;
  user?: string | null;
  is_default: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BatchCheckResult {
  id: number;
  title: string;
  score: number;
  total_checks: number;
  passed_checks: number;
  can_submit: boolean;
  high_risk_count: number;
  medium_risk_count: number;
  risks: Array<{ id: string; level: string; title: string }>;
}

export interface BatchSubmitResult {
  success: Array<{ id: number; title: string }>;
  failed: Array<{ id: number; title: string; reason: string }>;
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

export interface MaterialType {
  id: number;
  guideline_id: number | null;
  name: string;
  code: string;
  description: string;
  required: boolean;
  allowed_extensions: string[];
  max_size: number;
  sort_order: number;
  created_at: string;
  uploaded?: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  declaration_id: number;
  material_type_id: number | null;
  material_type_name?: string | null;
  material_type_code?: string | null;
  material_type_required?: boolean;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  file_hash?: string | null;
  uploaded_at: string;
}

export interface ValidationFileResult {
  name: string;
  size: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  material_type_id: number | null;
  material_type_name: string | null;
}

export interface ValidationResult {
  valid: boolean;
  results: ValidationFileResult[];
}

export interface UploadResultData {
  attachments: Attachment[];
  warnings: string[];
  duplicates: {
    new_file: string;
    existing_file: string;
    existing_id: number;
    material_type_name: string | null;
  }[];
  uploadedCount: number;
  duplicateCount: number;
}

export interface MissingCheckStats {
  total_types: number;
  required_total: number;
  required_complete: number;
  required_missing: number;
  optional_total: number;
  optional_complete: number;
  attachments_total: number;
  uncategorized_count: number;
  completion_rate: number;
  is_complete: boolean;
}

export interface MissingCheckResult {
  missing: MaterialType[];
  complete: MaterialType[];
  unnecessary: MaterialType[];
  uncategorized: Attachment[];
  stats: MissingCheckStats;
}

export interface DuplicateGroup {
  groups: Attachment[][];
  group_count: number;
  duplicate_count: number;
}

export interface DuplicatesResult {
  total_attachments: number;
  exact_duplicates: DuplicateGroup;
  potential_duplicates: DuplicateGroup;
}

export interface ApprovalReasonCategory {
  id: number;
  action_type: 'approve' | 'reject' | 'rollback';
  code: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRecord {
  id: number;
  declaration_id: number;
  step: number;
  step_name?: string;
  step_role?: string;
  approver: string;
  action: string;
  comment: string;
  reason_category?: string;
  created_at: string;
}

export interface WorkflowStep {
  id: number;
  name: string;
  description: string;
  step_order: number;
  role: string;
}

export interface WorkflowConfigStep {
  id?: number;
  config_id?: number;
  name: string;
  step_key: string;
  role: string;
  step_order: number;
  pending_status: string;
  approved_status: string;
  allow_rollback: boolean;
  rollback_targets: number[];
  description?: string;
  expected_duration?: number;
  responsible_person?: string;
  created_at?: string;
}

export interface WorkflowConfig {
  id: number;
  guideline_id: number | null;
  guideline_title?: string;
  name: string;
  description: string;
  steps: WorkflowConfigStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowInfo {
  config: { id: number | null; name: string };
  current_step: WorkflowConfigStep | null;
  steps: WorkflowConfigStep[];
  rollback_options: Array<{
    step_order: number;
    name: string;
    status: string;
  }>;
}

export interface WorkflowRoleOption {
  value: string;
  label: string;
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
  rejected: '已驳回',
  completed: '已完成'
};

export const StatusColorMap: Record<string, string> = {
  draft: 'default',
  submitted: 'blue',
  reviewing: 'cyan',
  first_reviewed: 'purple',
  second_reviewed: 'orange',
  approved: 'green',
  rejected: 'red',
  completed: 'success'
};

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';

export interface ProjectPhaseInstance {
  id: number;
  declaration_id: number;
  phase_id: number | null;
  phase_name: string;
  phase_code: string | null;
  phase_description: string | null;
  sort_order: number;
  status: PhaseStatus;
  progress: number;
  start_date: string | null;
  planned_end_date: string | null;
  actual_end_date: string | null;
  expected_duration: number;
  responsible_person: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  deliverable_count?: number;
  submitted_deliverable_count?: number;
  acceptance_count?: number;
  passed_acceptance_count?: number;
}

export const PhaseStatusMap: Record<PhaseStatus, string> = {
  pending: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  delayed: '已延期'
};

export const PhaseStatusColorMap: Record<PhaseStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  delayed: 'warning'
};

export type DeliverableStatus = 'pending' | 'submitted' | 'reviewing' | 'approved' | 'rejected';

export interface PhaseDeliverable {
  id: number;
  phase_instance_id: number;
  name: string;
  description: string | null;
  required: number;
  sort_order: number;
  submitted: number;
  submitted_at: string | null;
  submitted_by: string | null;
  status: DeliverableStatus;
  remark: string | null;
  created_at: string;
  updated_at: string;
  attachment_count?: number;
}

export const DeliverableStatusMap: Record<DeliverableStatus, string> = {
  pending: '待提交',
  submitted: '已提交',
  reviewing: '审核中',
  approved: '已通过',
  rejected: '已驳回'
};

export const DeliverableStatusColorMap: Record<DeliverableStatus, string> = {
  pending: 'default',
  submitted: 'processing',
  reviewing: 'blue',
  approved: 'success',
  rejected: 'error'
};

export interface DeliverableAttachment {
  id: number;
  deliverable_id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string | null;
  remark: string | null;
  created_at: string;
}

export type AcceptanceStatus = 'pending' | 'submitted' | 'passed' | 'failed' | 'reviewing';

export interface AcceptanceNode {
  id: number;
  phase_instance_id: number;
  name: string;
  description: string | null;
  sort_order: number;
  status: AcceptanceStatus;
  acceptance_date: string | null;
  accepted_by: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  record_count?: number;
}

export const AcceptanceStatusMap: Record<AcceptanceStatus, string> = {
  pending: '待验收',
  submitted: '已提交',
  reviewing: '验收中',
  passed: '已通过',
  failed: '未通过'
};

export const AcceptanceStatusColorMap: Record<AcceptanceStatus, string> = {
  pending: 'default',
  submitted: 'processing',
  reviewing: 'blue',
  passed: 'success',
  failed: 'error'
};

export interface AcceptanceRecord {
  id: number;
  acceptance_node_id: number;
  action: string;
  comment: string | null;
  operator: string | null;
  created_at: string;
}

export interface ProgressLog {
  id: number;
  declaration_id: number;
  phase_instance_id: number | null;
  progress_before: number;
  progress_after: number;
  status_before: string | null;
  status_after: string | null;
  update_note: string | null;
  updated_by: string | null;
  created_at: string;
}

export interface ProjectOverviewStats {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  delayed: number;
}

export interface DeliverableStats {
  total: number;
  submitted: number;
  completion_rate: number;
}

export interface AcceptanceStats {
  total: number;
  passed: number;
  pass_rate: number;
}

export interface ProjectExecutionOverview {
  declaration: {
    id: number;
    title: string;
    status: string;
  };
  overall_progress: number;
  phase_stats: ProjectOverviewStats;
  deliverable_stats: DeliverableStats;
  acceptance_stats: AcceptanceStats;
  latest_progress_log: ProgressLog | null;
  phases: ProjectPhaseInstance[];
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

export type RiskLevel = 'high' | 'medium' | 'low' | 'info';

export interface RiskItem {
  id: string;
  level: RiskLevel;
  category: 'guideline' | 'company' | 'history' | 'material';
  title: string;
  description: string;
  suggestion?: string;
}

export interface QualificationCheckResult {
  overall_risk: RiskLevel;
  score: number;
  total_checks: number;
  passed_checks: number;
  risks: RiskItem[];
  summary: string;
  can_submit: boolean;
  company_history?: {
    total_declarations: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
    approval_rate: number;
    last_declaration_at?: string;
  };
  guideline_info?: {
    id: number;
    title: string;
    category: string;
    deadline?: string;
    days_remaining?: number;
  };
}

export interface TodoKanbanRoleOption {
  value: string;
  label: string;
}

export interface TodoKanbanRoleCounts {
  pending_initial: number;
  pending_re: number;
  timeout: number;
  upcoming: number;
}

export interface TodoKanbanDeclaration extends Declaration {
  step_role?: string;
  step_name?: string;
  timeout_days?: number;
}

export interface TodoKanbanDeadline {
  id: number;
  title: string;
  category: string;
  deadline: string;
  days_remaining: number;
  related_count: number;
  draft_count: number;
  is_overdue: boolean;
  is_urgent: boolean;
}

export interface TodoKanbanSummary {
  current_role: string;
  role_options: TodoKanbanRoleOption[];
  counts_by_role: Record<string, TodoKanbanRoleCounts>;
  pending_initial_review: TodoKanbanDeclaration[];
  pending_initial_review_count: number;
  pending_re_review: TodoKanbanDeclaration[];
  pending_re_review_count: number;
  timeout_declarations: TodoKanbanDeclaration[];
  timeout_declarations_count: number;
  upcoming_deadlines: TodoKanbanDeadline[];
  upcoming_deadlines_count: number;
}

export interface EnterpriseProfile {
  id: number;
  company_name: string;
  applicant: string;
  phone: string;
  email: string;
  address?: string;
  business_scope?: string;
  contact_person?: string;
  declaration_count: number;
  last_declaration_at?: string;
  created_at: string;
  updated_at: string;
  recent_declarations?: Array<{
    id: number;
    title: string;
    status: string;
    created_at: string;
  }>;
}
