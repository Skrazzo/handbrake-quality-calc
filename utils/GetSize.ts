import { logs } from "./LogsClass";
import { join } from "path";
import { readdir, stat } from "fs/promises";

/**
 * Recursively computes the total size of files in a folder.
 */
export async function getFolderSize(folder: string): Promise<number> {
    let total = 0;
    const entries = await readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = join(folder, entry.name);
        if (entry.isDirectory()) {
            total += await getFolderSize(entryPath);
        } else if (entry.isFile()) {
            try {
                const { size } = await stat(entryPath);
                total += size;
            } catch (err) {
                logs.err(`Error getting size of ${entryPath}`, err as Error);
            }
        }
    }
    return total;
}

/**
 * Formats bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
