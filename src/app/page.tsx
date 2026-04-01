import Link from "next/link";
import { prisma } from "@/lib/db";
import { CreateProjectButton } from "@/components/CreateProjectButton";
import { ProjectCard } from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { fragments: true } },
    },
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white font-bold text-sm">
            AI
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Aura-I</h1>
          <span className="text-xs text-[var(--text-muted)] ml-2">v0.3.0</span>
        </div>
        <CreateProjectButton />
      </header>

      {/* Projects grid */}
      <main className="p-8">
        <h2 className="text-2xl font-bold mb-6">Projects</h2>
        {projects.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)]">
            <p className="text-lg mb-4">No projects yet</p>
            <p className="text-sm">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                status={project.status}
                fragmentCount={project._count.fragments}
                progress={project.progress}
                updatedAt={project.updatedAt.toISOString()}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
