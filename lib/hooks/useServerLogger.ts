
//@ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { LOG_TYPE, LOG_TABS, TAB_FOR_TYPE } from '../types/types';
import safeStringify from '../utils/safeStringify';

const INITIAL_STATE = LOG_TABS.reduce((state, tab) => ({ ...state, [tab]: [] }), {});

// Bodies and printed values longer than this are cut, on screen and in the export
const MAX_BODY_LENGTH = 64 * 1024;
const truncate = (text) => (text.length <= MAX_BODY_LENGTH
    ? text
    : `${text.slice(0, MAX_BODY_LENGTH)}\n... [truncated, ${Math.round(text.length / 1024)} KB total]`);

// Unique, increasing ids so list rows have stable keys (timestamps collide for parallel requests)
let nextLogId = 1;

// An instance with no defaults: the logged URL is built only from this request's own baseURL, url and params
// (axios.getUri on the root instance would merge axios.defaults in). Needs axios >= 0.27, which applies baseURL in getUri.
const urlBuilder = new axios.Axios({});
const getRequestUrl = (config) => {
    if (!config) return '';
    try {
        return urlBuilder.getUri(config) || config.url || '';
    } catch (e) {
        // never let logging break a request
        return config.url || '';
    }
};

const describeRequestError = (error) => {
    const message = error?.message ?? safeStringify(error);
    // axios uses ECONNABORTED for both timeouts (unless transitional.clarifyTimeoutError is set) and 'Request aborted'
    const isTimeout = error?.code === 'ETIMEDOUT' || (error?.code === 'ECONNABORTED' && message !== 'Request aborted');
    if (isTimeout) return `Timeout: ${message}`;
    return error?.code ? `${error.code}: ${message}` : message;
};

const useServerLogger = () => {
    const requestInterceptorRef = useRef();
    const responseInterceptorRef = useRef();
    const isTrackingLogsRef = useRef(true);
    const [isTrackingLogs, setIsTrackingLogs] = useState(true);
    const [logs, setLogs] = useState(INITIAL_STATE);

    useEffect(() => {
        // Set up interceptors
        requestInterceptorRef.current = axios.interceptors.request.use(requestInterceptorHelper, (error) => Promise.reject(error));
        responseInterceptorRef.current = axios.interceptors.response.use(responseInterceptorHelper, responseErrorInterceptorHelper);

        // Remove interceptors on unmount
        return () => {
            axios.interceptors.request.eject(requestInterceptorRef.current);
            axios.interceptors.response.eject(responseInterceptorRef.current);
        };
    }, []);

    // Stable and usable from the first commit, so printHelper works even from a parent's componentDidMount
    const writeToLogHelper = useCallback(({ type, responseData, requestData, status, url, message, error }) => {
        if (!isTrackingLogsRef.current) return;
        const base = { id: nextLogId++, type, timestamp: Date.now() };
        const log = type === LOG_TYPE.PRINT ? {
            ...base,
            message: truncate(safeStringify(message)),
        } : {
            ...base,
            url,
            requestData: requestData === undefined ? undefined : truncate(safeStringify(requestData)),
            responseData: responseData === undefined ? undefined : truncate(safeStringify(responseData)),
            status,
            error,
        };
        const tab = TAB_FOR_TYPE[type];
        // Newest first, so the latest logs are at the top as soon as the logger opens
        setLogs((prevState) => ({
            ...prevState,
            [tab]: [log, ...prevState[tab]],
        }));
    }, []);

    const requestInterceptorHelper = useCallback((config) => {
        writeToLogHelper({
            type: LOG_TYPE.REQUEST,
            url: getRequestUrl(config),
            requestData: config?.data,
        });
        return config;
    }, []);

    // Everything is guarded: a response interceptor registered before this one may have returned nothing
    const responseInterceptorHelper = useCallback((response) => {
        writeToLogHelper({
            type: LOG_TYPE.RESPONSE,
            url: getRequestUrl(response?.config),
            requestData: response?.config?.data,
            responseData: response?.data,
            status: response?.status,
        });
        return response;
    }, []);

    const responseErrorInterceptorHelper = useCallback((error) => {
        writeToLogHelper({
            type: LOG_TYPE.ERROR,
            // An error thrown by another interceptor arrives as a plain Error with no request config
            url: error?.config ? getRequestUrl(error.config) : '(no request config)',
            requestData: error?.config?.data,
            responseData: error?.response?.data,
            status: error?.response?.status,
            error: describeRequestError(error),
        });
        return Promise.reject(error);
    }, []);

    const printHelper = useCallback((message) => {
        writeToLogHelper({ type: LOG_TYPE.PRINT, message });
        return message;
    }, []);

    const toggleTracking = (value) => {
        isTrackingLogsRef.current = value;
        setIsTrackingLogs(value);
    };

    const clearLogs = () => setLogs(INITIAL_STATE);

    // The state object itself, so consumers can memoize on it
    return [logs, isTrackingLogs, toggleTracking, clearLogs, printHelper]
};

export default useServerLogger;
