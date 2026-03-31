import { Post } from './posts';

export interface Company {
  id: string; // uuid
  name: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  contact_email: string | null;
  industry: string | null;
  size: string | null; // e.g., "1-10", "11-50", "51-200", "201-500", "500+"
  founded_year: number | null;
  location: string | null;
  user_id: string; // compatibility owner field
  owner_id?: string | null; // current backend owner field
  status: "pending" | "approved" | "rejected" | "verified";
  verification_status?: "pending" | "verified" | "rejected" | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  posts?: Post[]; // Optional posts array
}

export interface CompanyFormData {
  name: string;
  description: string;
  website: string;
  contact_email: string;
  industry: string;
  size: string;
  founded_year: string;
  location: string;
}

export interface CompanySize {
  value: string;
  label: string;
}

export const COMPANY_SIZES: CompanySize[] = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
]; 
