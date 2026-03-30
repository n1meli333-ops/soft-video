import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

export async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`
  );
  return parseFloat(stdout.trim());
}

export async function renderVideo(
  projectDir: string,
  audioPath: string,
  fragmentPaths: string[],
  outputPath: string
): Promise<void> {
  const listFile = path.join(projectDir, "fragments.txt");
  const lines = fragmentPaths.map((p) => `file '${p}'`).join("\n");
  await fs.writeFile(listFile, lines, "utf-8");

  // Concatenate video fragments
  const concatPath = path.join(projectDir, "concat.mp4");
  await execAsync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${concatPath}"`
  );

  // Merge with audio
  await execAsync(
    `ffmpeg -y -i "${concatPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}"`
  );

  // Cleanup temp files
  await fs.unlink(listFile).catch(() => {});
  await fs.unlink(concatPath).catch(() => {});
}

export async function getVideoDuration(videoPath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`
  );
  return parseFloat(stdout.trim());
}
