"use client";

import { useState, useRef, ChangeEvent } from "react";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { FeedbackType, FeedbackTypeOption, getBrowserInfo } from "@/lib/feedback/types";

interface FeedbackFormProps {
  type: FeedbackTypeOption;
  onBack: () => void;
  onClose: () => void;
}

export function FeedbackForm({ type, onBack, onClose }: FeedbackFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Screenshot size must be less than 5MB");
      return;
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Screenshot must be PNG, JPG, JPEG, or WebP");
      return;
    }

    setScreenshot(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters");
      return;
    }
    if (title.trim().length > 200) {
      setError("Title must be less than 200 characters");
      return;
    }
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }
    if (description.trim().length > 5000) {
      setError("Description must be less than 5000 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("type", type.id);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("pageUrl", window.location.href);
      formData.append("pagePath", window.location.pathname);
      formData.append("browserInfo", JSON.stringify(getBrowserInfo()));
      
      if (screenshot) {
        formData.append("screenshot", screenshot);
      }

      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[color:var(--sp-foreground)] mb-2">Thank you!</h3>
        <p className="text-sm text-[color:var(--sp-muted)]">Your feedback has been submitted successfully.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3 pb-4 border-b border-[color:var(--sp-border)]">
        <button
          type="button"
          onClick={onBack}
          className="text-[color:var(--sp-muted)] hover:text-[color:var(--sp-foreground)] transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{type.icon}</span>
          <h3 className="text-lg font-semibold text-[color:var(--sp-foreground)]">{type.label}</h3>
        </div>
      </div>

      {/* Title input */}
      <div>
        <label htmlFor="feedback-title" className="block text-sm font-medium text-[color:var(--sp-foreground)] mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="feedback-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title"
          className="w-full px-3 py-2 bg-[color:var(--sp-input)] border border-[color:var(--sp-border)] rounded-lg text-[color:var(--sp-foreground)] placeholder:text-[color:var(--sp-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={200}
          required
        />
        <div className="text-xs text-[color:var(--sp-muted)] mt-1 text-right">
          {title.length}/200
        </div>
      </div>

      {/* Description textarea */}
      <div>
        <label htmlFor="feedback-description" className="block text-sm font-medium text-[color:var(--sp-foreground)] mb-2">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="feedback-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type.placeholder}
          className="w-full px-3 py-2 bg-[color:var(--sp-input)] border border-[color:var(--sp-border)] rounded-lg text-[color:var(--sp-foreground)] placeholder:text-[color:var(--sp-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
          maxLength={5000}
          required
        />
        <div className="text-xs text-[color:var(--sp-muted)] mt-1 text-right">
          {description.length}/5000
        </div>
      </div>

      {/* Screenshot upload */}
      <div>
        <label className="block text-sm font-medium text-[color:var(--sp-foreground)] mb-2">
          Screenshot (optional)
        </label>
        
        {screenshotPreview ? (
          <div className="relative">
            <img
              src={screenshotPreview}
              alt="Screenshot preview"
              className="w-full h-48 object-cover rounded-lg border border-[color:var(--sp-border)]"
            />
            <button
              type="button"
              onClick={handleRemoveScreenshot}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              aria-label="Remove screenshot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[color:var(--sp-border)] rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <Upload className="w-8 h-8 text-[color:var(--sp-muted)] mx-auto mb-2" />
            <p className="text-sm text-[color:var(--sp-muted)] mb-1">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-[color:var(--sp-muted)]">
              PNG, JPG, JPEG, or WebP (max 5MB)
            </p>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleScreenshotChange}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 bg-[color:var(--sp-hover)] text-[color:var(--sp-foreground)] rounded-lg hover:bg-[color:var(--sp-border)] transition-colors"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit"
          )}
        </button>
      </div>
    </form>
  );
}

