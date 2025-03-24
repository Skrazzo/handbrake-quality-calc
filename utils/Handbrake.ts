import hb, { type HandbrakeOptions } from "handbrake-js";
import { VideoFile } from "./VideoFile";
import { resolve, normalize, join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { tryCatch } from "./tryCatch";
import { err, log } from "./logs";
import { basename } from "node:path/win32";
import { randomUUIDv7 } from "bun";

interface HBClassOptions {
    preset: string;
    seconds: number;
    quality?: number | undefined;
    range: TargetMBRange;
}

interface TargetMBRange {
    min: number;
    max: number;
}

export default class Handbrake {
    // @ts-ignore // Need to ignore, because we dont use constructor
    options: HandbrakeOptions;
    // @ts-ignore
    input: VideoFile;
    // @ts-ignore
    output: VideoFile;
    // @ts-ignore
    range: TargetMBRange;
    initiated: boolean = false;

    constructor() {}

    // Function that checks if Handbrake class was initiated
    checkInit() {
        if (!this.initiated) throw new Error("Class isn't initiated. Run init()");
    }

    // Function to initiate handbrake class, since constructor cannot be async
    async init(video: VideoFile, output: VideoFile, options: HBClassOptions, customOptions: HandbrakeOptions = {}) {
        // VideoFile
        this.input = video;
        this.output = output;

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

        // Set range for wanted output video file
        this.range = options.range;

        // Get preset quality
        let presetQuality = 22; // Default quality (will be used if not set options.quality or preset quality)
        if (!options.quality) {
            // Set preset quality to a variable, if options isn't specified
            const tmp = preset.PresetList[0].VideoQualitySlider;
            if (tmp) {
                presetQuality = tmp;
            }
        }

        this.options = {
            input: video.path,
            output: output.path,
            preset: preset.PresetList[0].PresetName,
            "preset-import-file": presetPath,
            "start-at": `seconds:${(videoInfo.duration * 60) / 2}`,
            "stop-at": `seconds:${options.seconds}`,
            quality: options.quality || presetQuality,
            ...customOptions,
        };

        // Mark class as initiated
        this.initiated = true;
    }

    async transcode(customOutput: VideoFile | null = null) {
        this.checkInit();

        const { data: handbrakeInfo, error: handbrakeError } = await tryCatch(
            hb.run({
                ...this.options,
                output: customOutput ? customOutput.path : this.options.output,
            })
        );

        if (handbrakeError) {
            err(`Error while transcoding ${this.options.input}`, handbrakeError);
            process.exit(1);
        }
    }

    async spawnTranscode({ all = false }): Promise<void> {
        const options = { ...this.options };

        if (all) {
            delete options["stop-at"];
            delete options["start-at"];
        }

        await new Promise<void>((resolve, reject) => {
            const proc = hb.spawn(options);

            proc.on("error", (error) => {
                err(`Error while transcoding: ${options?.input || "Empty path variable"}`, error);
                reject(error);
            });

            proc.on("output", console.log);

            proc.on("complete", () => {
                resolve();
            });
        });
    }

    async findQuality() {
        // Create tmp file for finding quality
        const tmpFile = new VideoFile(join(dirname(this.input.path), `${randomUUIDv7()}-tmp.mp4`));

        // Do First encode, and check tmp info
        log("Doing first encode with default options");
        await this.transcode(tmpFile);

        // This is used only for logging into console
        let foundMBMin: number = 0;

        while (true) {
            const { data: info, error: infoError } = await tryCatch(tmpFile.info());

            if (infoError || !info) {
                err(`Error while getting info: ${info}`, infoError);
                process.exit(1);
            }

            // Check if file needs to be re-encoded with different options quality
            if (info.mbMin > this.range.min && info.mbMin < this.range.max) {
                foundMBMin = info.mbMin;
                break;
            }

            if (info.mbMin < this.range.min) {
                // If needed ratio is lower than min range, we need to decrease quality (will make file bigger)
                if (this.options.quality) {
                    this.options.quality -= 1;
                } else {
                    err(
                        "How did this happen? this.options.quality is undefined",
                        Error(`this.options.quality is ${this.options.quality}`)
                    );
                    process.exit(1);
                }
            }

            if (info.mbMin > this.range.max) {
                // If needed ratio is higher, then we increase quality (will decrease file size)
                if (this.options.quality) {
                    this.options.quality += 1;
                } else {
                    err(
                        "How did this happen? this.options.quality is undefined",
                        Error(`this.options.quality is ${this.options.quality}`)
                    );
                    process.exit(1);
                }
            }

            // Re-encode with new options
            log(`Starting encode with quality: ${this.options.quality}`);
            await this.transcode(tmpFile);
        }

        log(`Found quality: ${this.options.quality} -> ${foundMBMin} MB/s`);

        // Delete temporary file
        tmpFile.delete();
        log(`Tmp ${tmpFile.path} file deleted`);

        return this.options;
    }
}
