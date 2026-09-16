
//@ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import moment from 'moment';
import { LOG_TYPES, Log, LoggerState } from "../types/types";
import safeStringify from '../utils/safeStringify';

const INITIAL_STATE = { REQUEST: [], RESPONSE: [], PRINT: [] }

const isAbsoluteUrl = (url) => /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);

// The URL axios actually requests: this request's own baseURL + url (not the root axios.defaults, which
// axios.getUri would merge in and which axios < 0.27 ignores anyway), with params serialized by axios.
// Never let logging break a request.
const getRequestUrl = (config) => {
    if (!config) return '';
    let path = config.url || '';
    try {
        const { baseURL = '', url = '', params, paramsSerializer, allowAbsoluteUrls } = config;
        const useBase = baseURL && (!isAbsoluteUrl(url) || allowAbsoluteUrls === false);
        path = !useBase ? url : !url ? baseURL : `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
        return axios.getUri({ baseURL: '', url: path, params, paramsSerializer }) || path;
    } catch (e) {
        return path;
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
        const log = type === LOG_TYPES[3] ? {
            type,
            timestamp: moment().valueOf(),
            message: safeStringify(message),
        } : {
            type,
            timestamp: moment().valueOf(),
            url,
            requestData: safeStringify(requestData ?? {}),
            responseData: responseData === undefined ? undefined : safeStringify(responseData),
            status,
            error,
        };
        // Failed calls are listed with the responses, so they show up in order next to successful ones
        const listType = type === LOG_TYPES[2] ? LOG_TYPES[1] : type;
        setLogs((prevState) => ({
            ...prevState,
            [listType]: [...prevState[listType], log],
        }));
    }, []);

    const requestInterceptorHelper = useCallback((config) => {
        writeToLogHelper({
            type: LOG_TYPES[0],
            url: getRequestUrl(config),
            requestData: config.data,
        });
        return config;
    }, []);

    const responseInterceptorHelper = useCallback((response) => {
        writeToLogHelper({
            type: LOG_TYPES[1],
            url: getRequestUrl(response?.config),
            requestData: response.config && response.config.data,
            responseData: response && response.data,
            status: response && response.status,
        });
        return response;
    }, []);

    const responseErrorInterceptorHelper = useCallback((error) => {
        writeToLogHelper({
            type: LOG_TYPES[2],
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
        writeToLogHelper({ type: LOG_TYPES[3], message });
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
