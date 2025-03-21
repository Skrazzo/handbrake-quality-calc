import { resolve, normalize, join } from "node:path";
import ffprobe, { type FFProbeResult } from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import { tryCatch } from "./tryCatch";
import { err } from "./logs";
import { convertTimeToMinutes } from "./converter";

interface VideoInfoReturn {
    path: string;
    size: number;
    duration: number;
    mbMin: number;
}

export class VideoFile {
    path: string;

    constructor(filePath: string) {
        this.path = resolve(normalize(filePath));
    }

    size(): number {
        const videoFile = Bun.file(this.path);
        return videoFile.size / 1024 / 1024;
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
            duration = convertTimeToMinutes(videoStream.tags.DURATION) || 0;
        }

        // Get size
        const size = this.size();

        return {
            path: this.path,
            size,
            duration,
            mbMin: size / duration,
        };
    }
}
