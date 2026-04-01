"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AudioUploader } from "@/components/AudioUploader";
import { Loader2, Play, Square } from "lucide-react";

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  flowMode: string;
  audioPath: string | null;
  audioDuration: number | null;
  status: string;
  statusMessage: string | null;
  progress: number;
  currentStage: string | null;
  errorMessage: string | null;
  outputPath: string | null;
}

interface Template {
  id: string;
  name: string;
}

const PIPELINE_STAGES = [
  { key: "transcribing", label: "Transcribing audio" },
  { key: "generating_prompts", label: "Generating prompts" },
  { key: "generating_images", label: "Generating images" },
  { key: "generating_videos", label: "Generating videos" },
  { key: "rendering", label: "Rendering final video" },
];

export default function GeneralPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    const data = await res.json();
    setProject(data);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
  }, [fetchProject]);

  // Poll for updates when pipeline is running
  useEffect(() => {
    if (!project) return;
    const running = ["transcribing", "generating_prompts", "generating_images", "generating_videos", "rendering"];
    if (running.includes(project.status)) {
      const interval = setInterval(fetchProject, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.status, fetchProject]);

  const updateField = useCallback(
    async (field: string, value: string | boolean | null) => {
      if (!project) return;
      setSaving(true);
      setProject((p) => (p ? { ...p, [field]: value } : p));
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      setSaving(false);
    },
    [project, projectId]
  );

  const handleStartPipeline = async () => {
    if (!project?.audioPath) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        fetchProject();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start pipeline");
      }
    } catch {
      alert("Failed to start pipeline");
    }
  };

  const handleStopPipeline = async () => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", statusMessage: "Cancelled by user" }),
      });
      fetchProject();
    } catch {}
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  const isRunning = ["transcribing", "generating_prompts", "generating_images", "generating_videos", "rendering"].includes(project.status);
  const isDone = project.status === "completed";
  const isFailed = project.status === "failed";

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Project Settings */}
      <h2 className="text-lg font-semibold mb-6">Project settings</h2>

      <div className="space-y-5 mb-10">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Project name</label>
          <input
            type="text"
            value={project.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-[350px] text-sm"
            disabled={isRunning}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Prompt template</label>
          <select
            value={project.templateId || ""}
            onChange={(e) => updateField("templateId", e.target.value || null)}
            className="w-[350px] text-sm"
            disabled={isRunning}
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Flow mode</label>
          <select
            value={project.flowMode}
            onChange={(e) => updateField("flowMode", e.target.value)}
            className="w-[350px] text-sm"
            disabled={isRunning}
          >
            <option value="image-to-video">Image to video (Nano Banana Pro → veo3.1 fast)</option>
            <option value="text-to-video">Text to video (veo3.1 fast only)</option>
          </select>
        </div>
      </div>

      {/* Audio */}
      <h2 className="text-lg font-semibold mb-4">Audio</h2>

      <AudioUploader
        projectId={projectId}
        currentAudio={project.audioPath}
        onUploadComplete={(audioPath, duration) => {
          setProject((p) => (p ? { ...p, audioPath, audioDuration: duration } : p));
        }}
      />

      {project.audioDuration != null && project.audioDuration > 0 && (
        <p className="text-sm text-[var(--text-muted)] mt-3">
          Duration: {Math.floor(project.audioDuration / 60)}:
          {String(Math.floor(project.audioDuration % 60)).padStart(2, "0")}
        </p>
      )}

      {/* Pipeline Status */}
      {(isRunning || isDone || isFailed) && (
        <div className="mt-8 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Pipeline Progress</h3>

          {/* Stage indicators */}
          <div className="space-y-2 mb-4">
            {PIPELINE_STAGES.map((stage) => {
              const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === project.currentStage);
              const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === stage.key);
              const isActive = stage.key === project.currentStage;
              const isCompleted = stageIdx < currentIdx || isDone;

              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    isActive ? "bg-yellow-400 animate-pulse" :
                    isCompleted ? "bg-green-400" :
                    "bg-[var(--text-muted)]/30"
                  }`} />
                  <span className={`text-sm ${
                    isActive ? "text-yellow-400 font-medium" :
                    isCompleted ? "text-green-400" :
                    "text-[var(--text-muted)]"
                  }`}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFailed ? "bg-red-500" : isDone ? "bg-green-400" : "bg-[var(--accent)]"
              }`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{project.statusMessage || project.status}</span>
            <span>{Math.round(project.progress)}%</span>
          </div>

          {isFailed && project.errorMessage && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-400">
              {project.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8 flex justify-end gap-3">
        {isRunning && (
          <button
            onClick={handleStopPipeline}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-red-500 text-[var(--text-secondary)] hover:text-red-400 rounded-xl text-sm font-medium transition-colors"
          >
            <Square size={16} />
            Stop
          </button>
        )}

        {!isRunning && !isDone && (
          <button
            onClick={handleStartPipeline}
            disabled={!project.audioPath}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Play size={18} />
            Start Generation
          </button>
        )}

        {isDone && project.outputPath && (
          <a
            href={`/api/projects/${projectId}/download`}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Download Video
          </a>
        )}
      </div>

      {!project.audioPath && !isRunning && (
        <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
          Upload audio to start the automated pipeline
        </p>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)]">
          Saving...
        </div>
      )}
    </div>
  );
}
