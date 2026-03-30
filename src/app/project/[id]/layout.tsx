import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";
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
      <Sidebar projectId={project.id} projectName={project.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
