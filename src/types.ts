export type ApplicationStatus = 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Wishlist' | 'Withdrawn';

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  applied_date: string;
  url: string;
  location: string;
  salary: string;
  notes: string;
  pdf_data?: string;
  version: number;
  is_deleted: number; // 0 or 1
  updated_at: number; // timestamp
  created_at: string;
}

export interface NewApplication {
  company: string;
  position: string;
  status: ApplicationStatus;
  applied_date: string;
  url?: string;
  location?: string;
  salary?: string;
  notes?: string;
  pdf_data?: string;
}

export interface SyncRequest {
  last_sync_version: number;
  changes: JobApplication[];
}

export interface SyncResponse {
  server_version: number;
  changes: JobApplication[];
}
