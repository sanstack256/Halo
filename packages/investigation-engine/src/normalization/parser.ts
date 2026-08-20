import { sanitizeUntrustedLog } from "./scrubber";

export interface ParsedLogDetails {
    title: string;
    description?: string;
    status?: string | number;
    traceId?: string;
    spanId?: string;
    requestId?: string;
    operation?: string;
    resource?: string;
    service?: string;
    exceptionType?: string;
    topStackFrame?: string;
    isError: boolean;
    extractedMetadata: Record<string, unknown>;
}

export function parseHeterogeneousLog(
    rawMessage: string,
    existingService?: string
): ParsedLogDetails {
    const sanitized = sanitizeUntrustedLog(rawMessage);
    const metadata: Record<string, unknown> = {};

    // 1. Attempt JSON parsing
    if (sanitized.trim().startsWith("{") && sanitized.trim().endsWith("}")) {
        try {
            const parsed = JSON.parse(sanitized);
            if (typeof parsed === "object" && parsed !== null) {
                return extractFromJson(parsed, existingService);
            }
        } catch {
            // Not valid JSON, proceed to other formats
        }
    }

    // 2. Attempt Key-Value (logfmt) parsing: key=value or key="value"
    if (sanitized.includes("=") && /^[a-zA-Z0-9_-]+=[^\s]+/i.test(sanitized.trim())) {
        const kv = parseLogfmt(sanitized);
        if (Object.keys(kv).length >= 2) {
            return extractFromKeyValue(kv, sanitized, existingService);
        }
    }

    // 3. Stack trace extraction
    const stackInfo = extractStackTraceInfo(sanitized);

    // 4. Status code extraction from HTTP logs (e.g., "GET /api/v1/orders 500 240ms")
    const httpStatusMatch = sanitized.match(/\b([1-5]\d{2})\b/);
    const status = httpStatusMatch ? parseInt(httpStatusMatch[1], 10) : undefined;

    // 5. Operation & resource extraction from plain text
    const operationMatch = sanitized.match(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+([^\s?]+)/i);
    const operation = operationMatch ? operationMatch[1].toUpperCase() : undefined;
    const resource = operationMatch ? operationMatch[2] : undefined;

    // 6. Trace & Request ID extraction
    const traceIdMatch = sanitized.match(/\b(?:trace_?id|traceId)\s*[:=]\s*([a-zA-Z0-9_-]{8,64})\b/i);
    const requestIdMatch = sanitized.match(/\b(?:request_?id|reqId|x-request-id)\s*[:=]\s*([a-zA-Z0-9_-]{8,64})\b/i);

    const isError =
        (status !== undefined && status >= 400) ||
        stackInfo.hasStack ||
        /\b(?:error|fatal|panic|exception|failed|failure|timeout)\b/i.test(sanitized);

    return {
        title: stackInfo.exceptionTitle || extractLogTitle(sanitized),
        description: sanitized,
        status,
        traceId: traceIdMatch ? traceIdMatch[1] : undefined,
        requestId: requestIdMatch ? requestIdMatch[1] : undefined,
        operation,
        resource,
        service: existingService,
        exceptionType: stackInfo.exceptionType,
        topStackFrame: stackInfo.topFrame,
        isError,
        extractedMetadata: metadata,
    };
}

function extractFromJson(
    json: Record<string, unknown>,
    defaultService?: string
): ParsedLogDetails {
    const level = String(json.level || json.severity || json.log_level || "").toLowerCase();
    const message = String(json.message || json.msg || json.error || json.title || "JSON Log");
    const stack = typeof json.stack === "string" ? json.stack : undefined;
    const service = typeof json.service === "string" ? json.service : defaultService;
    const status = json.status !== undefined ? (typeof json.status === "number" ? json.status : String(json.status)) : undefined;

    const traceId = typeof json.trace_id === "string" ? json.trace_id : (typeof json.traceId === "string" ? json.traceId : undefined);
    const spanId = typeof json.span_id === "string" ? json.span_id : (typeof json.spanId === "string" ? json.spanId : undefined);
    const requestId = typeof json.request_id === "string" ? json.request_id : (typeof json.requestId === "string" ? json.requestId : undefined);
    const operation = typeof json.operation === "string" ? json.operation : (typeof json.method === "string" ? json.method : undefined);
    const resource = typeof json.resource === "string" ? json.resource : (typeof json.path === "string" ? json.path : (typeof json.url === "string" ? json.url : undefined));

    const stackInfo = stack ? extractStackTraceInfo(stack) : extractStackTraceInfo(message);

    const isError =
        level.includes("err") ||
        level.includes("crit") ||
        level.includes("fatal") ||
        (typeof status === "number" && status >= 400) ||
        stackInfo.hasStack;

    return {
        title: stackInfo.exceptionTitle || message,
        description: stack || message,
        status,
        traceId,
        spanId,
        requestId,
        operation,
        resource,
        service,
        exceptionType: stackInfo.exceptionType,
        topStackFrame: stackInfo.topFrame,
        isError,
        extractedMetadata: json,
    };
}

function parseLogfmt(line: string): Record<string, string> {
    const result: Record<string, string> = {};
    const regex = /([a-zA-Z0-9_\-\.]+)=(?:"([^"]*)"|([^\s]+))/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
        const key = match[1];
        const value = match[2] !== undefined ? match[2] : match[3];
        result[key] = value;
    }

    return result;
}

function extractFromKeyValue(
    kv: Record<string, string>,
    raw: string,
    defaultService?: string
): ParsedLogDetails {
    const message = kv.msg || kv.message || kv.error || raw;
    const status = kv.status || kv.status_code || kv.code;
    const service = kv.service || kv.app || defaultService;
    const traceId = kv.trace_id || kv.traceId || kv.traceid;
    const spanId = kv.span_id || kv.spanId;
    const requestId = kv.request_id || kv.requestId || kv.req_id;
    const operation = kv.method || kv.operation || kv.op;
    const resource = kv.path || kv.route || kv.url || kv.resource;
    const level = (kv.level || kv.severity || "").toLowerCase();

    const isError =
        level.includes("err") ||
        level.includes("crit") ||
        level.includes("fatal") ||
        (status !== undefined && parseInt(status, 10) >= 400);

    return {
        title: message,
        description: raw,
        status: status ? (isNaN(Number(status)) ? status : Number(status)) : undefined,
        traceId,
        spanId,
        requestId,
        operation,
        resource,
        service,
        isError,
        extractedMetadata: kv,
    };
}

interface StackTraceInfo {
    hasStack: boolean;
    exceptionType?: string;
    exceptionTitle?: string;
    topFrame?: string;
}

function extractStackTraceInfo(text: string): StackTraceInfo {
    if (!text || typeof text !== "string") {
        return { hasStack: false };
    }

    // Node.js / V8 style: "Error: connect ECONNREFUSED \n at TCPConnectWrap.afterConnect"
    const nodeMatch = text.match(/^([A-Za-z0-9_$]+Error|[A-Za-z0-9_$]+Exception):\s*(.+)/m);
    const nodeFrame = text.match(/^\s*at\s+([^\n]+)/m);

    // Python style: "Traceback (most recent call last): \n ... \n ValueError: invalid literal"
    const pythonMatch = text.match(/\b([A-Za-z0-9_]+Error|[A-Za-z0-9_]+Exception):\s*(.+)$/m);
    const pythonFrame = text.match(/File "([^"]+)", line (\d+), in ([^\n]+)/m);

    // Java / Go style: "java.lang.NullPointerException: Cannot invoke ..." or "panic: runtime error: index out of range"
    const javaMatch = text.match(/([a-zA-Z0-9_.]+(?:Exception|Error)):\s*([^\n]+)/m);
    const goPanicMatch = text.match(/panic:\s*([^\n]+)/m);

    if (nodeMatch) {
        return {
            hasStack: true,
            exceptionType: nodeMatch[1],
            exceptionTitle: `${nodeMatch[1]}: ${nodeMatch[2].slice(0, 120)}`,
            topFrame: nodeFrame ? nodeFrame[1].trim() : undefined,
        };
    }

    if (pythonMatch) {
        return {
            hasStack: true,
            exceptionType: pythonMatch[1],
            exceptionTitle: `${pythonMatch[1]}: ${pythonMatch[2].slice(0, 120)}`,
            topFrame: pythonFrame ? `${pythonFrame[1]}:${pythonFrame[2]} (${pythonFrame[3]})` : undefined,
        };
    }

    if (javaMatch) {
        return {
            hasStack: true,
            exceptionType: javaMatch[1].split(".").pop(),
            exceptionTitle: `${javaMatch[1].split(".").pop()}: ${javaMatch[2].slice(0, 120)}`,
            topFrame: nodeFrame ? nodeFrame[1].trim() : undefined,
        };
    }

    if (goPanicMatch) {
        return {
            hasStack: true,
            exceptionType: "Panic",
            exceptionTitle: `Panic: ${goPanicMatch[1].slice(0, 120)}`,
        };
    }

    return { hasStack: false };
}

function extractLogTitle(text: string): string {
    const firstLine = text.trim().split("\n")[0] || "Log record";
    return firstLine.length > 120 ? firstLine.slice(0, 117) + "..." : firstLine;
}
