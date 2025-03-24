import { resolve, normalize, join, dirname } from "node:path";
import { stat } from "node:fs/promises";
import ffprobe, { type FFProbeResult } from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import { tryCatch } from "./tryCatch";
import { err } from "./logs";
import { convertTimeToMinutes } from "./converter";
import { round } from "./round";

interface VideoInfoReturn {
    path: string;
    size: number;
    duration: number;
    mbMin: number;
}

export class VideoFile {
    path: string;
    dir: string;

    constructor(filePath: string) {
        this.path = resolve(normalize(filePath));
        this.dir = dirname(this.path);
    }

    size(): number {
        const videoFile = Bun.file(this.path);
        return round(videoFile.size / 1024 / 1024, 2);
    }

    async exists(): Promise<boolean> {
        try {
            await stat(this.path);
            return true;
        } catch (_) {
            return false;
        }
    }

    async delete() {
        const { data, error } = await tryCatch(Bun.file(this.path).delete());
        if (error) {
            err(`Error while deleting file: ${this.path}`, error);
            process.exit(1);
        }
    }

    async info(): Promise<VideoInfoReturn | undefined> {
        const { data: probeInfo, error: probeErr } = await tryCatch<FFProbeResult>(
            ffprobe(this.path, {
                path: ffprobeStatic.path,
            })
        );

        // Check for errors
        if (probeErr) {
            err("Probing file", probeErr);
            return;
        }

        if (!probeInfo?.streams) {
            err("No streams?", null);
            return;
        }

        // Get video duration from video stram
        const videoStream = probeInfo.streams.find((s) => s.codec_type === "video");

        let duration = 0;
        if (videoStream) {
            // Get duration from video info
            const durationStr = videoStream.duration;
            // If duration not found as main, then rely on tags
            if (durationStr) {
                duration = round(parseFloat(durationStr) / 60, 4);
            } else {
                // Check duration from tags if not found in main info
                duration = convertTimeToMinutes(videoStream.tags.DURATION) || 0;
            }
        }

        // Get size
        const size = this.size();

        return {
            path: this.path,
            size,
            duration,
            mbMin: round(size / duration, 2),
        };
    }

    async transcode() {}
}
