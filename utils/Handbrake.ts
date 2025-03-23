import { type HandbrakeOptions } from "handbrake-js";
import type { VideoFile } from "./VideoFile";
import { resolve, normalize } from "node:path";
import { readFileSync } from "node:fs";

interface HBClassOptions {
    preset: string;
    seconds: number;
    quality?: number | undefined;
}

export default class Handbrake {
    // @ts-ignore // Need to ignore, because we dont use constructor
    options: HandbrakeOptions;

    constructor() {}

    // Function to initiate handbrake class, since constructor cannot be async
    async init(video: VideoFile, output: VideoFile, options: HBClassOptions, customOptions: HandbrakeOptions = {}) {
        // Get preset name
        const presetPath = resolve(normalize(options.preset));
        const preset = JSON.parse(readFileSync(presetPath, "utf-8"));

        if (preset.PresetList.length === 0) {
            throw new Error("Invalid preset file");
        }

        // Get video video
        const videoInfo = await video.info();
        if (!videoInfo) {
            throw new Error("Video info is undefined");
        }

        this.options = {
            input: video.path,
            output: output.path,
            preset: preset.PresetList[0].PresetName,
            "preset-import-file": presetPath,
            "start-at": `seconds:${(videoInfo.duration * 60) / 2}`,
            "stop-at": `seconds:${options.seconds}`,
            quality: options.quality,
            ...customOptions,
        };
    }
}
