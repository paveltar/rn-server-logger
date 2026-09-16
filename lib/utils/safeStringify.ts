//@ts-nocheck

const describeFunction = (fn) => `[Function ${fn.name || 'anonymous'}]`;

const describeError = (error) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
    // cause and AggregateError.errors are non-enumerable, so the spread below would drop them
    ...(error.cause !== undefined && { cause: error.cause }),
    ...(error.errors !== undefined && { errors: error.errors }),
    ...error,
});

// Never throws and always returns a string, whatever the input.
// Only true cycles print as [Circular]: an object referenced twice in different branches is written out both times.
const safeStringify = (value, indent = 2) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'function') return describeFunction(value);
    if (typeof value !== 'object' || value === null) return String(value);

    // The chain of objects currently being serialized, as seen by JSON.stringify (`parents`, possibly the
    // replacements returned below) and as they were before replacement (`originals`, what child values point at).
    const parents = [];
    const originals = [];
    try {
        const json = JSON.stringify(value, function (_, val) {
            if (typeof val === 'bigint') return `${val}n`;
            if (typeof val === 'symbol') return val.toString();
            if (typeof val === 'function') return describeFunction(val);
            if (typeof val !== 'object' || val === null) return val;
            // `this` is the object holding `val`; drop the ancestors of branches already finished
            while (parents.length && parents[parents.length - 1] !== this) {
                parents.pop();
                originals.pop();
            }
            if (originals.includes(val)) return '[Circular]';
            let out = val;
            if (val instanceof Error) out = describeError(val);
            else if (val instanceof Map || val instanceof Set) out = Array.from(val);
            parents.push(out);
            originals.push(val);
            return out;
        }, indent);
        return json ?? Object.prototype.toString.call(value);
    } catch (e) {
        return Object.prototype.toString.call(value);
    }
};

export default safeStringify;
