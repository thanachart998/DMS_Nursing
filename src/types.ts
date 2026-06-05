import { Timestamp } from 'firebase/firestore';

export type DocType = 'incoming' | 'outgoing' | 'appointment';
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
  status: 'pending' | 'received' | 'dispatched' | 'archived' | 'cancelled';
  receive_no?: string;
  file_url?: string;
  responsible_person?: string;
  created_at: any;
  updated_at: any;
  owner_id: string;
}

export interface MouRecord {
  id?: string;
  academic_year: string;
  agency: string;
  signature_date: string;
  title: string;
  file_url?: string;
  status: 'pending' | 'received' | 'dispatched' | 'archived' | 'cancelled';
  created_at: any;
  updated_at: any;
  owner_id: string;
}

export interface PetitionRecord {
  id?: string;
  topic: 'ลาออก' | 'พักการเรียน';
  applicant_status: 'นักศึกษา' | 'อาจารย์';
  first_name: string;
  last_name: string;
  identifier: string; // รหัสนักศึกษา/รหัสพนักงาน
  academic_year: string;
  date_issued: string;
  file_url?: string;
  created_at: any;
  updated_at: any;
  owner_id: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'lecturer' | 'guest';
  createdAt: any;
}
