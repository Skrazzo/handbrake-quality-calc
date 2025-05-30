import { join } from "path";

// Transcoding options
export const OUTPUT_DIR = "/Users/skrazzo/Desktop/transcode-output";
export const CONVERT_TO = ".mp4";
export const RANGE = {
    min: 12,
    max: 14.5,
};
export const PRESET_FILE = join(__dirname, "preset.json");

// When finding quality slider, this is how long video will be
export const SECONDS = 30;
// This is how many times video will be split and transcoded
export const SPLITS = 7;

// Binary search
// export const BINARY_QUALITY_RANGE = [20, 60];
export const BINARY_QUALITY_RANGE = [20, 70];

// Quality search
export const MAX_ITERATIONS = 6;
// Configurable thresholds and increments, easy to tweak, ya heard?
// if diff > threshold = increment
export const INCREMENT_CONFIG = [
    { threshold: 10, increment: 10 },
    { threshold: 5, increment: 7 },
    { threshold: 3, increment: 5 },
    { threshold: 1, increment: 3 },
];
export const DEFAULT_INCREMENT = 1; // Minimum jump is 1, always

// For windows or mac it could be inverted
// For example, if mb/min needs to go down, but it goes up, then its most likely inverted
export const INVERTED_SEARCHING: boolean = true;
// The range of error is added on file MB/min size when trying to predict the final
// from sample files before transcoding. How its done basically
// return totalMBMin / this.splitPieces + 0.3;
// So after all split pieces were transcoded, we get average MB/min and add RANGE_OF_ERROR, in this example its 0.3
export const RANGE_OF_ERROR: number = 0.5; // Has to be in MB/min format
