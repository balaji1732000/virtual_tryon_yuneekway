"use client";

import { MessageSquare } from "lucide-react";

interface FeedbackButtonProps {
  onOpen: () => void;
}

export function FeedbackButton({ onOpen }: FeedbackButtonProps) {
  return (
    <button
      onClick={onOpen}
      className="fixed top-1/2 right-0 -translate-y-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-[color:var(--sp-primary)] text-[color:var(--sp-primary-text)] shadow-lg hover:shadow-xl hover:bg-[color:var(--sp-primary-hover)] transition-all duration-200 rounded-l-lg hover:pr-5"
      aria-label="Give feedback"
      title="Give us feedback"
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
    >
      <MessageSquare className="w-5 h-5" style={{ transform: 'rotate(90deg)' }} />
      <span className="text-sm font-semibold tracking-wide">Feedback</span>
    </button>
  );
}

