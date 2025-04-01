import { join } from "path";

// Transcoding options
export const OUTPUT_DIR = "C:\\Users\\Leons\\Desktop\\transcoded";
export const CONVERT_TO = ".mp4";
export const RANGE = {
    min: 11,
    max: 12.5,
};
export const PRESET_FILE = join(__dirname, "windows-preset.json");

// When finding quality slider, this is how long video will be
export const SECONDS = 30;
// This is how many times video will be split and transcoded
export const SPLITS = 7;

// Binary search
export const BINARY_QUALITY_RANGE = [20, 40];
export const MAX_ITERATIONS = 6;
// For windows or mac it could be inverted
// For example, if mb/min needs to go down, but it goes up, then its most likely inverted
export const INVERTED_SEARCHING: boolean = false;
