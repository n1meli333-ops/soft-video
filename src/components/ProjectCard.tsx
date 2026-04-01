"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface ProjectCardProps {
  id: string;
  name: string;
  status: string;
  fragmentCount: number;
  progress: number;
  updatedAt: string;
}

export function ProjectCard({ id, name, status, fragmentCount, progress, updatedAt }: ProjectCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project "${name}"?`)) return;

    setDeleting(true);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      alert("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const isRunning = ["transcribing", "generating_prompts", "generating_images", "generating_videos", "rendering"].includes(status);

  return (
    <div
      onClick={() => router.push(`/project/${id}`)}
      className="relative block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-light)] transition-all cursor-pointer group"
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-3 right-3 p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] opacity-0 group-hover:opacity-100 transition-all"
        title="Delete project"
      >
        <Trash2 size={14} />
      </button>

      <h3 className="font-semibold text-lg mb-2 pr-8">{name}</h3>

      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
          status === "completed"
            ? "bg-green-900/30 text-green-400"
            : status === "failed"
            ? "bg-red-900/30 text-red-400"
            : status === "cancelled"
            ? "bg-gray-800/30 text-gray-400"
            : isRunning
            ? "bg-yellow-900/30 text-yellow-400"
            : "bg-gray-800/30 text-gray-400"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === "completed"
              ? "bg-green-400"
              : status === "failed"
              ? "bg-red-400"
              : isRunning
              ? "bg-yellow-400 animate-pulse"
              : "bg-gray-400"
          }`} />
          {status}
        </span>
        {fragmentCount > 0 && <span>{fragmentCount} fragments</span>}
      </div>

      {/* Progress bar for running projects */}
      {isRunning && progress > 0 && (
        <div className="mt-3 w-full h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] mt-3">
        {new Date(updatedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
