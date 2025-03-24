import { log } from "./utils/logs";
import path from "path";
import { type ProcessArguments, loadArguments } from "./utils/Arguments";
import { resolve } from "path";
import { readdir } from "fs/promises";
import { getDestinationFolderName, getMoviesFiles } from "./utils/Files";

loadArguments();

const presetFile = path.join(__dirname, "preset.json");

export async function processFiles(args: ProcessArguments) {
    for (const path of args.files) {
        // Check if path is folder
        const files = await getMoviesFiles(path);
        log(files);

        files.forEach((f) => console.log(getDestinationFolderName(f)));
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
