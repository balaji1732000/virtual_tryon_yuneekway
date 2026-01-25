-- Feedback System Schema
-- This creates the necessary tables and policies for the feedback feature

-- Create feedback_submissions table
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  user_name TEXT,
  
  -- Feedback content
  type TEXT NOT NULL CHECK (type IN ('feature_request', 'bug_report', 'feedback', 'improvement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Metadata
  page_url TEXT,
  page_path TEXT,
  browser_info JSONB,
  user_agent TEXT,
  screenshot_url TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'planned', 'in_progress', 'completed', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Admin notes
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_submissions(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_submissions(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_submissions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback_submissions;
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback_submissions;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert feedback
CREATE POLICY "Users can insert feedback" ON feedback_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for feedback screenshots (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-screenshots', 'feedback-screenshots', false);

-- Storage policies for feedback screenshots
-- CREATE POLICY "Users can upload feedback screenshots" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'feedback-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own feedback screenshots" ON storage.objects
--   FOR SELECT USING (bucket_id = 'feedback-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

