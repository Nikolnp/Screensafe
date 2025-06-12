import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  event_type: 'meeting' | 'appointment' | 'task' | 'reminder' | 'personal';
  color: string;
  is_all_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  remind_at: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  status: 'active' | 'snoozed' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  icon: string;
  category: 'productivity' | 'consistency' | 'goals' | 'general';
  points: number;
  unlocked_at: string;
  progress: number;
  max_progress: number;
  is_unlocked: boolean;
  created_at: string;
}

export interface ExtractedData {
  id: string;
  user_id: string;
  source_file_url?: string;
  extraction_type: 'ocr' | 'image_analysis' | 'document_parsing';
  raw_data: any;
  processed_data: any;
  confidence_score: number;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}