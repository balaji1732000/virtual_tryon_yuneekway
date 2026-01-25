"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { FEEDBACK_TYPES, FeedbackTypeOption } from "@/lib/feedback/types";
import { FeedbackForm } from "./FeedbackForm";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [selectedType, setSelectedType] = useState<FeedbackTypeOption | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedType(null);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[color:var(--sp-background)] rounded-xl shadow-2xl border border-[color:var(--sp-border)] animate-in fade-in zoom-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[color:var(--sp-muted)] hover:text-[color:var(--sp-foreground)] transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {selectedType ? (
            <FeedbackForm
              type={selectedType}
              onBack={() => setSelectedType(null)}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[color:var(--sp-foreground)] mb-2">
                  Give us feedback
                </h2>
                <p className="text-sm text-[color:var(--sp-muted)]">
                  Tell us how we could make the product more useful for you.
                </p>
              </div>

              {/* Type selection */}
              <div className="space-y-3">
                {FEEDBACK_TYPES.map((type, index) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className="w-full flex items-center gap-4 p-4 bg-[color:var(--sp-hover)] hover:bg-[color:var(--sp-border)] rounded-lg transition-colors text-left group border border-transparent hover:border-[color:var(--sp-border)]"
                  >
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${type.color}20` }}
                    >
                      {type.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[color:var(--sp-foreground)] group-hover:text-blue-600 transition-colors">
                        {type.label}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-[color:var(--sp-muted)] text-sm">
                      {index + 1}
                    </div>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-[color:var(--sp-border)] text-center">
                <p className="text-xs text-[color:var(--sp-muted)]">
                  Your feedback helps us improve YUNEEKWAYAI
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

