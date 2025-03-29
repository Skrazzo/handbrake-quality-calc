import { join } from "path";

// Transcoding options
export const OUTPUT_DIR = "C:\\Users\\Leons\\Desktop\\transcoded";
export const CONVERT_TO = ".mp4";
export const RANGE = {
    min: 9,
    max: 10,
};
export const PRESET_FILE = join(__dirname, "windows-preset.json");

// When finding quality slider, this is how long video will be
export const SECONDS = 30;
// This is how many times video will be split and transcoded
export const SPLITS = 5;

// Binary search
export const BINARY_QUALITY_RANGE = [20, 40];
export const MAX_ITERATIONS = 6;
