"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Loader2, Copy, Download, Sparkles, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface Project {
  id: string;
  name: string;
  transcriptTxt: string | null;
  transcriptJson: string | null;
  prompts: string | null;
  promptCount: number;
  status: string;
  audioPath: string | null;
}

export default function PromptsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [specialPrompt, setSpecialPrompt] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((p: Project) => {
        setProject(p);
        if (p.prompts) {
          try {
            setPrompts(JSON.parse(p.prompts));
          } catch {}
        }
      });
  }, [projectId]);

  const handleTranscribe = async () => {
    if (!project?.audioPath) {
      alert("Upload audio first in General tab");
      return;
    }

    setTranscribing(true);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok) {
        setProject((p) =>
          p ? { ...p, transcriptTxt: data.text, transcriptJson: JSON.stringify(data.timestamps), status: "draft" } : p
        );
      } else {
        alert(data.error || "Transcription failed");
      }
    } catch (err) {
      console.error(err);
      alert("Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const handleGeneratePrompts = async () => {
    if (!project?.transcriptTxt) {
      alert("Transcribe audio first");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, specialPrompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setPrompts(data.prompts);
        setProject((p) =>
          p ? { ...p, prompts: JSON.stringify(data.prompts), promptCount: data.count, status: "ready" } : p
        );
      } else {
        alert(data.error || "Prompt generation failed. Check that GEMINI_API_KEY is set.");
      }
    } catch (err) {
      console.error(err);
      alert("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyAllPrompts = () => {
    const text = prompts.join("\n---\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPrompts = () => {
    const text = JSON.stringify(prompts, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompts-${projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      {/* Step 1: Transcription */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText size={20} />
          Step 1: Transcription
        </h2>

        {!project.audioPath ? (
          <p className="text-sm text-[var(--text-muted)]">
            Upload audio first in the General tab
          </p>
        ) : !project.transcriptTxt ? (
          <button
            onClick={handleTranscribe}
            disabled={transcribing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {transcribing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <FileText size={16} />
                Start Transcription
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Transcript Text */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-green-400">✓ Transcription complete</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const blob = new Blob([project.transcriptTxt || ""], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "transcript.txt";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                  >
                    <Download size={12} />
                    TXT
                  </button>
                  <button
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {transcribing ? "Retranscribing..." : "Retranscribe"}
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto text-sm text-[var(--text-secondary)] leading-relaxed">
                {project.transcriptTxt}
              </div>
            </div>

            {/* Timestamps JSON */}
            {project.transcriptJson && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowTimestamps(!showTimestamps)}
                    className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2 hover:text-[var(--accent)] transition-colors"
                  >
                    <Clock size={14} />
                    Timestamps JSON ({JSON.parse(project.transcriptJson).length} words)
                    {showTimestamps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => {
                      const formatted = JSON.stringify(JSON.parse(project.transcriptJson!), null, 2);
                      const blob = new Blob([formatted], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "timestamps.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                  >
                    <Download size={12} />
                    JSON
                  </button>
                </div>
                {showTimestamps && (
                  <div className="max-h-64 overflow-y-auto text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-primary)] rounded-lg p-3">
                    <pre>{JSON.stringify(JSON.parse(project.transcriptJson), null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Special Prompt */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={20} />
          Step 2: Generate Video Prompts
        </h2>

        <div className="mb-4">
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            Special prompt (your style instructions for Gemini)
          </label>
          <textarea
            value={specialPrompt}
            onChange={(e) => setSpecialPrompt(e.target.value)}
            rows={6}
            placeholder="Enter your special prompt that defines the visual style, mood, and details for video generation..."
            className="w-full text-sm resize-y min-h-[100px]"
          />
        </div>

        <button
          onClick={handleGeneratePrompts}
          disabled={generating || !project.transcriptTxt}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating prompts...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Prompts
            </>
          )}
        </button>
      </div>

      {/* Step 3: Prompts list */}
      {prompts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Generated Prompts ({prompts.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAllPrompts}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--border-light)] rounded-lg text-sm transition-colors"
              >
                <Copy size={14} />
                {copied ? "Copied!" : "Copy All"}
              </button>
              <button
                onClick={downloadPrompts}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--border-light)] rounded-lg text-sm transition-colors"
              >
                <Download size={14} />
                Download JSON
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {prompts.map((prompt, i) => (
              <div
                key={i}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 text-sm"
              >
                <span className="text-[var(--accent)] font-semibold mr-2">#{i + 1}</span>
                <span className="text-[var(--text-secondary)]">{prompt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
