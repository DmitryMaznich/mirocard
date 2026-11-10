// Dev-only frame extraction. The original video and frames never enter the deck.
// Requires ffmpeg and ffprobe on PATH. No shell or new npm dependencies.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join, basename, extname } from "node:path";

const [input, destination, period = "6"] = process.argv.slice(2);
if (!input) throw new Error("Usage: node tools/drawing/prepare-video.mjs <video> [output-directory] [interval-seconds]");
const interval = Number(period);
if (!Number.isFinite(interval) || interval < 1 || interval > 60) throw new Error("Interval must be between 1 and 60 seconds");
const video = resolve(input);
const output = resolve(destination ?? join("output/drawing-video", basename(video, extname(video))));
mkdirSync(output, { recursive: true });
if (readdirSync(output).length) throw new Error("Choose an empty output directory to avoid mixing reference frames");
const metadata = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", video], { encoding: "utf8" }));
execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `select='isnan(prev_selected_t)+gte(t-prev_selected_t,${interval})'`, "-fps_mode", "vfr", join(output, "frame-%04d.jpg")], { stdio: "inherit" });
const frames = readdirSync(output).filter(name => /^frame-\d+\.jpg$/.test(name)).sort();
execFileSync("ffmpeg", ["-v", "error", "-i", join(output, "frame-%04d.jpg"), "-vf", `scale=320:-1,tile=5x${Math.ceil(frames.length / 5)}`, "-frames:v", "1", join(output, "contact.jpg")], { stdio: "inherit" });
writeFileSync(join(output, "reference.json"), JSON.stringify({ input: basename(video), metadata, interval, frames: frames.map((file, i) => ({ file, approximateSeconds: i * interval })) }, null, 2) + "\n");
console.log(`${frames.length} reference frames and contact.jpg → ${output}`);
