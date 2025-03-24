import { readdir, stat } from "fs/promises";
import { basename, dirname, extname, join, resolve } from "path";

export function getDestinationFolderName(path: string): string {
    const seasonRegex = /(season|s).\d{1,3}/gim;

    const fullPath = resolve(path);
    const parentFolder = dirname(fullPath);
    const parentName = basename(parentFolder);

    // Return either movie folder name, or season folder name with season folder number
    if (seasonRegex.test(parentName) && parentName.length <= 10) {
        // Just a season folder
        // Breaking bad/S01
        return `${basename(dirname(parentFolder))}/${parentName}`;
    } else {
        // Not a season folder
        // Breaking bad
        return parentName;
    }
}

export async function isDir(path: string) {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch (_) {
        return false;
    }
}

function isMediaFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    const mediaExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".mp3", ".wav", ".flac", ".ogg", ".m4a"]; // Add more as needed
    return mediaExtensions.includes(ext);
}

export async function getMoviesFiles(path: string): Promise<string[]> {
    const files = new Set<string>([]);

    // Incase only file is given
    if (!(await isDir(path))) {
        return [resolve(path)];
    }

    const items = (await readdir(path)) as string[];

    for (const file of items) {
        const fullPath = join(path, file);

        if (await isDir(fullPath)) {
            // If file is directory, we reccursively need to get all media files
            (await getMoviesFiles(fullPath)).forEach((f) => files.add(f));
        } else {
            // If file is a file, and matches to media extension, get resolved path and return it
            if (isMediaFile(fullPath)) {
                files.add(resolve(fullPath));
            }
        }
    }

    return Array.from(files);
}
