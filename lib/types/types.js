export const LOG_TYPE = { REQUEST: 'REQUEST', RESPONSE: 'RESPONSE', ERROR: 'ERROR', PRINT: 'PRINT' };
export const LOG_TYPES = [LOG_TYPE.REQUEST, LOG_TYPE.RESPONSE, LOG_TYPE.ERROR, LOG_TYPE.PRINT];

// The tabs of the logger, and the tab each log type is listed in: failed calls (ERROR) go with the responses
export const LOG_TABS = [LOG_TYPE.REQUEST, LOG_TYPE.RESPONSE, LOG_TYPE.PRINT];
export const TAB_FOR_TYPE = {
    [LOG_TYPE.REQUEST]: LOG_TYPE.REQUEST,
    [LOG_TYPE.RESPONSE]: LOG_TYPE.RESPONSE,
    [LOG_TYPE.ERROR]: LOG_TYPE.RESPONSE,
    [LOG_TYPE.PRINT]: LOG_TYPE.PRINT,
};
