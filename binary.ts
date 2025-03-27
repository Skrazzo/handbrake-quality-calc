import Handbrake from "./utils/Handbrake";
import { VideoFile } from "./utils/VideoFile";

const input = new VideoFile(
    "/Users/skrazzo/Downloads/Unbelievable (2019) Season 1 S01 (1080p NF WEB-DL x265 HEVC 10bit EAC3 5.1 Ghost)/Unbelievable (2019) - S01E01 - Episode 1 (1080p NF WEB-DL x265 Ghost).mkv"
);
const output = new VideoFile("/Users/skrazzo/Desktop/transcoded/first-ep.mp4");

const hb = new Handbrake();
await hb.init(input, output, {
    preset: "preset.json",
    range: { min: 9, max: 11 },
    seconds: 5,
    splitPieces: 3,
    binary: {
        min: 1,
        max: 100,
        iterations: { max: 6, current: 1 },
    },
});

await hb.findQuality();
