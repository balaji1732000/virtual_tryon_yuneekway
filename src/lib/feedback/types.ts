export type FeedbackType = 'feature_request' | 'bug_report' | 'feedback' | 'improvement';

export type FeedbackStatus = 'open' | 'in_review' | 'planned' | 'in_progress' | 'completed' | 'closed';

export type FeedbackPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface FeedbackTypeOption {
  id: FeedbackType;
  label: string;
  icon: string;
  color: string;
  placeholder: string;
}

export interface BrowserInfo {
  browser: string;
  version: string;
  os: string;
  platform: string;
  language: string;
  screenResolution: string;
}

export interface FeedbackSubmission {
  id: string;
  created_at: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  type: FeedbackType;
  title: string;
  description: string;
  page_url?: string;
  page_path?: string;
  browser_info?: BrowserInfo;
  user_agent?: string;
  screenshot_url?: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  admin_notes?: string;
  resolved_at?: string;
}

export interface FeedbackFormData {
  type: FeedbackType;
  title: string;
  description: string;
  screenshot?: File;
  pageUrl: string;
  pagePath: string;
  browserInfo: BrowserInfo;
}

export const FEEDBACK_TYPES: FeedbackTypeOption[] = [
  {
    id: 'feature_request',
    label: 'Feature Request',
    icon: '💡',
    color: '#f59e0b',
    placeholder: 'Describe the feature you would like to see...',
  },
  {
    id: 'bug_report',
    label: 'Bug Report',
    icon: '🐛',
    color: '#ef4444',
    placeholder: 'Please include screenshots if possible.',
  },
  {
    id: 'feedback',
    label: 'General Feedback',
    icon: '💬',
    color: '#8b5cf6',
    placeholder: 'Share your thoughts with us...',
  },
  {
    id: 'improvement',
    label: 'Improvement Suggestion',
    icon: '✨',
    color: '#10b981',
    placeholder: 'How can we make this better?',
  },
];

export function getBrowserInfo(): BrowserInfo {
  if (typeof window === 'undefined') {
    return {
      browser: 'Unknown',
      version: '',
      os: 'Unknown',
      platform: '',
      language: '',
      screenResolution: '',
    };
  }

  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = '';
  let os = 'Unknown';

  // Detect browser
  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    version = ua.match(/Version\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
    version = ua.match(/Edg\/([0-9.]+)/)?.[1] || '';
  }

  // Detect OS
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS')) os = 'iOS';

  return {
    browser,
    version,
    os,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
  };
}

