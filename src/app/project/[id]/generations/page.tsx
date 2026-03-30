"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FragmentCard } from "@/components/FragmentCard";
import { StatusBar } from "@/components/StatusBar";
import { Upload, Loader2, FolderOpen } from "lucide-react";

interface Fragment {
  id: string;
  index: number;
  prompt: string;
  videoPath: string | null;
  thumbnailPath: string | null;
  duration: number | null;
  status: string;
}

interface Generation {
  id: string;
  status: string;
  totalFragments: number;
  completedFragments: number;
  duration: number | null;
  elapsed: number | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
  audioDuration: number | null;
  fragments: Fragment[];
  generations: Generation[];
}

export default function GenerationsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    const data: Project = await res.json();
    setProject(data);
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Timer for elapsed time during rendering
  useEffect(() => {
    if (rendering) {
      setElapsedSeconds(0);
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
  }, [rendering]);

  const handleUploadFragments = async (files: FileList) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("projectId", projectId);

      // Sort files by name to maintain order
      const sortedFiles = Array.from(files).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );

      for (const file of sortedFiles) {
        formData.append("fragments", file);
      }

      const res = await fetch("/api/upload-fragments", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchProject();
      } else {
        const data = await res.json();
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRender = async () => {
    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Video rendered successfully!\nOutput: ${data.outputPath}`);
        await fetchProject();
      } else {
        alert(data.error || "Render failed");
      }
    } catch (err) {
      console.error("Render error:", err);
      alert("Render failed");
    } finally {
      setRendering(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  const completedFragments = project.fragments.filter(
    (f) => f.status === "completed"
  ).length;
  const totalFragments = project.fragments.length;
  const totalDuration = project.fragments
    .filter((f) => f.duration)
    .reduce((sum, f) => sum + (f.duration || 0), 0);

  const currentGeneration = project.generations?.[0];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{project.name}</h1>
      </div>

      {/* Status Bar */}
      {totalFragments > 0 && (
        <div className="mb-6">
          <StatusBar
            status={
              rendering
                ? "running"
                : project.status === "completed"
                ? "completed"
                : completedFragments === totalFragments && totalFragments > 0
                ? "completed"
                : completedFragments > 0
                ? "running"
                : "pending"
            }
            completedFragments={completedFragments}
            totalFragments={totalFragments}
            duration={formatTime(totalDuration)}
            estimatedDuration={
              project.audioDuration ? formatTime(project.audioDuration) : undefined
            }
            elapsed={rendering ? formatTime(elapsedSeconds) : undefined}
            onRender={
              completedFragments > 0 && !rendering ? handleRender : undefined
            }
          />
        </div>
      )}

      {/* Upload area */}
      <div className="mb-6 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleUploadFragments(e.target.files);
            }
          }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload Fragments
            </>
          )}
        </button>

        {rendering && (
          <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
            <Loader2 size={16} className="animate-spin" />
            Rendering final video...
          </div>
        )}
      </div>

      {/* Fragments Grid */}
      {totalFragments === 0 ? (
        <div className="text-center py-20 text-[var(--text-secondary)]">
          <FolderOpen size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-lg mb-2">No fragments yet</p>
          <p className="text-sm text-[var(--text-muted)]">
            Generate prompts first, then use them in Flow to create video fragments.
            <br />
            Upload the generated fragments here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {project.fragments.map((fragment) => (
            <FragmentCard
              key={fragment.id}
              index={fragment.index}
              status={fragment.status}
              duration={fragment.duration}
              thumbnailPath={fragment.thumbnailPath}
              prompt={fragment.prompt}
              onShowPrompt={() => setSelectedPrompt(fragment.prompt)}
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
