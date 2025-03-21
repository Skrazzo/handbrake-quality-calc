import { log } from "./utils/logs";
import { VideoFile } from "./utils/VideoFile";

const originalVideoPath = "/Users/skrazzo/Downloads/handbrake/The.Electric.State.2025.REAL.1080p.WEB.h264-ETHEL.mkv";
const video = new VideoFile(originalVideoPath);

log(await video.info());
