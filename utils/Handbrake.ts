import hb, { type HandbrakeOptions } from "handbrake-js";
import { VideoFile } from "./VideoFile";
import { resolve, normalize, join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { tryCatch } from "./tryCatch";
import { basename } from "node:path/win32";
import { logs } from "./LogsClass";
import { randomUUIDv7 } from "bun";
import calculateIncrement from "./CalculateQualityIncrement";

interface HBClassOptions {
    preset: string;
    seconds: number;
    quality?: number | undefined;
    range: TargetMBRange;
    splitPieces?: number; // Used for splitting file, and finding best mb/min
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

        // set split pieces
        if (options.splitPieces) {
            this.splitPieces = options.splitPieces;
        }

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
            quality: options.quality || presetQuality,
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

        const { data: handbrakeInfo, error: handbrakeError } = await tryCatch(
            hb.run({
                ...this.options,
                input: input.path,
                output: output.path,
                "start-at": `seconds:${Math.round(from)}`,
                "stop-at": `seconds:${Math.round(seconds)}`,
            })
        );

        if (handbrakeError) {
            logs.err(`Error while transcoding ${this.options.input}`, handbrakeError);
            process.exit(1);
        }

        return await output.info();
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
                logs.err(
                    `Error while transcoding: ${options?.input || "Empty path variable"}`,
                    error
                );
                reject(error);
            });

            proc.on("output", console.log);

            proc.on("complete", () => {
                resolve();
            });
        });
    }

    async findQuality(): Promise<HandbrakeOptions> {
        this.checkInit();

        if (!this.splitPieces) {
            throw new Error("Split pieces are empty, how tf did that happen?");
        }

        const tmpFiles = [];
        for (let i = 0; i < this.splitPieces; i++) {
            tmpFiles.push(new VideoFile(join(this.input.dir, `${randomUUIDv7()}-tmp.mp4`)));
        }

        // Transcode parts
        const originalInfo = await this.input.info();
        if (!originalInfo) {
            throw new Error("Original info is undefined");
        }

        const minutesStep = originalInfo.duration / (this.splitPieces + 1);
        let allMBMin = 0; // Sum to get avg later

        logs.verbose(`Trying to predict output MB/min with quality: ${this.options.quality}`);

        for (let i = 0; i < tmpFiles.length; i++) {
            const fromSeconds = Math.round(minutesStep * (i + 1)) * 60;

            logs.verbose(`${i + 1} transcoding from ${fromSeconds} seconds`);
            logs.verbose("transcoding", basename(tmpFiles[i].path));

            const info = await this.transcode({
                from: fromSeconds,
                output: tmpFiles[i],
            });

            if (!info) {
                throw new Error(`Could not get info from file ${this.output.path}`);
            }

            allMBMin += info.mbMin;
            logs.verbose(`Output file ${info.mbMin} MB/min`);

            await tmpFiles[i].delete();
        }

        const mbMinAvg = allMBMin / this.splitPieces;
        logs.info(`${this.options.quality} quality average: ${mbMinAvg} MB/min`);

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

            this.options.quality -= calculateIncrement(mbMinAvg, this.range.min);
            // Recall yourself
            return await this.findQuality();
        }

        // Too much, increase quality (decrease size)
        if (mbMinAvg >= this.range.max) {
            if (!this.options.quality)
                throw new Error(
                    `Quality is undefined ("${this.options.quality}") how tf did that happen?`
                );

            this.options.quality += calculateIncrement(mbMinAvg, this.range.max);
            // Recall yourself
            return await this.findQuality();
        }

        return this.options;
    }
}
