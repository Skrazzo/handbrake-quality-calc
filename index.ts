import { basename, extname, join } from "path";
import { type InfoArguments, type ProcessArguments, loadArguments } from "./utils/Arguments";
import { mkdir } from "fs/promises";
import { getDestinationFolderName, getMoviesFiles } from "./utils/Files";
import { VideoFile } from "./utils/VideoFile";
import Handbrake from "./utils/Handbrake";
import {
    BINARY_QUALITY_RANGE,
    CONVERT_TO,
    MAX_ITERATIONS,
    OUTPUT_DIR,
    PRESET_FILE,
    RANGE,
    SECONDS,
    SPLITS,
} from "./consts";
import { logs } from "./utils/LogsClass";
import { tryCatch } from "./utils/tryCatch";

loadArguments();

export async function processFiles(args: ProcessArguments) {
    // Get output directory
    const outputDir = OUTPUT_DIR;
    if (!outputDir) throw new Error("OUTPUT_DIR cannot be empty");

    const convertExt = CONVERT_TO;
    if (!convertExt) throw new Error("CONVERT_TO cannot be empty");

    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);

        // For faster quality lookups, save previous found quality factor
        let previousQuality: number | undefined = args.quality;
        if (previousQuality) {
            if (
                previousQuality < BINARY_QUALITY_RANGE[0] ||
                previousQuality > BINARY_QUALITY_RANGE[1]
            ) {
                logs.err(
                    `Quality needs to be in the range of ${BINARY_QUALITY_RANGE[0]} - ${BINARY_QUALITY_RANGE[1]}`
                );
                process.exit(1);
            }
        }

        // Go through each file, get best quality, and transcode it
        for (const file of files) {
            // TODO: Output dir from consts cannot be overwritten by arguments.... bad

            // Define input and output file
            const inputFile = new VideoFile(file);
            const outputFile = new VideoFile(
                join(
                    outputDir,
                    getDestinationFolderName(file),
                    basename(file).replace(extname(file), convertExt)
                )
            );

            // Check for tmp file
            const tmpFileRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-tmp\.mp4$/i;

            if (tmpFileRegex.test(basename(inputFile.path))) {
                const { error } = await tryCatch(inputFile.delete());
                if (error) {
                    logs.err("Deleting tmp file", error);
                    process.exit(1);
                }

                logs.verbose("Deleted old tmp file");
                continue;
            }

            // Check if output already exists. We skip unless overwrite enabled
            if ((await outputFile.exists()) && !args.overwrite) {
                logs.verbose(`Skipping file ${outputFile.path.replace(outputDir, "")}`);
                continue;
            }

            // Create output directories
            try {
                await mkdir(outputFile.dir, { recursive: true });
            } catch (error) {
                logs.err("Creating output directory", error as Error);
            }

            logs.info(`Input file: ${inputFile.path.replace(path, "")}`);
            logs.info(`Output file: ${outputFile.path.replace(outputDir, "")}`);

            const hb = new Handbrake();
            await hb.init(inputFile, outputFile, {
                preset: PRESET_FILE,
                seconds: SECONDS,
                range: RANGE,
                splitPieces: SPLITS,
                binary: {
                    min: BINARY_QUALITY_RANGE[0],
                    max: BINARY_QUALITY_RANGE[1],
                    iterations: { max: MAX_ITERATIONS, current: 1 },
                },
            });

            // Find best quality factor
            try {
                logs.verbose(
                    `Finding best quality factor for ${hb.range.min} - ${hb.range.max} MB/min`
                );
                await hb.findQuality(previousQuality);
            } catch (error) {
                logs.err("While finding quality", error as Error);
                process.exit(1);
            }

            // Set previous quality
            previousQuality = hb.options.quality;

            // After finding quality, encode video
            try {
                await hb.spawnTranscode({});
            } catch (error) {
                logs.err(`Transcoding ${outputFile.path}`, error as Error);
            }
        }
    }
}

export async function displayFileInfo(args: InfoArguments) {
    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);

        for (const file of files) {
            const video = new VideoFile(file);
            const { data: videoInfo, error } = await tryCatch(video.info());

            if (error) {
                logs.err("Error while probing video file", error);
                process.exit(1);
            }

            let shortenedPath = videoInfo.path.replace(path, "");
            if (shortenedPath.trim() === "") shortenedPath = basename(videoInfo.path);

            const logText = `${videoInfo.mbMin} MB/min -> ${shortenedPath}`;
            if (videoInfo.mbMin > RANGE.max) {
                logs.err(logText);
            } else {
                logs.info(logText);
            }
        }
    }
}
