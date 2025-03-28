import dayjs from "dayjs";
import { appendFile } from "fs/promises";

// ANSI Color Codes - Keepin' it real 🎨
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GRAY = "\x1b[90m"; // Bright Black, looks like gray
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const GREEN = "\x1b[32m";
const PURPLE = "\x1b[35m"; // For verbal logs, cuz why not? 💜

const DATE_FORMAT = "MM-DD HH:mm:ss";

// Helper to remove ANSI color codes for file logging
const stripAnsiCodes = (str: string): string =>
    str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");

class LogsClass {
    logName = "app.log";

    private baseLog(level: string, color: string, ...messages: any[]): void {
        const currentDate = dayjs().format(DATE_FORMAT);

        const logPrefix = `${GRAY}[${currentDate}]${RESET} ${color}[${level}]${RESET}`;
        const logMessage = `${stripAnsiCodes(logPrefix)} ${messages.join(" ")}\n`;
        appendFile(this.logName, logMessage);

        console.log(logPrefix, ...messages);
    }

    public info(...info: any[]): void {
        this.baseLog("INFO", CYAN, ...info);
    }

    public err(msg: string, err?: Error): void {
        if (err) {
            this.baseLog("ERROR", RED, msg);
            console.error(
                `${YELLOW}\tname: ${err.name}\n\tmessage: ${err.message}\n\tstack: ${err.stack}${RESET}`
            );
        } else {
            this.baseLog("ERROR", RED, msg);
        }
    }

    public verbose(...messages: any[]): void {
        this.baseLog("VERBOSE", GREEN, ...messages);
    }

    public warn(...messages: any[]): void {
        this.baseLog("WARN", YELLOW, ...messages);
    }
}

export const logs = new LogsClass();
