"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, FileText, RotateCcw, PanelLeft, Settings } from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  projectId: string;
  projectName: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/project/${projectId}`;
  const [collapsed, setCollapsed] = useState(false);

  const links = [
    { href: basePath, label: "General", icon: Play, exact: true },
    { href: `${basePath}/prompts`, label: "Prompts", icon: FileText },
    { href: `${basePath}/generations`, label: "Generations", icon: RotateCcw },
  ];

  if (collapsed) {
    return (
      <aside className="w-[56px] min-h-screen border-r border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex flex-col">
        <div className="p-3">
          <button
            onClick={() => setCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-card)]"
          >
            <PanelLeft size={18} />
          </button>
        </div>
        <nav className="flex-1 px-2 mt-2">
          {links.map((link) => {
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={`flex items-center justify-center w-10 h-10 rounded-lg mb-1 transition-all ${
                  isActive
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50"
                }`}
              >
                <Icon size={16} />
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-[280px] min-h-screen border-r border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex flex-col">
      {/* Toggle */}
      <div className="p-4">
        <button
          onClick={() => setCollapsed(true)}
          className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-card)]"
        >
          <PanelLeft size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {links.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                isActive
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] border-l-2 border-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50"
              }`}
            >
              <Icon size={16} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--border-color)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">@user</span>
        </div>

        <div className="space-y-2 text-xs text-[var(--text-muted)]">
          <div className="flex items-center justify-between">
            <span>Subscription</span>
            <span className="text-[var(--text-secondary)]">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Save to folder</span>
            <span className="text-[var(--text-secondary)] flex items-center gap-1">
              data/
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Theme</span>
          <div className="flex gap-1">
            <button className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]">
              Standard
            </button>
            <button className="px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              Black
            </button>
            <button className="px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              White
            </button>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
            Back to projects
          </Link>
        </div>
      </div>
    </aside>
  );
}
