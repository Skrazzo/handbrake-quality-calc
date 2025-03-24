import { err, log } from "./utils/logs";
import path, { basename, extname, join } from "path";
import { type ProcessArguments, loadArguments } from "./utils/Arguments";
import { resolve } from "path";
import { readdir, mkdir } from "fs/promises";
import { getDestinationFolderName, getMoviesFiles } from "./utils/Files";
import { VideoFile } from "./utils/VideoFile";
import Handbrake from "./utils/Handbrake";

loadArguments();

const presetFile = path.join(__dirname, "preset.json");

export async function processFiles(args: ProcessArguments) {
    // Get output directory
    const outputDir = Bun.env.OUTPUT_DIR;
    if (!outputDir) throw new Error("OUTPUT_DIR cannot be empty");

    const convertExt = Bun.env.CONVERT_TO;
    if (!convertExt) throw new Error("CONVERT_TO cannot be empty");

    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);

        // For faster quality lookups, save previous found quality factor
        let previousQuality: number | undefined = undefined;

        // Go through each file, get best quality, and transcode it
        for (const file of files) {
            // TODO: Quality specify increments
            // TODO: When testing files, take previous found quality

            // Define input and output file
            const inputFile = new VideoFile(file);
            const outputFile = new VideoFile(
                join(outputDir, getDestinationFolderName(file), basename(file).replace(extname(file), convertExt))
            );

            // Check if output already exists. We skip unless overwrite enabled
            if ((await outputFile.exists()) && !args.overwrite) {
                log(`Skipping file ${outputFile.path.replace(outputDir, "")}`);
                continue;
            }

            // Create output directories
            try {
                await mkdir(outputFile.dir, { recursive: true });
            } catch (error) {
                err("Creating output directory", error as Error);
            }

            log(`Input file: ${inputFile.path.replace(outputDir, "")}`);
            log(`Output file: ${outputFile.path.replace(outputDir, "")}`);

            const hb = new Handbrake();
            await hb.init(inputFile, outputFile, {
                preset: presetFile,
                seconds: 30,
                range: { min: 11, max: 14 },
                quality: previousQuality,
            });

            try {
                log("Finding best quality factor");
                await hb.findQuality();
            } catch (error) {
                err("While finding quality", error as Error);
                log("NIGGANIGGA");
            }

            // Set previous quality
            previousQuality = hb.options.quality;

            // After finding quality, encode video
            try {
                await hb.spawnTranscode({});
            } catch (error) {
                err(`Transcoding ${outputFile.path}`, error as Error);
            }
        }
    }
}

// const originalVideoPath = "/Users/skrazzo/Downloads/handbrake/The.Electric.State.2025.REAL.1080p.WEB.h264-ETHEL.mkv";
// const video = new VideoFile(originalVideoPath);
// const output = new VideoFile(path.join(path.dirname(originalVideoPath), "The electric state 2025.mp4"));

// const HB = new Handbrake();
// await HB.init(video, output, {
//     preset: presetFile,
//     seconds: 120,
//     range: { min: 10, max: 12 },
// });
// await HB.findQuality();

// await HB.spawnTranscode({ all: false });
// log("Finished");
