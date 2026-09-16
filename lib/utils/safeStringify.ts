//@ts-nocheck

const describeFunction = (fn) => `[Function ${fn.name || 'anonymous'}]`;

// Never throws and always returns a string, whatever the input.
// Each object is serialized once; any later reference to it (circular or shared) prints as [Circular],
// which keeps large linked graphs such as React events from blocking the JS thread.
const safeStringify = (value, indent = 2) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'function') return describeFunction(value);
    if (typeof value !== 'object' || value === null) return String(value);

    const seen = new WeakSet();
    try {
        const json = JSON.stringify(value, (_, val) => {
            if (typeof val === 'bigint') return `${val}n`;
            if (typeof val === 'symbol') return val.toString();
            if (typeof val === 'function') return describeFunction(val);
            if (typeof val !== 'object' || val === null) return val;
            if (seen.has(val)) return '[Circular]';
            seen.add(val);
            if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack, ...val };
            if (val instanceof Map || val instanceof Set) return Array.from(val);
            return val;
        }, indent);
        return json ?? Object.prototype.toString.call(value);
    } catch (e) {
        return Object.prototype.toString.call(value);
    }
};

export default safeStringify;
