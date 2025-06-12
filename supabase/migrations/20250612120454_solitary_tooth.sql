/*
  # Dashboard PWA Database Schema

  1. New Tables
    - `users` - User profiles and preferences
    - `todos` - Todo items with priority and status
    - `events` - Calendar events and scheduling
    - `reminders` - Reminder notifications
    - `achievements` - User achievements and badges
    - `extracted_data` - OCR and data extraction results
    - `media_storage` - File and screenshot metadata

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Secure file storage policies

  3. Features
    - Real-time subscriptions
    - File upload handling
    - Achievement tracking system
    - Data extraction workflow
*/

-- Users table for profile management
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date timestamptz,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  event_type text DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'appointment', 'task', 'reminder', 'personal')),
  color text DEFAULT '#6366F1',
  is_all_day boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  remind_at timestamptz NOT NULL,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'snoozed', 'completed', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon text DEFAULT 'trophy',
  category text DEFAULT 'general' CHECK (category IN ('productivity', 'consistency', 'goals', 'general')),
  points integer DEFAULT 0,
  unlocked_at timestamptz DEFAULT now(),
  progress integer DEFAULT 100,
  max_progress integer DEFAULT 100,
  is_unlocked boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Extracted data table for OCR and data processing
CREATE TABLE IF NOT EXISTS extracted_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  source_file_url text,
  extraction_type text DEFAULT 'ocr' CHECK (extraction_type IN ('ocr', 'image_analysis', 'document_parsing')),
  raw_data jsonb DEFAULT '{}',
  processed_data jsonb DEFAULT '{}',
  confidence_score float DEFAULT 0,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Media storage metadata
CREATE TABLE IF NOT EXISTS media_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer DEFAULT 0,
  storage_path text NOT NULL,
  public_url text,
  metadata jsonb DEFAULT '{}',
  uploaded_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_storage ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Todos policies
CREATE POLICY "Users can manage own todos"
  ON todos FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Events policies
CREATE POLICY "Users can manage own events"
  ON events FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Reminders policies
CREATE POLICY "Users can manage own reminders"
  ON reminders FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY "Users can manage own achievements"
  ON achievements FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Extracted data policies
CREATE POLICY "Users can manage own extracted data"
  ON extracted_data FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Media storage policies
CREATE POLICY "Users can manage own media"
  ON media_storage FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_data_user_id ON extracted_data(user_id);
CREATE INDEX IF NOT EXISTS idx_media_storage_user_id ON media_storage(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extracted_data_updated_at BEFORE UPDATE ON extracted_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();