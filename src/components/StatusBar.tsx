"use client";

interface StatusBarProps {
  status: string;
  completedFragments: number;
  totalFragments: number;
  duration?: string;
  estimatedDuration?: string;
  elapsed?: string;
  onCancel?: () => void;
  onOpenFolder?: () => void;
  onRender?: () => void;
}

export function StatusBar({
  status,
  completedFragments,
  totalFragments,
  duration,
  estimatedDuration,
  elapsed,
  onCancel,
  onRender,
}: StatusBarProps) {
  const progress = totalFragments > 0 ? (completedFragments / totalFragments) * 100 : 0;

  const statusColors: Record<string, string> = {
    running: "text-yellow-400",
    completed: "text-green-400",
    cancelled: "text-red-400",
    pending: "text-gray-400",
  };

  const dotColors: Record<string, string> = {
    running: "bg-yellow-400",
    completed: "bg-green-400",
    cancelled: "bg-red-400",
    pending: "bg-gray-400",
  };

  return (
    <div className="flex items-center gap-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-5 py-3">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColors[status] || "bg-gray-400"} ${status === "running" ? "animate-pulse" : ""}`} />
        <span className={`text-sm font-semibold capitalize ${statusColors[status] || "text-gray-400"}`}>
          {status}
        </span>
      </div>

      {/* Fragments */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Fragments</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {completedFragments} <span className="text-[var(--text-muted)] font-normal">/ {totalFragments}</span>
          </span>
          <div className="w-20 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--warning)] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Duration */}
      {duration && (
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Duration</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {duration}
            {estimatedDuration && (
              <span className="text-[var(--text-muted)] font-normal text-xs"> ({estimatedDuration})</span>
            )}
          </span>
        </div>
      )}

      {/* Elapsed */}
      {elapsed && (
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Elapsed</span>
          <span className="text-sm font-bold text-[var(--text-primary)]">{elapsed}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {status === "running" && onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors flex items-center gap-1"
          >
            × Cancel
          </button>
        )}
        {onRender && (
          <button
            onClick={onRender}
            className="px-4 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--border-light)] rounded-lg text-sm transition-colors flex items-center gap-1"
          >
            ▶ Render
          </button>
        )}
      </div>
    </div>
  );
}
