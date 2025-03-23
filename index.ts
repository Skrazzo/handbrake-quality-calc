import { err, log } from "./utils/logs";
import { VideoFile } from "./utils/VideoFile";
import path from "path";
import hb, { type HandbrakeOptions } from "handbrake-js";
import { tryCatch } from "./utils/tryCatch";

const presetFile = path.join(__dirname, "preset.json");

const originalVideoPath = "/Users/skrazzo/Downloads/handbrake/The.Electric.State.2025.REAL.1080p.WEB.h264-ETHEL.mkv";
const video = new VideoFile(originalVideoPath);
log("video", await video.info());

const output = new VideoFile(path.join(path.dirname(originalVideoPath), "tmp.mp4"));

const info = await output.info();
log("output", info);

process.exit();

const videoInfo = await video.info();
if (!videoInfo) {
    err("Does the file exist?");
    process.exit(1);
}

const options: HandbrakeOptions = {
    input: video.path,
    output: output.path,
    preset: "custom-preset",
    "preset-import-file": presetFile,
    "start-at": `seconds:${(videoInfo.duration * 60) / 2}`,
    "stop-at": "seconds:10",
};

const { data: handbrakeInfo, error: handbrakeError } = await tryCatch(hb.run(options));

if (handbrakeError) {
    err("Handbrake error", handbrakeError);
    process.exit(1);
}

log(handbrakeInfo);
log(await output.info());
