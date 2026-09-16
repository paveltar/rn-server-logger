declare type LogType = 'REQUEST' | 'RESPONSE' | 'ERROR' | 'PRINT';
declare type LogTab = 'REQUEST' | 'RESPONSE' | 'PRINT';
declare const LOG_TYPE: { readonly REQUEST: 'REQUEST'; readonly RESPONSE: 'RESPONSE'; readonly ERROR: 'ERROR'; readonly PRINT: 'PRINT' };
declare const LOG_TYPES: LogType[];
// The tabs of the logger, and the tab each log type is listed in (ERROR logs are listed with the responses)
declare const LOG_TABS: LogTab[];
declare const TAB_FOR_TYPE: Record<LogType, LogTab>;

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
    id: number;
    type: LogType;
    url: string;
    timestamp: number;
    requestData?: string;
    responseData?: string;
    status?: number;
    error?: string;
}

interface PrintLog {
    id: number;
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

export { LOG_TYPE, LOG_TYPES, LOG_TABS, TAB_FOR_TYPE, LogType, LogTab, WriteToLogHelperPayload, Log, PrintLog, Logger, LoggerState, ExportOptions, ServerLoggerHandle };
