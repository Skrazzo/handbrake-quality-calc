export function round(number: number, precision: number = 2) {
    const precisionDivider = Math.pow(10, precision); // 10^precision
    return Math.round(number * precisionDivider) / precisionDivider;
}
