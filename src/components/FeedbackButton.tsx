"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";

interface FeedbackButtonProps {
  onOpen: () => void;
}

export function FeedbackButton({ onOpen }: FeedbackButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
      aria-label="Give feedback"
      title="Give us feedback"
    >
      <MessageSquare className="w-6 h-6" />
      {isHovered && (
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg whitespace-nowrap">
          Feedback
        </span>
      )}
    </button>
  );
}

