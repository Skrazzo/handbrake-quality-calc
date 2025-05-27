import { basename, dirname, extname, join, resolve } from "path";
import {
    type ExtractArguments,
    type InfoArguments,
    type ProcessArguments,
    type SortArguments,
    type SubsArguments,
    loadArguments,
} from "./utils/Arguments";
import { mkdir, rename, readdir } from "fs/promises";
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
import { getFolderSize, formatBytes } from "./utils/GetSize";
import { exportSubtitlesWithMkvTool } from "./utils/ExportSubs";

loadArguments();

export async function processFiles(args: ProcessArguments) {
    // Get output directory
    const outputDir = args.output;
    if (!outputDir) throw new Error("OUTPUT_DIR cannot be empty");

    const convertExt = CONVERT_TO;
    if (!convertExt) throw new Error("CONVERT_TO cannot be empty");

    // If writeTo is set, we check for only one file (we need to check 2 times for this)
    if (args.writeTo && args.files.length !== 1) {
        logs.err("writeTo is only supported for single file transcode");
        process.exit(1);
    }

    // Transcode media files
    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);

        // If writeTo is set, we check for only one file
        if (args.writeTo && files.length !== 1) {
            logs.err("writeTo is only supported for single file transcode");
            process.exit(1);
        }

        // Go through each file, get best quality, and transcode it
        for (const file of files) {
            // Define input and output file
            const inputFile = new VideoFile(file);
            const outputFile = new VideoFile(
                // If writeTo is set we are transcoding directly to a file
                args.writeTo
                    ? args.writeTo
                    : join(
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
                // After transcode is done, output transcoded files mb min size
                const outputInfo = await outputFile.info();
                logs.info(`${basename(outputFile.path)} -> ${outputInfo.mbMin} MB/min`);
            } catch (error) {
                logs.err(`Transcoding ${outputFile.path}`, error as Error);
            }
        }

        // Go through each subtitle and copy it to the destination folder
        const subtitles = await getSubtitlesFiles(path);

        for (const sub of subtitles) {
            const destinationPath = join(outputDir, getDestinationFolderName(sub), basename(sub));
            // Do not overwrite subtitles, unless overwrite enabled
            if ((await fileExists(destinationPath)) && !args.overwrite) {
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

/**
 * Extracts video episodes from subfolders into the provided folder.
 *
 * For example, if you pass in "bob/", then any video file found in
 * "bob/s1/", "bob/s2/", etc. will be moved to "bob/".
 */
export async function extractEpisodes({ files }: ExtractArguments) {
    // List of valid video extensions (in lower case)
    const videoExtensions = ["mkv", "avi", "mp4", "m4v", "mov", "wmv"];

    // For each given base folder (eg, bob/)
    for (const folder of files) {
        const baseFolder = resolve(folder);
        let movedCount = 0;

        logs.info(`Starting to extract episodes from subfolders in ${baseFolder}...`);

        // Use our utility to get all movie files from the folder recursively.
        const videoFiles = await getMoviesFiles(baseFolder);

        for (const filePath of videoFiles) {
            // We'll only move files that are not already in the base folder.
            const fileDir = resolve(dirname(filePath));
            if (fileDir === baseFolder) {
                // This file is already in the destination, so skip.
                continue;
            }

            // Check extension (if needed)
            const ext = basename(filePath).split(".").pop()?.toLowerCase();
            if (!ext || !videoExtensions.includes(ext)) {
                continue;
            }

            const filename = basename(filePath);
            const destinationPath = join(baseFolder, filename);

            // If the destination file already exists, skip it.
            if (await fileExists(destinationPath)) {
                logs.info(`File '${filename}' already exists in ${baseFolder}, skipping...`);
                continue;
            }

            // Move the file from the subfolder to the base folder.
            logs.verbose(`Moving '${filename}' to ${baseFolder}`);
            try {
                await rename(filePath, destinationPath);
                movedCount++;
            } catch (err) {
                logs.err(`Error moving file ${filename}`, err as Error);
            }
        }

        logs.verbose(
            `Collection complete for ${baseFolder}! Moved ${movedCount} video file${
                movedCount === 1 ? "" : "s"
            }.`
        );

        // Calculate the total size of the destination folder.
        try {
            const totalSize = await getFolderSize(baseFolder);
            logs.verbose(
                `Total size of collected videos in ${baseFolder}: ${formatBytes(totalSize)}`
            );
        } catch (err) {
            logs.err(`Error calculating total size for folder ${baseFolder}`, err as Error);
        } finally {
            logs.info("Extraction complete");
        }
    }
}

export async function sortEpisodes({ files }: SortArguments) {
    // Video file extensions to process (lowercase)
    const videoExtensions = new Set(["mkv", "avi", "mp4", "m4v", "mov", "wmv"]);
    // Regex to extract season number (matches S01, S02, etc.)
    const seasonRegex = /(S[0-9]{2})|(season \d+)/gim;

    for (const folder of files) {
        const baseFolder = resolve(folder);
        logs.info(`Starting to organize TV show episodes in ${baseFolder}...`);

        try {
            // List all entries in the base folder
            const entries = await readdir(baseFolder, { withFileTypes: true });

            // Loop over each file in the current folder
            for (const entry of entries) {
                if (!entry.isFile()) continue; // skip directories

                const filename = entry.name;
                const ext = extname(filename).slice(1).toLowerCase();
                if (!videoExtensions.has(ext)) continue; // skip non-video files

                // Extract season number using the regex.
                const match = filename.match(seasonRegex);
                if (!match) {
                    logs.warn(`${filename} has no season regex matches`);
                    continue;
                } // skip files without season marker

                const seasonFolder = `${match[0]}`;
                const seasonFolderPath = join(baseFolder, seasonFolder);
                // Create season folder if it doesn't exist
                await mkdir(seasonFolderPath, { recursive: true });

                const oldPath = join(baseFolder, filename);
                const newPath = join(seasonFolderPath, filename);

                logs.info(`Moving '${filename}' to ${seasonFolder}/`);
                if (await fileExists(newPath)) {
                    logs.info(`File '${filename}' already exists in ${seasonFolder}, skipping...`);
                    continue;
                }

                try {
                    await rename(oldPath, newPath);
                } catch (err) {
                    logs.err(`Error moving file ${filename} to ${seasonFolder}`, err as Error);
                }
            }

            // After moving files, output the episode count per season folder.
            logs.info("Episode count per season:");
            // Re-read the base folder contents
            const updatedEntries = await readdir(baseFolder, { withFileTypes: true });

            for (const entry of updatedEntries) {
                // Only process directories that match the Sxx pattern
                if (entry.name.match(seasonRegex)) {
                    const seasonDir = join(baseFolder, entry.name);
                    const seasonFiles = await readdir(seasonDir, { withFileTypes: true });
                    const count = seasonFiles.filter((e) => e.isFile()).length;
                    logs.info(`${entry.name}: ${count} episodes`);
                }
            }
        } catch (err) {
            logs.err(`Error processing folder ${baseFolder}`, err as Error);
        }
    }
}

export async function extractSubs({ files }: SubsArguments) {
    for (const path of files) {
        logs.info("Processing ", path);
        await exportSubtitlesWithMkvTool(path);
    }
}
