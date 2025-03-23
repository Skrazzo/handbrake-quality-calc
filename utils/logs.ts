import dayjs from "dayjs";

const DATE_FORMAT = "MM-DD HH:mm:ss";

export function log(...info: any[]): void {
    const currentDate = dayjs().format(DATE_FORMAT);
    console.log(`[${currentDate}] `, ...info);
}

export function err(msg: string, err: Error | null = null) {
    const currentDate = dayjs().format(DATE_FORMAT);

    if (err) {
        console.log(
            `[${currentDate}] ${msg} error: \n\tname: ${err.name}\n\tmessage: ${err.message}\n\tstack: ${err.stack}`
        );
    } else {
        console.log(`[${currentDate}] ${msg} error`);
    }

    return;
}
