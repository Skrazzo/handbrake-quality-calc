import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { logs } from "./LogsClass";

interface Track {
    id?: number;
    codec?: string;
    language?: string;
    name?: string;
}

function sanitizeFilename(name: string) {
    // ... (keep this function as is)
    return name
        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, "_") // Replace illegal chars with underscore
        .replace(/\s+/g, " ") // Normalize whitespace
        .replace(/^\.+/g, "_") // Replace leading dots
        .replace(/\.+$/g, "_") // Replace trailing dots
        .trim(); // Remove extra whitespace
}

function getSubtitleExtension(codec: string) {
    // ... (keep this function as is)
    switch (codec) {
        case "S_TEXT/ASS":
        case "S_TEXT/SSA":
        case "S_ASS":
        case "S_SSA":
            return "ass";
        case "S_TEXT/UTF8":
        case "S_TEXT/ASCII":
            return "srt";
        case "S_TEXT/USF":
            return "usf";
        case "S_TEXT/WEBVTT":
            return "vtt";
        case "S_VOBSUB":
            return "sub";
        case "S_HDMV/PGS":
            return "sup";
        case "S_HDMV/TEXTST":
            return "textst";
        case "S_TEXT/DVBTXT":
            return "dvb";
        default:
            logs.err(`Unknown codec: ${codec}`);
            return "srt";
    }
}

// ... (keep languageCodes as is)
const languageCodes = [
    "en",
    "eng",
    "eng",
    "ja",
    "jpn",
    "jpn",
    "ru",
    "rus",
    "rus",
    "lv",
    "lav",
    "lav",
    "zxx",
    "und",
];

export const exportSubtitlesWithMkvTool = async (destinationDir: string) => {
    const files = await readdir(destinationDir, { recursive: true });

    // --- CHANGE IS HERE ---
    // Use a for...of loop instead of forEach
    for (const file of files) {
        if (!file.endsWith(".mkv")) continue; // Use continue to skip non-mkv files

        const fullPath = resolve(destinationDir, file);
        const fileDir = dirname(fullPath);

        let currentTrack: Track = {} as Track;
        let inTrack = false;
        let subtitleTracks: Array<Track> = [];

        // get subtitle info from file
        logs.info(`Processing file: ${file}`); // Changed log message slightly
        for await (const line of $`mkvinfo "${fullPath}"`.lines()) {
            const trimmedLine = line.trim();
            // Start new track
            if (trimmedLine.endsWith("+ Track")) {
                if (inTrack) {
                    subtitleTracks.push({ ...currentTrack });
                }
                inTrack = true;
                currentTrack = {};
                continue;
            }

            // Only process if we're in a track
            if (!inTrack) continue;

            if (trimmedLine.includes("Track number:")) {
                const match = trimmedLine.match(/track ID for mkvmerge & mkvextract: (\d+)/);
                if (match) currentTrack.id = parseInt(match[1]!);
                continue;
            } else if (trimmedLine.includes("+ Track type:")) {
                const type = trimmedLine.split("+ Track type:")[1]!.trim();
                // skip if not a subtitle track
                if (type != "subtitles") inTrack = false;
                continue;
            } else if (trimmedLine.includes("+ Codec ID:")) {
                const codec = trimmedLine.split("+ Codec ID:")[1]!.trim();
                currentTrack.codec = codec;
                continue;
            } else if (trimmedLine.includes("+ Language (IETF BCP 47):")) {
                const language = trimmedLine.split("+ Language (IETF BCP 47):")[1]!.trim();
                currentTrack.language = language;
                if (!languageCodes.includes(language)) inTrack = false;
                continue;
            } else if (trimmedLine.includes("+ Name:")) {
                const name = trimmedLine.split("+ Name:")[1]!.trim();
                currentTrack.name = name;
                continue;
            }
        }

        if (inTrack) {
            subtitleTracks.push({ ...currentTrack });
        }

        // create subtitle filenames & extract subtitles
        if (subtitleTracks.length > 0) {
            logs.info(`Found ${subtitleTracks.length} subtitle track(s) for ${file}`);
            for (const track of subtitleTracks) {
                const extension = getSubtitleExtension(track.codec as string);
                const name = sanitizeFilename(
                    track.name || `Track${(track.id as number).toString()}`
                );

                // Extract just the base name without the extension
                const baseFileName = file
                    .replace(/\.mkv$/i, "")
                    .split("/")
                    .pop()!;

                const outputFile = `${baseFileName}.${name}.${track.language}.${extension}`;
                const outputPath = resolve(fileDir, outputFile);

                // extract subtitles
                logs.info(`Extracting track ${track.id} to ${outputFile}`);
                // This await will now pause the outer for...of loop
                await $`mkvextract tracks "${fullPath}" ${track.id}:"${outputPath}"`;
                logs.info(`Finished extracting track ${track.id} for ${file}`);
            }
        } else {
            logs.info(`No suitable subtitle tracks found for ${file}`);
        }
        logs.info(`Finished processing file: ${file}\n---`); // Added separator log
    }
    // --- END OF CHANGE ---

    logs.info("All files processed."); // Log when everything is done
};
