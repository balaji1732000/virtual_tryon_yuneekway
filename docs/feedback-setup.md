# Feedback System Setup

This guide will help you set up the feedback system in your application.

## Overview

The feedback system allows users to submit:
- 💡 Feature Requests
- 🐛 Bug Reports
- 💬 General Feedback
- ✨ Improvement Suggestions

## Setup Steps

### 1. Database Setup

Apply the database schema to your Supabase project:

```bash
# Navigate to your project
cd nextjs_app

# Apply the migration
supabase db push --file docs/feedback-schema.sql
```

Or manually run the SQL in the Supabase SQL Editor:
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `docs/feedback-schema.sql`
4. Click "Run"

### 2. Storage Bucket Setup

Create a storage bucket for feedback screenshots:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `feedback-screenshots`
4. Set to **Private** (not public)
5. Click "Create bucket"

**Configure bucket policies:**

```sql
-- Allow users to upload their own screenshots
CREATE POLICY "Users can upload feedback screenshots" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'feedback-screenshots' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view their own screenshots
CREATE POLICY "Users can view own feedback screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'feedback-screenshots' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. Verify Tables

Check that the following table was created:
- `feedback_submissions`

Run this query to verify:

```sql
SELECT * FROM feedback_submissions LIMIT 1;
```

## Features

### Floating Feedback Button

- Located at bottom-left corner of all app pages
- Click to open feedback modal
- Styled to match your app theme

### Feedback Types

1. **Feature Request** (💡)
   - For suggesting new features
   - Color: Amber (#f59e0b)

2. **Bug Report** (🐛)
   - For reporting bugs and issues
   - Color: Red (#ef4444)

3. **General Feedback** (💬)
   - For general comments and suggestions
   - Color: Purple (#8b5cf6)

4. **Improvement Suggestion** (✨)
   - For suggesting improvements to existing features
   - Color: Green (#10b981)

### Collected Data

Each feedback submission includes:
- User ID and email (from Supabase Auth)
- Feedback type, title, and description
- Optional screenshot
- Page URL and path (where feedback was submitted)
- Browser information (browser, version, OS, screen resolution)
- User agent
- Timestamp
- Status (default: "open")
- Priority (default: "medium")

## Viewing Feedback

### Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Select `feedback_submissions` table
3. View all submitted feedback

### Query Examples

**Get all open feedback:**
```sql
SELECT * FROM feedback_submissions 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

**Get feedback by type:**
```sql
SELECT * FROM feedback_submissions 
WHERE type = 'bug_report' 
ORDER BY created_at DESC;
```

**Get feedback with screenshots:**
```sql
SELECT * FROM feedback_submissions 
WHERE screenshot_url IS NOT NULL 
ORDER BY created_at DESC;
```

## Status Management

You can update feedback status manually in Supabase:

```sql
UPDATE feedback_submissions 
SET status = 'in_progress', priority = 'high' 
WHERE id = 'feedback-id-here';
```

Available statuses:
- `open` - New feedback (default)
- `in_review` - Being reviewed
- `planned` - Accepted and planned
- `in_progress` - Being worked on
- `completed` - Implemented/resolved
- `closed` - Closed without action

Available priorities:
- `low`
- `medium` (default)
- `high`
- `urgent`

## Troubleshooting

### Feedback not submitting

1. Check browser console for errors
2. Verify Supabase connection
3. Check that the user is authenticated
4. Verify the `feedback_submissions` table exists
5. Check RLS policies are correctly set

### Screenshots not uploading

1. Verify `feedback-screenshots` bucket exists
2. Check bucket is set to **private**
3. Verify storage policies are set correctly
4. Check file size is under 5MB
5. Verify file type is PNG, JPG, JPEG, or WebP

### Can't see submitted feedback

1. Check you're logged in with the same account
2. Verify RLS policies allow SELECT for the user
3. Try querying directly in Supabase SQL Editor:
   ```sql
   SELECT * FROM feedback_submissions WHERE user_id = 'your-user-id';
   ```

## Future Enhancements

Consider adding:
- Admin dashboard to view and manage feedback
- Email notifications on new submissions
- User notifications when feedback status changes
- Voting system for feature requests
- Public feedback board/roadmap
- Search and filtering
- Feedback analytics

## API Endpoint

The feedback submission endpoint is:

```
POST /api/feedback/submit
```

**Request (FormData):**
- `type`: 'feature_request' | 'bug_report' | 'feedback' | 'improvement'
- `title`: string (3-200 chars)
- `description`: string (10-5000 chars)
- `screenshot`: File (optional, max 5MB)
- `pageUrl`: string
- `pagePath`: string
- `browserInfo`: JSON string

**Response:**
```json
{
  "success": true,
  "feedbackId": "uuid"
}
```

## Support

For issues or questions about the feedback system, check:
1. Browser console for client-side errors
2. Server logs for API errors
3. Supabase logs for database errors

