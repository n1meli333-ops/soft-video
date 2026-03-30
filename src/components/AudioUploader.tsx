"use client";

import { useState, useCallback, useRef } from "react";
import { Music, Upload, X, Loader2 } from "lucide-react";

interface AudioUploaderProps {
  projectId: string;
  currentAudio?: string | null;
  onUploadComplete: (audioPath: string, duration: number) => void;
}

export function AudioUploader({ projectId, currentAudio, onUploadComplete }: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(
    currentAudio ? currentAudio.split("/").pop() || null : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("audio/")) {
        alert("Please upload an audio file (MP3, WAV, AAC)");
        return;
      }

      setUploading(true);
      setFileName(file.name);

      try {
        const formData = new FormData();
        formData.append("audio", file);

        const res = await fetch(`/api/projects/${projectId}/audio`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        onUploadComplete(data.audioPath, data.duration);
      } catch (err) {
        console.error("Upload error:", err);
        setFileName(null);
      } finally {
        setUploading(false);
      }
    },
    [projectId, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : fileName
            ? "border-[var(--border-light)] bg-[var(--bg-card)]"
            : "border-[var(--border-color)] hover:border-[var(--border-light)] bg-[var(--bg-input)]"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[var(--accent)] animate-spin" />
            <p className="text-sm text-[var(--text-secondary)]">Uploading...</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-3">
            <Music size={32} className="text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-primary)] font-medium">{fileName}</p>
            <p className="text-xs text-[var(--text-muted)]">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Music size={32} className="text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Drag & drop audio file here
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              or click to browse • MP3, WAV, AAC
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
