import Link from "next/link";
import { prisma } from "@/lib/db";
import { CreateProjectButton } from "@/components/CreateProjectButton";

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
            IA
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">IntensAI</h1>
          <span className="text-xs text-[var(--text-muted)] ml-2">v0.2.1</span>
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
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-light)] transition-all"
              >
                <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                    project.status === "completed"
                      ? "bg-green-900/30 text-green-400"
                      : project.status === "draft"
                      ? "bg-gray-800/30 text-gray-400"
                      : "bg-yellow-900/30 text-yellow-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      project.status === "completed"
                        ? "bg-green-400"
                        : project.status === "draft"
                        ? "bg-gray-400"
                        : "bg-yellow-400"
                    }`} />
                    {project.status}
                  </span>
                  <span>{project._count.fragments} fragments</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
