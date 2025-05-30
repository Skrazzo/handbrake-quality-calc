// This function calculates quality increment for video transcoding
// If two values are too far apart, for example 6 and 12, then increment should be bigger example -> 4 increment
// If two values are closer, then increment should be smaller, but not smaller than 1

import { INCREMENT_CONFIG, DEFAULT_INCREMENT } from "../consts";

export default function calculateIncrement(mb1: number, mb2: number): number {
    const diff = Math.abs(mb1 - mb2); // Get the absolute difference, straight up

    // Loop through the config, find the right jump
    for (const config of INCREMENT_CONFIG) {
        if (diff > config.threshold) {
            return config.increment; // Found the right step, bounce
        }
    }

    // If the diff ain't big enough for the custom jumps, just step by 1
    return DEFAULT_INCREMENT;
}
