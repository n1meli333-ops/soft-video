"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Search, Pencil, Plus, Copy, X, Save, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  stylePrompt: string;
  negativePrompt: string;
  techPrompt: string;
  indexFormat: string;
  isDefault: boolean;
  tag?: string;
}

export default function PromptsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
  }, []);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    setEditingTemplate({
      id: "",
      name: "New Template",
      stylePrompt: "",
      negativePrompt: "",
      techPrompt: "",
      indexFormat: "",
      isDefault: false,
    });
    setIsNewTemplate(true);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    setSaving(true);

    if (isNewTemplate) {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });
      const created = await res.json();
      setTemplates((t) => [created, ...t]);
    } else {
      await fetch(`/api/templates/${editingTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });
      setTemplates((t) =>
        t.map((tmpl) => (tmpl.id === editingTemplate.id ? editingTemplate : tmpl))
      );
    }

    setEditingTemplate(null);
    setIsNewTemplate(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates((t) => t.filter((tmpl) => tmpl.id !== id));
  };

  const handleCopy = async (template: Template) => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...template,
        id: undefined,
        name: `${template.name} (copy)`,
      }),
    });
    const created = await res.json();
    setTemplates((t) => [created, ...t]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm">
            <span>All</span>
            <span className="text-[var(--text-muted)] text-xs">{templates.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (editingTemplate) {
                setEditingTemplate(null);
                setIsNewTemplate(false);
              }
            }}
            className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Pencil size={16} />
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search prompt"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-[180px] text-sm rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {editingTemplate ? (
          /* Template Editor */
          <div className="max-w-2xl mx-auto bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold mb-2">
              {isNewTemplate ? "Create New Prompt" : "Edit Prompt"}
            </h3>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Template Name</label>
              <input
                type="text"
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                className="w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Style Prompt</label>
              <textarea
                value={editingTemplate.stylePrompt}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, stylePrompt: e.target.value })}
                rows={4}
                placeholder="Visual style, mood, color palette, camera angles..."
                className="w-full text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Negative Prompt</label>
              <textarea
                value={editingTemplate.negativePrompt}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, negativePrompt: e.target.value })}
                rows={3}
                placeholder="What to avoid: blur, low quality, text..."
                className="w-full text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Tech Prompt</label>
              <textarea
                value={editingTemplate.techPrompt}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, techPrompt: e.target.value })}
                rows={3}
                placeholder="Technical instructions for prompt generation..."
                className="w-full text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Index Format</label>
              <input
                type="text"
                value={editingTemplate.indexFormat}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, indexFormat: e.target.value })}
                placeholder='e.g. "1. [prompt text]"'
                className="w-full text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Save size={14} />
                Save
              </button>
              <button
                onClick={() => { setEditingTemplate(null); setIsNewTemplate(false); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-sm transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-muted)]">
            {search ? "No matching templates" : "No prompts yet"}
          </div>
        ) : (
          /* Template Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 hover:border-[var(--border-light)] transition-all group cursor-pointer"
                onClick={() => { setEditingTemplate(template); setIsNewTemplate(false); }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {template.name}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(template); }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {template.stylePrompt
                    ? template.stylePrompt.slice(0, 60) + (template.stylePrompt.length > 60 ? "..." : "")
                    : "No tag"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action */}
      {!editingTemplate && (
        <div className="flex justify-end px-6 py-4 border-t border-[var(--border-color)]">
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-medium transition-colors"
          >
            Create new prompt
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
