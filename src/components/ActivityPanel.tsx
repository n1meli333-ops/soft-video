"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  stage: string | null;
  message: string;
  details: string | null;
  progress: number | null;
  createdAt: string;
}

interface ActivityPanelProps {
  projectId: string;
}

const typeIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  progress: Info,
};

const typeColors = {
  success: "text-green-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-[var(--text-muted)]",
  progress: "text-[var(--accent)]",
};

export function ActivityPanel({ projectId }: ActivityPanelProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/activity`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Auto-scroll to bottom on new activities
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities.length]);

  return (
    <aside className="w-[280px] min-h-screen border-l border-[var(--border-color)] bg-[var(--bg-secondary)]/30 flex flex-col">
      <div className="p-4 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold">Activity</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3">
        {activities.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-20">
            No activity yet - waiting for running generations
          </p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => {
              const Icon = typeIcons[activity.type as keyof typeof typeIcons] || Info;
              const color = typeColors[activity.type as keyof typeof typeColors] || "text-[var(--text-muted)]";

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--bg-card)]/50 transition-colors"
                >
                  <Icon size={14} className={`${color} mt-0.5 shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {activity.message}
                    </p>
                    {activity.details && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                        {activity.details}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {new Date(activity.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
