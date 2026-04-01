"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FragmentCard } from "@/components/FragmentCard";
import { StatusBar } from "@/components/StatusBar";
import { Loader2, FolderOpen, Download, Square } from "lucide-react";

interface Fragment {
  id: string;
  index: number;
  prompt: string;
  imagePath: string | null;
  videoPath: string | null;
  thumbnailPath: string | null;
  duration: number | null;
  status: string;
  errorMessage: string | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
  statusMessage: string | null;
  progress: number;
  currentStage: string | null;
  audioDuration: number | null;
  outputPath: string | null;
  errorMessage: string | null;
  fragments: Fragment[];
}

const STAGES = [
  { key: "transcribing", label: "Transcribing" },
  { key: "generating_prompts", label: "Prompts" },
  { key: "generating_images", label: "Images" },
  { key: "generating_videos", label: "Videos" },
  { key: "rendering", label: "Rendering" },
];

export default function GenerationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    const data: Project = await res.json();
    setProject(data);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll for updates when pipeline is running
  const isRunning = project && ["transcribing", "generating_prompts", "generating_images", "generating_videos", "rendering"].includes(project.status);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(fetchProject, 3000);
      return () => clearInterval(interval);
    }
  }, [isRunning, fetchProject]);

  // Elapsed timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleStop = async () => {
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", statusMessage: "Cancelled by user" }),
    });
    fetchProject();
  };

  const handleRegenerate = async (fragmentId: string) => {
    setRegeneratingId(fragmentId);
    try {
      const res = await fetch(`/api/projects/${projectId}/fragments/${fragmentId}/regenerate`, {
        method: "POST",
      });
      if (res.ok) {
        fetchProject();
      } else {
        const data = await res.json();
        alert(data.error || "Regeneration failed");
      }
    } catch {
      alert("Regeneration failed");
    } finally {
      setRegeneratingId(null);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  const completedFragments = project.fragments.filter((f) => f.status === "completed").length;
  const totalFragments = project.fragments.length;
  const totalDuration = project.fragments
    .filter((f) => f.duration)
    .reduce((sum, f) => sum + (f.duration || 0), 0);
  const isDone = project.status === "completed";
  const isFailed = project.status === "failed";
  const isEmpty = totalFragments === 0 && !isRunning && project.status === "draft";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <div className="flex items-center gap-3">
          {isRunning && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-red-500 text-[var(--text-secondary)] hover:text-red-400 rounded-lg text-sm transition-colors"
            >
              <Square size={14} />
              Stop
            </button>
          )}
          {isDone && project.outputPath && (
            <a
              href={`/api/projects/${projectId}/download`}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={14} />
              Download Video
            </a>
          )}
        </div>
      </div>

      {/* Pipeline Stage Progress */}
      {(isRunning || isDone || isFailed) && (
        <div className="mb-6">
          {/* Stages stepper */}
          <div className="flex items-center gap-1 mb-3">
            {STAGES.map((stage, i) => {
              const currentIdx = STAGES.findIndex((s) => s.key === project.currentStage);
              const isActive = stage.key === project.currentStage;
              const isCompleted = i < currentIdx || isDone;

              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className={`flex-1 h-1.5 rounded-full ${
                    isCompleted ? "bg-green-400" :
                    isActive ? "bg-[var(--accent)]" :
                    "bg-[var(--bg-primary)]"
                  }`}>
                    {isActive && (
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                        style={{ width: `${project.progress}%` }}
                      />
                    )}
                  </div>
                  {i < STAGES.length - 1 && <div className="w-1" />}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            {STAGES.map((stage) => {
              const isActive = stage.key === project.currentStage;
              return (
                <span key={stage.key} className={isActive ? "text-[var(--accent)] font-medium" : ""}>
                  {stage.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Bar */}
      {totalFragments > 0 && (
        <div className="mb-6">
          <StatusBar
            status={
              isRunning ? "running" :
              isDone ? "completed" :
              isFailed ? "failed" :
              project.status === "cancelled" ? "cancelled" :
              "pending"
            }
            completedFragments={completedFragments}
            totalFragments={totalFragments}
            duration={formatTime(totalDuration)}
            elapsed={isRunning ? formatTime(elapsedSeconds) : undefined}
          />
        </div>
      )}

      {/* Status message */}
      {project.statusMessage && (isRunning || isFailed) && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          isFailed ? "bg-red-900/20 border border-red-800/30 text-red-400" :
          "bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]"
        }`}>
          {project.statusMessage}
        </div>
      )}

      {/* Empty state */}
      {isEmpty ? (
        <div className="text-center py-20 text-[var(--text-secondary)]">
          <FolderOpen size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm text-[var(--text-muted)]">
            Go to General tab, upload audio, and click Start Generation.
            <br />
            Everything will be automated from there.
          </p>
        </div>
      ) : isRunning && totalFragments === 0 ? (
        <div className="text-center py-20 text-[var(--text-secondary)]">
          <Loader2 size={32} className="mx-auto mb-4 text-[var(--text-muted)] animate-spin" />
          <p className="text-lg mb-2">Segments are being generated...</p>
          <p className="text-sm text-[var(--text-muted)]">{project.statusMessage}</p>
        </div>
      ) : (
        /* Fragments Grid */
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {project.fragments.map((fragment) => (
            <FragmentCard
              key={fragment.id}
              index={fragment.index}
              status={fragment.status}
              duration={fragment.duration}
              thumbnailPath={fragment.thumbnailPath || fragment.imagePath}
              prompt={fragment.prompt}
              errorMessage={fragment.errorMessage}
              isRegenerating={regeneratingId === fragment.id}
              onShowPrompt={() => setSelectedPrompt(fragment.prompt)}
              onRegenerate={() => handleRegenerate(fragment.id)}
            />
          ))}
        </div>
      )}

      {/* Prompt Modal */}
      {selectedPrompt && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedPrompt(null)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Fragment Prompt</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {selectedPrompt}
            </p>
            <button
              onClick={() => setSelectedPrompt(null)}
              className="mt-4 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm hover:border-[var(--border-light)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
