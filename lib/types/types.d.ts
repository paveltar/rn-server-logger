declare const LOG_TYPES: LogType[];
declare type LogType = 'REQUEST' | 'RESPONSE' | 'ERROR' | 'PRINT';
interface WriteToLogHelperPayload {
    type: LogType;
    url?: string;
    requestData?: any;
    responseData?: any;
    status?: number;
    error?: string;
    message?: unknown;
}

interface Log {
    type: LogType;
    url: string;
    timestamp: number;
    requestData: string;
    responseData?: string;
    status?: number;
    error?: string;
}

interface PrintLog {
    timestamp: number;
    type: LogType;
    message: string;
}

interface Logger {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error, data?: any) => void;
}

interface LoggerState {
    logs: {
        REQUEST: Log[];
        // includes ERROR logs, listed alongside responses
        RESPONSE: Log[];
        PRINT: PrintLog[];
    };
    isTrackingLogs: boolean;
    toggleTracking: () => void;
}

interface ExportOptions {
    fileName: string;
    fileType: string;
    subject: string;
}

interface ServerLoggerHandle {
    printHelper<T>(message: T): T;
    // Keeps refs typed as { printHelper: (message: string) => void } (the earlier README example) assignable
    printHelper(message: any): void;
}

export { LOG_TYPES, LogType, WriteToLogHelperPayload, Log, PrintLog, Logger, LoggerState, ExportOptions, ServerLoggerHandle };
