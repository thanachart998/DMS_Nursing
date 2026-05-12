import { Timestamp } from 'firebase/firestore';

export type DocType = 'incoming' | 'outgoing';
export type DocSubtype = 'internal' | 'external';

export interface DocumentRecord {
  id?: string;
  doc_type: DocType;
  doc_subtype: DocSubtype;
  doc_no: string;
  title: string;
  sender: string;
  receiver: string;
  date_issued: any; // Date or Timestamp
  category: string;
  academic_year: string;
  status: 'pending' | 'received' | 'dispatched' | 'archived';
  file_url?: string;
  created_at: any;
  updated_at: any;
  owner_id: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff' | 'general';
  createdAt: any;
}
