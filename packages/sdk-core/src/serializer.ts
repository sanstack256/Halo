export function safeSerialize(
    value: unknown,
    maxDepth: number = 4,
    maxLength: number = 1000,
    maxKeys: number = 50,
    currentDepth: number = 0,
    seen = new WeakSet()
): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === "string") {
        return value.length > maxLength ? value.slice(0, maxLength) + "… [TRUNCATED]" : value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return value;
    }

    if (typeof value === "bigint") {
        return value.toString() + "n";
    }

    if (typeof value === "symbol") {
        return value.toString();
    }

    if (typeof value === "function") {
        return `[Function: ${value.name || "anonymous"}]`;
    }

    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack ? safeSerialize(value.stack, 1, 2000, 10, 0, seen) : undefined,
        };
    }

    if (typeof (value as any)?.nodeType === "number") {
        // DOM element
        const el = value as any;
        return `<${el.tagName ? el.tagName.toLowerCase() : "node"}${el.id ? ` id="${el.id}"` : ""}${el.className ? ` class="${el.className}"` : ""}>`;
    }

    if (currentDepth >= maxDepth) {
        return "[DEPTH_LIMIT]";
    }

    if (typeof value === "object") {
        if (seen.has(value as object)) {
            return "[CIRCULAR]";
        }
        seen.add(value as object);

        if (Array.isArray(value)) {
            const arr = value.slice(0, maxKeys);
            const res = arr.map((item) => safeSerialize(item, maxDepth, maxLength, maxKeys, currentDepth + 1, seen));
            if (value.length > maxKeys) {
                res.push(`… [${value.length - maxKeys} MORE ITEMS]`);
            }
            return res;
        }

        const res: Record<string, unknown> = {};
        const entries = Object.entries(value);
        let count = 0;
        for (const [k, v] of entries) {
            if (count >= maxKeys) {
                res["…"] = `[${entries.length - maxKeys} MORE KEYS]`;
                break;
            }
            res[k] = safeSerialize(v, maxDepth, maxLength, maxKeys, currentDepth + 1, seen);
            count++;
        }
        return res;
    }

    return String(value);
}
