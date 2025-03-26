import { join } from "path";

// Transcoding options
export const OUTPUT_DIR = "/Users/skrazzo/Desktop/transcode-output";
export const CONVERT_TO = ".mp4";
export const RANGE = {
    min: 9.5,
    max: 11,
};
export const PRESET_FILE = join(__dirname, "preset.json");

// Finding quality slider options

// Configurable thresholds and increments, easy to tweak, ya heard?
// if diff > threshold = increment
export const INCREMENT_CONFIG = [
    { threshold: 10, increment: 10 },
    { threshold: 5, increment: 7 },
    { threshold: 3, increment: 5 },
    { threshold: 1, increment: 3 },
];
export const DEFAULT_INCREMENT = 1; // Minimum jump is 1, always

// When finding quality slider, this is how long video will be
export const SECONDS = 10;
// This is how many times video will be split and transcoded
export const SPLITS = 10;
