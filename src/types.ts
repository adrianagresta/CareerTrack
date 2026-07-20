export type ApplicationStatus = 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Wishlist' | 'Withdrawn';
export type LocationType = 'OnSite' | 'Hybrid' | 'Remote';
export type InterviewType = 'Phone Screen' | 'Recruiter Screen' | 'Technical' | 'OnSite' | 'Panel' | 'Final';

export interface Interview {
  id: string;
  application_id: string;
  date: string;
  time: string;
  type: InterviewType;
  duration: number;
  notes: string;
  version: number;
  updated_at: number;
  created_at: number;
}

export interface NewInterview {
  application_id: string;
  date: string;
  time: string;
  type: InterviewType;
  duration: number;
  notes: string;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  status_date: string;
  url: string;
  location: string;
  location_type?: LocationType;
  salary: string;
  salary_min?: number;
  salary_max?: number;
  desired_salary_min?: number;
  desired_salary_max?: number;
  notes: string;
  pdf_data?: string;
  version: number;
  is_deleted: number; // 0 or 1
  dirty: number; // 0 or 1 - indicates local changes need syncing
  updated_at: number; // timestamp
  created_at: string;
  interviews?: Interview[];
}

export interface NewApplication {
  company: string;
  position: string;
  status: ApplicationStatus;
  status_date: string;
  url?: string;
  location?: string;
  location_type?: LocationType;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  desired_salary_min?: number;
  desired_salary_max?: number;
  notes?: string;
  pdf_data?: string;
}

export interface SyncRequest {
  last_sync_version: number;
  changes: JobApplication[];
  interview_changes?: Interview[];
}

export interface SyncResponse {
  server_version: number;
  changes: JobApplication[];
  interview_changes?: Interview[];
  dirty_ids?: string[];
}

export interface PushResponse {
  success: boolean;
  id: string;
}
