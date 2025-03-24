import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { processFiles } from "..";

export interface ProcessArguments {
    files: string[];
    overwrite?: boolean;
    output: string;
}

export function loadArguments() {
    yargs(hideBin(process.argv))
        .usage("Usage: $0 <command> [options]")
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
                        alias: "o",
                        describe: "Overwrite existing files",
                        type: "boolean",
                        default: false,
                    })
                    .option("output", {
                        alias: "O",
                        describe: "Set output dir for files",
                        type: "string",
                        default: Bun.env.OUTPUT_DIR,
                        demandOption: true,
                    });
            },
            (argv) => {
                //@ts-ignore
                const args = argv as ProcessArguments; // Type assertion

                if (args.overwrite) {
                    console.log("Overwrite is enabled");
                }

                processFiles(args);
            }
        )
        .help()
        .parseSync();
}
