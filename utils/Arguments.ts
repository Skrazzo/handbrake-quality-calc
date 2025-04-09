import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { displayFileInfo, extractEpisodes, extractSubs, processFiles, sortEpisodes } from "..";
import { OUTPUT_DIR } from "../consts";
import { logs } from "./LogsClass";

export interface ProcessArguments {
    files: string[];
    overwrite?: boolean;
    output: string;
    quality: number | undefined;
}

export interface FilesArguments {
    files: string[];
}

export interface InfoArguments extends FilesArguments {}

export interface ExtractArguments extends FilesArguments {}

export interface SortArguments extends FilesArguments {}

export interface SubsArguments extends FilesArguments {}

export function loadArguments() {
    yargs(hideBin(process.argv))
        .usage("Usage: $0 <command> [options]")
        .command(
            "info",
            "Show useful information about video files",
            (yargs) => {
                yargs.option("files", {
                    alias: "f",
                    describe: "List of files to process",
                    type: "array",
                    demandOption: true,
                });
            },
            (argv) => {
                //@ts-ignore
                const args = argv as InfoArguments; // Type assertion
                displayFileInfo(args);
            }
        )
        .command(
            "process",
            "Process files",
            (yargs) => {
                yargs
                    .option("files", {
                        alias: "f",
                        describe: "List of files to process",
                        type: "array",
                        demandOption: true,
                    })
                    .option("overwrite", {
                        alias: "O",
                        describe: "Overwrite existing files",
                        type: "boolean",
                        default: false,
                    })
                    .option("output", {
                        alias: "o",
                        describe: "Set output dir for files",
                        type: "string",
                        default: OUTPUT_DIR,
                        demandOption: true,
                    })
                    .option("quality", {
                        alias: "q",
                        describe: "Set started default quality",
                        type: "number",
                        default: undefined,
                    });
            },
            (argv) => {
                //@ts-ignore
                const args = argv as ProcessArguments; // Type assertion

                if (args.overwrite) {
                    logs.info("Overwrite is enabled");
                }

                processFiles(args);
            }
        )
        .command(
            "extract",
            "Extracts media files from subfolders into given path",
            (yargs) => {
                yargs.option("files", {
                    alias: "f",
                    describe: "List of directories to process",
                    type: "array",
                    demandOption: true,
                });
            },
            (argv) => {
                //@ts-ignore
                const args = argv as ExtractArguments;
                extractEpisodes(args);
            }
        )
        .command(
            "sort",
            "Takes given path and sorts all episodes into season folders",
            (yargs) => {
                yargs.option("files", {
                    alias: "f",
                    describe: "List of directories to process",
                    type: "array",
                    demandOption: true,
                });
            },
            (argv) => {
                //@ts-ignore
                const args = argv as SortArguments;
                sortEpisodes(args);
            }
        )
        .command(
            "mkv-subs",
            "Takes all mkv files inside of provided path, and extracts subtitles",
            (yargs) => {
                yargs.option("files", {
                    alias: "f",
                    describe: "List of directories to process",
                    type: "array",
                    demandOption: true,
                });
            },
            (argv) => {
                //@ts-ignore
                const args = argv as SubsArguments;
                extractSubs(args);
            }
        )

        .help()
        .parseSync();
}
