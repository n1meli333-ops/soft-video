"use client";

import { useEffect, useState } from "react";

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface ActivityPanelProps {
  projectId: string;
}

export function ActivityPanel({ projectId }: ActivityPanelProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Poll for activity updates
    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.generations?.length > 0) {
            const gen = data.generations[0];
            if (gen.status === "running") {
              setActivities([{
                id: gen.id,
                type: "generation",
                message: `Generating: ${gen.completedFragments}/${gen.totalFragments} fragments`,
                timestamp: new Date().toLocaleTimeString(),
              }]);
              return;
            }
          }
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  return (
    <aside className="w-[280px] min-h-screen border-l border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
      <div className="p-4 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold">Activity</h3>
      </div>
      <div className="p-4">
        {activities.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center mt-20">
            No activity yet - waiting for running generations
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3"
              >
                <p className="text-xs text-[var(--text-secondary)]">{activity.message}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{activity.timestamp}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
