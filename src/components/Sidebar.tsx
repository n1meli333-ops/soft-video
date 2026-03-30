"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FileText, Film, ChevronLeft } from "lucide-react";

interface SidebarProps {
  projectId: string;
  projectName: string;
}

export function Sidebar({ projectId, projectName }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/project/${projectId}`;

  const links = [
    { href: basePath, label: "General", icon: Settings, exact: true },
    { href: `${basePath}/prompts`, label: "Prompts", icon: FileText },
    { href: `${basePath}/generations`, label: "Generations", icon: Film },
  ];

  return (
    <aside className="w-[240px] min-h-screen border-r border-[var(--border-color)] bg-[var(--bg-primary)]/50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm mb-3"
        >
          <ChevronLeft size={16} />
          Back to projects
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg flex items-center justify-center">
            <Film size={14} className="text-[var(--text-secondary)]" />
          </div>
          <span className="font-medium text-sm truncate">{projectName}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
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

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
        IntensAI v0.1.0
      </div>
    </aside>
  );
}
