import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";
import { ActivityPanel } from "@/components/ActivityPanel";
import { notFound } from "next/navigation";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-screen">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)] border-b border-[var(--border-color)] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">v0.3.0</span>
        </div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Aura-I</h1>
        <div />
      </div>

      <div className="flex w-full mt-[44px]">
        <Sidebar projectId={project.id} projectName={project.name} />
        <main className="flex-1 overflow-auto min-h-[calc(100vh-44px)]">{children}</main>
        <ActivityPanel projectId={project.id} />
      </div>
    </div>
  );
}
