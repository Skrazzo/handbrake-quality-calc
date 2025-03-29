import { join } from "path";

// Transcoding options
export const OUTPUT_DIR = "/Users/skrazzo/Desktop/transcode-output";
export const CONVERT_TO = ".mp4";
export const RANGE = {
    min: 9.5,
    max: 11,
};
export const PRESET_FILE = join(__dirname, "preset.json");

// When finding quality slider, this is how long video will be
export const SECONDS = 30;
// This is how many times video will be split and transcoded
export const SPLITS = 5;

// Binary search
// export const BINARY_QUALITY_RANGE = [20, 60];
export const BINARY_QUALITY_RANGE = [10, 60];
export const MAX_ITERATIONS = 8;
// For windows or mac it could be inverted
// For example, if mb/min needs to go down, but it goes up, then its most likely inverted
export const INVERTED_SEARCHING: boolean = true;
