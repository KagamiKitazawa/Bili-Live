import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import path from "path";

const processes = new Map<number, ChildProcessWithoutNullStreams>();

function ensureOutputDir(): string {
  const dir = path.resolve(process.cwd(), "hls");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function ensureTranscode(roomId: number, sourceUrl: string): string {
  const dir = ensureOutputDir();
  const outputPath = path.join(dir, `room_${roomId}.m3u8`);

  if (!processes.has(roomId)) {
    const args = [
      "-re",
      "-i",
      sourceUrl,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-f",
      "hls",
      "-hls_time",
      "4",
      "-hls_list_size",
      "5",
      "-hls_flags",
      "delete_segments+append_list",
      outputPath
    ];

    const proc = spawn("ffmpeg", args, {
      stdio: "ignore"
    });

    processes.set(roomId, proc);

    proc.on("exit", () => {
      processes.delete(roomId);
    });
    proc.on("error", () => {
      processes.delete(roomId);
    });
  }

  // 前端访问的相对 URL，由 Express 静态目录提供
  return `/hls/room_${roomId}.m3u8`;
}

