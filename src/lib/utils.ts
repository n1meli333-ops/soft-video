import path from "path";
import fs from "fs/promises";

const DATA_DIR = process.env.DATA_DIR || "./data";

export function getProjectDir(projectId: string): string {
  return path.join(DATA_DIR, "projects", projectId);
}

export async function ensureProjectDir(projectId: string): Promise<string> {
  const dir = getProjectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, "fragments"), { recursive: true });
  return dir;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
