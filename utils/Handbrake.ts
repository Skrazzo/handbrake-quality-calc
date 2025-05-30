import hb, { type HandbrakeOptions } from "handbrake-js";
import { VideoFile } from "./VideoFile";
import { resolve, normalize, join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { tryCatch } from "./tryCatch";
import { basename } from "node:path/win32";
import { logs } from "./LogsClass";
import { randomUUIDv7 } from "bun";
import { round } from "./round";
import { Writable } from "stream"; // Make sure to import this
import { INVERTED_SEARCHING, RANGE_OF_ERROR, MAX_ITERATIONS } from "../consts";
import calculateIncrement from "./CalculateQualityIncrement";

interface HBClassOptions {
    preset: string;
    seconds: number;
    quality?: number | undefined;
    range: TargetMBRange;
    splitPieces?: number; // Used for splitting file, and finding best mb/min
    binary?: BinarySearch;
}

interface BinarySearch {
    min: number;
    max: number;
    iterations: {
        max: number;
        current: number;
    };
}

interface TargetMBRange {
    min: number;
    max: number;
}

interface TranscodeProps {
    from: number;
    seconds?: number;
    output?: VideoFile;
    input?: VideoFile;
}

// Helper to get terminal width, default to 80 if not available
const getTerminalWidth = () => process.stdout.columns || 80;

// Helper to clear the line
const clearLine = (stream: Writable = process.stdout) => {
    stream.write("\r" + " ".repeat(getTerminalWidth()) + "\r");
};

export default class Handbrake {
    // @ts-ignore // Need to ignore, because we dont use constructor
    options: HandbrakeOptions;
    // @ts-ignore
    input: VideoFile;
    // @ts-ignore
    output: VideoFile;
    // @ts-ignore
    range: TargetMBRange;
    // @ts-ignore
    splitPieces: HBClassOptions["splitPieces"] = 3;
    // @ts-ignore
    seconds: number = 30;
    // @ts-ignore
    binary: HBClassOptions["binary"] = { min: 1, max: 100, iterations: { max: 20, current: 1 } };
    // @ts-ignore
    searchIterations: number = 0;

    initiated: boolean = false;

    constructor() {}

    // Function that checks if Handbrake class was initiated
    checkInit() {
        if (!this.initiated) throw new Error("Class isn't initiated. Run init()");
    }

    // Function to initiate handbrake class, since constructor cannot be async
    async init(
        video: VideoFile,
        output: VideoFile,
        options: HBClassOptions,
        customOptions: HandbrakeOptions = {}
    ) {
        // VideoFile
        this.input = video;
        this.output = output;

        // Get preset name
        const presetPath = resolve(normalize(options.preset));
        const preset = JSON.parse(readFileSync(presetPath, "utf-8"));

        if (preset.PresetList.length === 0) {
            throw new Error("Invalid preset file");
        }

        // set seconds to transcode
        if (options.seconds) this.seconds = options.seconds;

        // Set range for wanted output video file
        this.range = options.range;

        // Check files range if file is smaller than max, we need to reduce max and min range
        const { data: info, error: fileInfoError } = await tryCatch(video.info());
        if (fileInfoError) {
            logs.err(`While getting info from ${video.path}`, fileInfoError);
            process.exit(1);
        }

        // If file is smaller than range max, modify min and max range for transcoding
        if (info.mbMin < this.range.max) {
            this.range.max = info.mbMin;
            this.range.min = this.range.max - 2;
            logs.warn(
                `${basename(video.path)} is ${info.mbMin} MB/min, less than range max MB/min. Reduced range to ${this.range.min} - ${this.range.max} MB/min`
            );
        }

        // set split pieces
        if (options.splitPieces) {
            this.splitPieces = options.splitPieces;
        }

        // Split binary search start min and max
        if (options.binary) this.binary = options.binary;

        // Get preset quality
        let presetQuality = 22; // Default quality (will be used if not set options.quality or preset quality)
        if (!options.quality) {
            // Set preset quality to a variable, if options isn't specified
            const tmp = preset.PresetList[0].VideoQualitySlider;
            if (tmp) {
                logs.verbose(`Using preset quality: ${tmp}`);
                presetQuality = tmp;
            }
        } else {
            // Take quality from options
            logs.verbose(`Using provided start quality: ${options.quality}`);
            presetQuality = options.quality;
        }

        this.options = {
            input: video.path,
            output: output.path,
            preset: preset.PresetList[0].PresetName,
            "preset-import-file": presetPath,
            quality: presetQuality,

            ...customOptions,
        };

        // Mark class as initiated
        this.initiated = true;
    }

    async transcode({
        from,
        seconds = this.seconds,
        input = this.input,
        output = this.output,
    }: TranscodeProps) {
        this.checkInit();

        const { error: handbrakeError } = await tryCatch(
            hb.run({
                ...this.options,
                input: input.path,
                output: output.path,
                "start-at": `seconds:${Math.round(from)}`,
                "stop-at": `seconds:${Math.round(seconds)}`,
                subtitle: "none",
            })
        );

        if (handbrakeError) {
            logs.err(`Error while transcoding ${this.options.input}`, handbrakeError);
            process.exit(1);
        }

        return await output.info();
    }

    async spawnTranscode(): Promise<void> {
        const options = { ...this.options };

        await new Promise<void>((resolve, reject) => {
            logs.verbose(`Spawning transcode with quality: ${options.quality}`);
            const proc = hb.spawn(options);

            let lastOutput = ""; // Keep track of the last output

            proc.on("error", (error) => {
                clearLine(); // Clear progress line before error
                logs.err(
                    `Error while transcoding: ${options?.input || "Empty path variable"}`,
                    error
                );
                reject(error);
            });

            proc.on("output", (output) => {
                const outputStr = String(output).trimEnd(); // Clean up the output string

                // Ignore empty lines or buffer messages if they cause issues
                if (!outputStr || outputStr.startsWith("<Buffer")) {
                    return;
                }

                // Calculate padding to clear the rest of the line
                const padding = Math.max(0, getTerminalWidth() - outputStr.length);
                // Write \r, the output, and padding spaces
                process.stdout.write("\r" + outputStr + " ".repeat(padding));
                lastOutput = outputStr; // Store for potential clearing later
            });

            proc.on("complete", () => {
                clearLine(); // Clear the final progress line
                logs.verbose("Transcoding complete with quality:", this.options.quality, "🔥"); // Final message on a new line
                resolve();
            });

            // Handle process exit/close as well for cleanup
            const cleanup = () => {
                clearLine(); // Ensure line is clear if process exits unexpectedly
            };
            proc.on("complete", cleanup);
            proc.on("end", cleanup);
        });
    }

    async findQuality(): Promise<HandbrakeOptions> {
        this.checkInit();

        if (!this.options.quality) {
            throw new Error("Quality is undefined, how tf did that happen?");
        }

        if (this.searchIterations >= MAX_ITERATIONS) {
            return this.options;
        }

        // Calculate average
        const mbMinAvg = await this.testQualityWithSamples();
        logs.info(`${this.options.quality} quality average: ${round(mbMinAvg, 2)} MB/min`);

        // Check for mbMinAvg, and compare it to the range
        if (mbMinAvg > this.range.min && mbMinAvg < this.range.max) {
            // Good range, return
            return this.options;
        }

        // Too little, decrease quality (increase size)
        if (mbMinAvg <= this.range.min) {
            if (!this.options.quality)
                throw new Error(
                    `Quality is undefined ("${this.options.quality}") how tf did that happen?`
                );

            // If quality is too little, we increase it
            const increment = calculateIncrement(mbMinAvg, this.range.min);
            if (INVERTED_SEARCHING) {
                this.options.quality += increment;
            } else {
                this.options.quality -= increment;
            }

            // Recall yourself
            return await this.findQuality();
        }

        // Too much, increase quality (decrease size)
        if (mbMinAvg >= this.range.max) {
            if (!this.options.quality)
                throw new Error(
                    `Quality is undefined ("${this.options.quality}") how tf did that happen?`
                );

            // If quality is too big, we decrease it
            const increment = calculateIncrement(mbMinAvg, this.range.max);
            if (INVERTED_SEARCHING) {
                this.options.quality -= increment;
            } else {
                this.options.quality += increment;
            }

            // Recall yourself
            this.searchIterations += 1;
            return await this.findQuality();
        }

        return this.options;
    }

    async binarySearchQuality(): Promise<HandbrakeOptions> {
        this.checkInit();

        logs.info(`Performing binary search for: ${basename(this.input.path)}`);
        if (!this.binary) throw new Error("Binary is undefined");

        // Stop if max iterations reached
        if (this.binary.iterations.current >= this.binary.iterations.max) {
            logs.warn("Max iterations reached. Using current quality.");
            return this.options;
        }
        this.binary.iterations.current++;

        // Calculate midpoint quality
        const midQuality = Math.round((this.binary.min + this.binary.max) / 2);
        this.options.quality = midQuality;

        // Test this quality by transcoding samples
        const mbMinAvg = await this.testQualityWithSamples();
        logs.info(`Quality ${this.options.quality} → ${round(mbMinAvg, 3)} MB/min`);

        // Check if we hit the target range
        if (mbMinAvg >= this.range.min && mbMinAvg <= this.range.max) {
            return this.options; // Success!
        }

        // Adjust binary search range
        if (INVERTED_SEARCHING ? mbMinAvg > this.range.max : mbMinAvg < this.range.min) {
            // File too big → lower quality (lower CQ = smaller file)
            this.binary.max = this.options.quality - 1;
        } else {
            // File too small → higher quality (higher CQ = bigger file)
            this.binary.min = this.options.quality + 1;
        }

        // Repeat with narrowed range
        return this.findQuality();
    }

    // Helper: Test a specific quality by transcoding samples
    private async testQualityWithSamples(): Promise<number> {
        if (!this.splitPieces) throw new Error("Split pieces not set");
        if (!this.options.quality) throw new Error("options.quality is undefined");

        const tmpFiles: VideoFile[] = [];
        for (let i = 0; i < this.splitPieces; i++) {
            tmpFiles.push(new VideoFile(join(this.input.dir, `${randomUUIDv7()}-tmp.mp4`)));
        }

        const originalInfo = await this.input.info();
        if (!originalInfo) throw new Error("Original video info missing");

        const minutesStep = originalInfo.duration / (this.splitPieces + 1);
        let totalMBMin = 0;

        logs.verbose(`Transcoding ${this.splitPieces} splits with ${this.options.quality} quality`);

        // Transcode each sample
        for (let i = 0; i < tmpFiles.length; i++) {
            const fromSeconds = Math.round(minutesStep * (i + 1)) * 60;
            const info = await this.transcode({
                from: fromSeconds,
                output: tmpFiles[i],
            });

            logs.verbose(
                `[${i + 1}] Split file ${fromSeconds} - ${fromSeconds + this.seconds} seconds -> ${info.mbMin} MB/sec`
            );

            if (!info) throw new Error(`Failed to transcode sample ${i}`);
            totalMBMin += info.mbMin;
            await tmpFiles[i].delete();
        }

        // return totalMBMin / this.splitPieces; // Return average MB/min
        return totalMBMin / this.splitPieces + RANGE_OF_ERROR;
    }
}
