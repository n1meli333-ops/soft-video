"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AudioUploader } from "@/components/AudioUploader";
import { Toggle } from "@/components/Toggle";

interface Project {
  id: string;
  name: string;
  promptTemplate: string;
  flowMode: string;
  aiVersion: string;
  staticSeed: boolean;
  refineLogic: boolean;
  audioPath: string | null;
  audioDuration: number | null;
  status: string;
}

export default function GeneralPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject);
  }, [projectId]);

  const updateField = useCallback(
    async (field: string, value: string | boolean) => {
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
            value={project.promptTemplate}
            onChange={(e) => updateField("promptTemplate", e.target.value)}
            className="w-[350px] text-sm"
          >
            <option value="CINEMA TAINS">CINEMA TAINS</option>
            <option value="DOCUMENTARY">DOCUMENTARY</option>
            <option value="ANIME">ANIME</option>
            <option value="REALISTIC">REALISTIC</option>
            <option value="CUSTOM">CUSTOM</option>
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
      <h2 className="text-lg font-semibold mb-6">Audio</h2>

      <AudioUploader
        projectId={projectId}
        currentAudio={project.audioPath}
        onUploadComplete={(audioPath, duration) => {
          setProject((p) =>
            p ? { ...p, audioPath, audioDuration: duration } : p
          );
        }}
      />

      {project.audioDuration && (
        <p className="text-sm text-[var(--text-muted)] mt-3">
          Duration: {Math.floor(project.audioDuration / 60)}:
          {String(Math.floor(project.audioDuration % 60)).padStart(2, "0")}
        </p>
      )}

      {/* Status indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)]">
          Saving...
        </div>
      )}
    </div>
  );
}
