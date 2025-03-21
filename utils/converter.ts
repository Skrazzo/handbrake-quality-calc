export function convertTimeToMinutes(timeStr: string | undefined): number | null {
    if (!timeStr) return null;

    // Split the input string into hours, minutes, and seconds parts.
    const [hoursStr, minutesStr, secondsStr] = timeStr.split(":");

    // Convert each part to a number (handle fractional seconds using parseFloat).
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const seconds = parseFloat(secondsStr);

    // Compute total minutes: hours * 60 + minutes + seconds/60.
    return hours * 60 + minutes + seconds / 60;
}
