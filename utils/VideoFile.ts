import { resolve, normalize, join, dirname } from "node:path";
import { stat } from "node:fs/promises";
import ffprobe, { type FFProbeResult } from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import { tryCatch } from "./tryCatch";
import { convertTimeToMinutes } from "./converter";
import { round } from "./round";
import { $ } from "bun";
import { logs } from "./LogsClass";

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
            logs.err(`Error while deleting file: ${this.path}`, error);
            process.exit(1);
        }
    }

    async info(): Promise<VideoInfoReturn> {
        const probeInfo = await ffprobe(this.path, {
            path: ffprobeStatic.path,
        });

        if (!probeInfo?.streams) {
            throw new Error("Video file has no streams");
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

            // If duration is still 0, then try to take anything that says duration from tags
            if (duration === 0) {
                const tagKeys = Object.keys(videoStream.tags);
                const foundTag = tagKeys.find((k) => k.toLowerCase().includes("duration"));

                if (foundTag) {
                    duration = convertTimeToMinutes(videoStream.tags[foundTag]) || 0;
                }
            }

            // If its still fucking 0, then we are doing last resort
            // Bring out heavy cannoons, the ffprobe itself nigga
            if (duration === 0) {
                duration = await this.FFprobeShellGetDuration();
            }
        }

        if (!duration) {
            throw new Error(`${this.path} duration is "${duration}"`);
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

    // Last resort to get the duration from video
    async FFprobeShellGetDuration() {
        // Make sure 'filePath' variable holds the path to ya video
        const cmdOutput =
            await $`"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${this.path}"`.text();
        const durationSecondsStr = cmdOutput.trim();

        // Check if ffprobe gave any output
        if (durationSecondsStr) {
            const durationSeconds = parseFloat(durationSecondsStr);
            if (!isNaN(durationSeconds)) {
                // Return duration from shell
                let duration = round(durationSeconds / 60, 4); // Convert seconds to minutes, keep it clean
                return duration;
            } else {
                throw new Error("ffprobe spittin' nonsense, couldn't parse:" + durationSecondsStr);
            }
        } else {
            throw new Error("Silent treatment from ffprobe, empty output");
        }
    }
}
