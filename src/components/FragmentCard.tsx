"use client";

import { Loader2, ImageOff, AlertCircle } from "lucide-react";

interface FragmentCardProps {
  index: number;
  status: string;
  duration?: number | null;
  thumbnailPath?: string | null;
  prompt?: string;
  onShowPrompt?: () => void;
}

export function FragmentCard({
  index,
  status,
  duration,
  thumbnailPath,
  prompt,
  onShowPrompt,
}: FragmentCardProps) {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden hover:border-[var(--border-light)] transition-all group">
      {/* Thumbnail area */}
      <div className="aspect-video relative bg-[var(--bg-primary)] flex items-center justify-center">
        {status === "completed" && thumbnailPath ? (
          <img
            src={thumbnailPath}
            alt={`Fragment #${index + 1}`}
            className="w-full h-full object-cover"
          />
        ) : status === "generating" ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-[var(--text-muted)] animate-spin" />
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              Generating
            </span>
            <span className="text-xs text-[var(--text-muted)]">...</span>
          </div>
        ) : status === "failed" ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle size={24} className="text-[var(--error)]" />
            <span className="text-xs text-[var(--error)]">Failed</span>
          </div>
        ) : (
          <ImageOff size={24} className="text-[var(--text-muted)]" />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-primary)] font-semibold">#{index + 1}</span>
          {duration && (
            <span className="text-[var(--text-muted)]">{formatTime(duration)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {prompt && (
            <button
              onClick={onShowPrompt}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
