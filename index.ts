import { err, log } from "./utils/logs";
import { VideoFile } from "./utils/VideoFile";
import path from "path";
import hb, { type HandbrakeOptions } from "handbrake-js";
import { tryCatch } from "./utils/tryCatch";
import Handbrake from "./utils/Handbrake";

const presetFile = path.join(__dirname, "preset.json");

const originalVideoPath = "/Users/skrazzo/Downloads/handbrake/The.Electric.State.2025.REAL.1080p.WEB.h264-ETHEL.mkv";
const video = new VideoFile(originalVideoPath);
const output = new VideoFile(path.join(path.dirname(originalVideoPath), "tmp.mp4"));

const HB = new Handbrake();
await HB.init(video, output, {
    preset: presetFile,
    seconds: 10,
});
log(HB);
process.exit();

const videoInfo = await video.info();
if (!videoInfo) {
    err("Does the file exist?");
    process.exit(1);
}

log("Original file", videoInfo);

const options: HandbrakeOptions = {
    input: video.path,
    output: output.path,
    preset: "custom-preset",
    "preset-import-file": presetFile,
    "start-at": `seconds:${(videoInfo.duration * 60) / 2}`,
    "stop-at": "seconds:30",
};

const { data: handbrakeInfo, error: handbrakeError } = await tryCatch(hb.run(options));

if (handbrakeError) {
    err("Handbrake error", handbrakeError);
    process.exit(1);
}

log(await output.info());
