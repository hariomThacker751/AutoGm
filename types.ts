export interface FormData {
  recipientName: string;
  recipientEmail: string;
  companyName: string;
  industry: string;
  keyPainPoint: string;
  senderName: string;
  senderCompany: string;
}

export type LeadStatus = 'idle' | 'generating' | 'sending' | 'sent' | 'error' | 'opened';

export interface ImportedLead extends FormData {
  id: string; // Unique ID for tracking
  status: LeadStatus;
  raw?: any;
}

export interface EmailResponse {
  subjectLine: string;
  emailBody: string;
  strategyExplanation: string;
}

// Email Tracking Types
export interface TrackingData {
  id: string;
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  subjectLine: string;
  senderName?: string;
  senderCompany?: string;
  sentAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  history: string[];
}

export interface DashboardStats {
  totalSent: number;
  totalOpened: number;
  totalOpens: number;
  openRate: number;
  followUpsSent?: number;
  leads: TrackingData[];
}

// Campaign Types
export interface Campaign {
  id: string;
  name: string;
  followUpIntervals: number[];
  createdAt: string;
  totalLeads: number;
  sentCount: number;
  openedCount: number;
}

export interface FollowUpItem {
  day: number;
  status: 'pending' | 'sent';
  sentAt: string | null;
  subjectLine?: string;
}

export interface PendingFollowUp {
  leadId: string;
  lead: TrackingData;
  followUpIndex: number;
  followUpNumber: number;
  dueDate: string;
}