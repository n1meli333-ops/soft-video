"use client";

import { Loader2, ImageOff, AlertCircle, RefreshCw, Eye } from "lucide-react";

interface FragmentCardProps {
  index: number;
  status: string;
  duration?: number | null;
  thumbnailPath?: string | null;
  prompt?: string;
  errorMessage?: string | null;
  isRegenerating?: boolean;
  onShowPrompt?: () => void;
  onRegenerate?: () => void;
}

export function FragmentCard({
  index,
  status,
  duration,
  thumbnailPath,
  prompt,
  errorMessage,
  isRegenerating,
  onShowPrompt,
  onRegenerate,
}: FragmentCardProps) {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const isGenerating = status === "generating_image" || status === "generating_video" || status === "generating";

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
        ) : isGenerating || isRegenerating ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-[var(--text-muted)] animate-spin" />
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              {status === "generating_image" ? "Image..." :
               status === "generating_video" ? "Video..." :
               "Generating"}
            </span>
            <span className="text-xs text-[var(--text-muted)]">...</span>
          </div>
        ) : status === "failed" ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle size={24} className="text-[var(--error)]" />
            <span className="text-xs text-[var(--error)]">Failed</span>
            {errorMessage && (
              <span className="text-[10px] text-[var(--error)]/60 text-center px-2 line-clamp-2">
                {errorMessage}
              </span>
            )}
          </div>
        ) : thumbnailPath ? (
          /* Has image but video not done yet */
          <img
            src={thumbnailPath}
            alt={`Fragment #${index + 1}`}
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <ImageOff size={24} className="text-[var(--text-muted)]" />
        )}

        {/* Generating video overlay on image */}
        {status === "generating_video" && thumbnailPath && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="text-white animate-spin" />
              <span className="text-xs text-white uppercase tracking-wider">Generating video</span>
            </div>
          </div>
        )}

        {/* Regenerate overlay on hover */}
        {(status === "completed" || status === "failed") && onRegenerate && !isRegenerating && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          </div>
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
          {prompt && onShowPrompt && (
            <button
              onClick={onShowPrompt}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Eye size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
