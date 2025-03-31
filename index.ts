import { basename, extname, join } from "path";
import { type InfoArguments, type ProcessArguments, loadArguments } from "./utils/Arguments";
import { mkdir } from "fs/promises";
import {
    fileExists,
    getDestinationFolderName,
    getMoviesFiles,
    getSubtitlesFiles,
} from "./utils/Files";
import { VideoFile } from "./utils/VideoFile";
import Handbrake from "./utils/Handbrake";
import {
    BINARY_QUALITY_RANGE,
    CONVERT_TO,
    MAX_ITERATIONS,
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
    const outputDir = args.output;
    if (!outputDir) throw new Error("OUTPUT_DIR cannot be empty");

    const convertExt = CONVERT_TO;
    if (!convertExt) throw new Error("CONVERT_TO cannot be empty");

    // Transcode media files
    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);

        // Go through each file, get best quality, and transcode it
        for (const file of files) {
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

            const inputPathShortened = inputFile.path.replace(path, "");
            const outputPathShortened = outputFile.path.replace(outputDir, "");
            logs.info(
                `Input file: ${inputPathShortened ? inputPathShortened : basename(inputFile.path)}`
            );
            logs.info(
                `Output file: ${outputPathShortened ? outputPathShortened : basename(outputFile.path)}`
            );

            const hb = new Handbrake();
            await hb.init(inputFile, outputFile, {
                preset: PRESET_FILE,
                seconds: SECONDS,
                range: { ...RANGE }, // Copy variable fully, because otherwise it will be changed,
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
                await hb.findQuality();
            } catch (error) {
                logs.err("While finding quality", error as Error);
                process.exit(1);
            }

            // After finding quality, encode video
            try {
                await hb.spawnTranscode();
            } catch (error) {
                logs.err(`Transcoding ${outputFile.path}`, error as Error);
            }
        }

        // Go through each subtitle and copy it to the destination folder
        const subtitles = await getSubtitlesFiles(path);

        for (const sub of subtitles) {
            const destinationPath = join(outputDir, getDestinationFolderName(sub), basename(sub));
            // Do not overwrite subtitles, unless overwrite enabled
            if ((await fileExists(sub)) && !args.overwrite) {
                logs.verbose(`Skip copy of ${sub.replace(path, "")}`);
                continue;
            }

            // Get subtitle file and copy it to destination folder
            const subtitleFile = Bun.file(sub);
            const { error: copyError } = await tryCatch(Bun.write(destinationPath, subtitleFile));

            if (copyError) {
                logs.err(`Error while copying ${sub} to ${destinationPath}`, copyError);
                process.exit(1);
            } else {
                logs.verbose(`Copied ${sub.replace(path, "")} to destination folder`);
            }
        }
    }
}

export async function displayFileInfo(args: InfoArguments) {
    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);
        let previousDir: string | undefined;

        for (const file of files) {
            const video = new VideoFile(file);
            const { data: videoInfo, error } = await tryCatch(video.info());

            // For better readability notify about dir change
            const shortenedDir = video.dir.replace(path, "");
            if (previousDir !== shortenedDir) {
                logs.verbose(!shortenedDir ? video.dir : shortenedDir);
                previousDir = shortenedDir;
            }

            if (error) {
                logs.err("Error while probing video file", error);
                process.exit(1);
            }

            let shortenedPath = videoInfo.path.replace(video.dir, "");
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
