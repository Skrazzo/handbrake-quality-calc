import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { displayFileInfo, processFiles } from "..";
import { OUTPUT_DIR } from "../consts";
import { logs } from "./LogsClass";

export interface ProcessArguments {
    files: string[];
    overwrite?: boolean;
    output: string;
    quality: number | undefined;
}

export interface InfoArguments {
    files: string[];
}

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
        .help()
        .parseSync();
}
