"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AudioUploader } from "@/components/AudioUploader";
import { Toggle } from "@/components/Toggle";
import { Loader2, Play, ArrowDown } from "lucide-react";

interface Project {
  id: string;
  name: string;
  templateId: string | null;
  promptTemplate: string;
  flowMode: string;
  aiVersion: string;
  staticSeed: boolean;
  refineLogic: boolean;
  audioPath: string | null;
  audioDuration: number | null;
  status: string;
}

interface Template {
  id: string;
  name: string;
  stylePrompt: string;
  negativePrompt: string;
  techPrompt: string;
  indexFormat: string;
}

export default function GeneralPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject);
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
  }, [projectId]);

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
    if (!project?.audioPath) {
      setPipelineError("Upload audio first");
      return;
    }

    // Derive provider/model from aiVersion
    const aiVersionMap: Record<string, { provider: "gemini" | "openai"; model: string }> = {
      "veo-3.1": { provider: "gemini", model: "gemini-2.0-flash" },
      "veo-3.0": { provider: "gemini", model: "gemini-2.0-flash" },
      "gpt-5.2": { provider: "openai", model: "gpt-4o" },
    };
    const aiConfig = aiVersionMap[project.aiVersion] || { provider: "openai", model: "gpt-4o" };

    // Build special prompt from selected template
    const selTmpl = templates.find((t) => t.id === project.templateId);
    const specialPrompt = selTmpl
      ? [selTmpl.stylePrompt, selTmpl.negativePrompt, selTmpl.techPrompt, selTmpl.indexFormat]
          .filter(Boolean)
          .join("\n\n")
      : "";

    setStarting(true);
    setPipelineError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialPrompt,
          aiProvider: aiConfig.provider,
          aiModel: aiConfig.model,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProject((p) => (p ? { ...p, status: "ready" } : p));
        router.push(`/project/${projectId}/generations`);
      } else {
        setPipelineError(data.error || "Pipeline failed");
        setProject((p) => (p ? { ...p, status: "failed" } : p));
      }
    } catch {
      setPipelineError("Pipeline failed");
    } finally {
      setStarting(false);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

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
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Prompt template</label>
          <select
            value={project.templateId || ""}
            onChange={(e) => updateField("templateId", e.target.value || null)}
            className="w-[350px] text-sm"
          >
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Generation Settings */}
      <h2 className="text-lg font-semibold mb-6">Generation settings</h2>

      <div className="space-y-5 mb-10">
        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Flow mode</label>
          <select
            value={project.flowMode}
            onChange={(e) => updateField("flowMode", e.target.value)}
            className="w-[350px] text-sm"
          >
            <option value="image-to-video">Image to video</option>
            <option value="text-to-video">Text to video</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">AI version</label>
          <select
            value={project.aiVersion}
            onChange={(e) => updateField("aiVersion", e.target.value)}
            className="w-[350px] text-sm"
          >
            <option value="veo-3.1">Veo 3.1</option>
            <option value="veo-3.0">Veo 3.0</option>
            <option value="gpt-5.2">gpt-5.2</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Static seed</label>
          <Toggle
            checked={project.staticSeed}
            onChange={(v) => updateField("staticSeed", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-[var(--text-secondary)]">Refine Logic</label>
          <Toggle
            checked={project.refineLogic}
            onChange={(v) => updateField("refineLogic", v)}
          />
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

      {/* Start Generation Button */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={handleStartPipeline}
          disabled={starting || !project.audioPath}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {starting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Start Generation
              <ArrowDown size={18} />
            </>
          )}
        </button>
      </div>

      {pipelineError && (
        <div className="mt-3 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-400">
          {pipelineError}
        </div>
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
