export interface AssetResponse {
  id: string;
  kind: string;
  mime_type: string;
  access_url: string;
}

export interface RoomRevisionResponse {
  id: string;
  revision_number: number;
  source: string;
  scene_json: Record<string, unknown>;
  summary_json: {
    checklist: Array<{ type: string; text: string }>;
    issue_count: number;
    praise_count: number;
    location_name: string;
    location_specified: boolean;
  };
  raw_asset: AssetResponse;
  rendered_asset: AssetResponse;
  created_at: string;
}

export interface RoomResponse {
  id: string;
  sequence_number: number;
  room_name: string;
  room_name_source: string;
  supervisor_note: string;
  status: "processing" | "needs_review" | "approved" | "failed";
  processing_error?: string | null;
  approval_status: "pending" | "approved";
  approved_at?: string | null;
  latest_revision?: RoomRevisionResponse | null;
  approved_revision?: RoomRevisionResponse | null;
  created_at: string;
  updated_at: string;
}

export interface ReportResponse {
  id: string;
  version_number: number;
  status: string;
  pdf_asset?: AssetResponse | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobResponse {
  id: string;
  status: string;
  source_channel: string;
  site_name: string;
  site_address?: string | null;
  cleaner_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  rooms: RoomResponse[];
  messages: Array<{
    id: string;
    direction: string;
    message_type: string;
    body?: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  latest_report?: ReportResponse | null;
}

export interface RecentJobResponse {
  id: string;
  site_name: string;
  site_address?: string | null;
  cleaner_name?: string | null;
  status: string;
  updated_at: string;
}

export interface SuggestedActionResponse {
  label: string;
  value: string;
}

export interface ChatMessageResponse {
  id: string;
  job_id?: string | null;
  direction: "assistant" | "user" | "system";
  message_type:
    | "assistant_text"
    | "user_text"
    | "system_event"
    | "room_created"
    | "room_needs_review"
    | "room_updated"
    | "room_approved"
    | "report_blocked"
    | "report_ready"
    | "job_switched"
    | "clarification_needed";
  body?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatSessionResponse {
  session_id: string;
  stage: string;
  draft_job_context: Record<string, unknown>;
  current_job?: JobResponse | null;
  messages: ChatMessageResponse[];
  suggested_actions: SuggestedActionResponse[];
}
