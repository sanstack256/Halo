/**
 * Halo Trace — Compiler Diagnostic Parser (Phase 1)
 *
 * Parses structured diagnostic output from compilers and build tools
 * that produce non-V8-runtime error formats. Extracts:
 *   - filePath (relative or absolute)
 *   - lineNumber
 *   - columnNumber
 *   - errorCode (TS2345, E0001, etc.)
 *   - errorMessage
 *   - severity (error | warning)
 *
 * Supported formats:
 *   - TypeScript: src/file.ts(10,5): error TS2345: ...
 *   - TypeScript alt: src/file.ts:10:5 - error TS2345: ...
 *   - Python traceback: File "path", line N, in function / ExcType: message
 *   - ESLint: src/file.js:10:5  error  message  rule
 *   - Rust: error[E0001]: message --> src/file.rs:10:5
 *   - Go: ./file.go:10:5: message
 *   - Java: file.java:10: error: message
 *   - C/GCC: file.c:10:5: error: message
 *   - Webpack/build: Module not found: Error: Can't resolve 'module' in 'src/dir'
 */

export interface CompilerDiagnostic {
    filePath: string;
    lineNumber?: number;
    columnNumber?: number;
    errorCode?: string;
    errorMessage: string;
    severity: "error" | "warning" | "info";
    language: "typescript" | "python" | "javascript" | "rust" | "go" | "java" | "c" | "webpack" | "generic";
    raw: string;
}

export interface ParsedDiagnosticOutput {
    diagnostics: CompilerDiagnostic[];
    /**
     * The primary (first error) diagnostic — most likely the failure origin.
     */
    primary?: CompilerDiagnostic;
    /**
     * Synthesized exceptionType for use in archetype detection.
     * E.g. "TypeScriptCompileError" | "PythonRuntimeError" | "ESLintError"
     */
    synthesizedExceptionType?: string;
    /**
     * Synthesized exceptionMessage for use in archetype detection.
     */
    synthesizedExceptionMessage?: string;
    /**
     * Synthetic stack frames derived from diagnostics for execution path.
     */
    syntheticFrames: Array<{
        filePath: string;
        lineNumber?: number;
        columnNumber?: number;
        functionName: string;
        isApplication: boolean;
        order: number;
    }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Library
// ─────────────────────────────────────────────────────────────────────────────

const TS_PAREN_PATTERN = /^([^(]+\.(?:ts|tsx|js|jsx|mts|cts))\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/;
const TS_COLON_PATTERN = /^([^:]+\.(?:ts|tsx|js|jsx|mts|cts)):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/;
const TS_SIMPLE_COLON = /^([^:]+\.(?:ts|tsx)):(\d+):(\d+):\s*(error|warning):\s*(.+)$/;

const ESLINT_PATTERN = /^([^\s][^:]+\.(?:js|ts|jsx|tsx|mjs|cjs)):(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S.*)$/;

const PYTHON_FILE_PATTERN = /^\s*File "([^"]+)", line (\d+)(?:, in (.+))?$/;
const PYTHON_EXC_PATTERN = /^([A-Za-z][A-Za-z0-9_.]*(?:Error|Exception|Warning|Fault|Interrupt|Exit|Break|Raise)):\s*(.+)$/;

const RUST_PATTERN = /^error\[([A-Z]\d+)\]:\s*(.+)$/;
const RUST_ARROW_PATTERN = /^\s*-->\s*([^:]+):(\d+):(\d+)$/;

const GO_PATTERN = /^\.?\/([^:]+\.go):(\d+):(\d+):\s*(.+)$/;

const JAVA_PATTERN = /^([^:]+\.java):(\d+):\s*(?:error|warning):\s*(.+)$/;

const GCC_PATTERN = /^([^:]+\.(?:c|cpp|cc|h|hpp)):(\d+):(\d+):\s*(error|warning):\s*(.+)$/;

const WEBPACK_PATTERN = /Module not found: Error: Can't resolve ['"]?([^'"]+)['"]? in ['"]?([^'"]+)['"]?/;
const WEBPACK_GENERAL = /ERROR in ([^\s]+)\n([^\n]+)/;

// ─────────────────────────────────────────────────────────────────────────────
// Individual Parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseTypeScriptDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    const lines = raw.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();

        // Format: src/file.ts(10,5): error TS2345: ...
        let m = trimmed.match(TS_PAREN_PATTERN);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                columnNumber: parseInt(m[3], 10),
                severity: m[4] as "error" | "warning",
                errorCode: m[5],
                errorMessage: m[6].trim(),
                language: "typescript",
                raw: trimmed,
            });
            continue;
        }

        // Format: src/file.ts:10:5 - error TS2345: ...
        m = trimmed.match(TS_COLON_PATTERN);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                columnNumber: parseInt(m[3], 10),
                severity: m[4] as "error" | "warning",
                errorCode: m[5],
                errorMessage: m[6].trim(),
                language: "typescript",
                raw: trimmed,
            });
            continue;
        }

        // Format: src/file.ts:10:5: error: message (tsc with --noEmit sometimes)
        m = trimmed.match(TS_SIMPLE_COLON);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                columnNumber: parseInt(m[3], 10),
                severity: m[4] as "error" | "warning",
                errorMessage: m[5].trim(),
                language: "typescript",
                raw: trimmed,
            });
        }
    }

    return results;
}

function parseESLintDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    const lines = raw.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        const m = trimmed.match(ESLINT_PATTERN);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                columnNumber: parseInt(m[3], 10),
                severity: m[4] as "error" | "warning",
                errorMessage: m[5].trim(),
                language: "javascript",
                raw: trimmed,
            });
        }
    }

    return results;
}

function parsePythonTraceback(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    const lines = raw.split("\n");

    let lastFilePath: string | undefined;
    let lastLineNumber: number | undefined;
    let lastFunctionName: string | undefined;

    for (const line of lines) {
        const fileMatcher = line.match(PYTHON_FILE_PATTERN);
        if (fileMatcher) {
            lastFilePath = fileMatcher[1];
            lastLineNumber = parseInt(fileMatcher[2], 10);
            lastFunctionName = fileMatcher[3];
            continue;
        }

        const excMatcher = line.trim().match(PYTHON_EXC_PATTERN);
        if (excMatcher && lastFilePath) {
            results.push({
                filePath: lastFilePath,
                lineNumber: lastLineNumber,
                functionName: lastFunctionName,
                severity: "error",
                errorMessage: `${excMatcher[1]}: ${excMatcher[2].trim()}`,
                errorCode: excMatcher[1], // exception class name as "code"
                language: "python",
                raw: line.trim(),
            } as CompilerDiagnostic);
            lastFilePath = undefined;
            lastLineNumber = undefined;
            lastFunctionName = undefined;
        }
    }

    return results;
}

function parseRustDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    const lines = raw.split("\n");

    let currentError: Partial<CompilerDiagnostic> | null = null;

    for (const line of lines) {
        const errorMatcher = line.trim().match(RUST_PATTERN);
        if (errorMatcher) {
            currentError = {
                severity: "error",
                errorCode: errorMatcher[1],
                errorMessage: errorMatcher[2].trim(),
                language: "rust",
                raw: line.trim(),
            };
            continue;
        }

        if (currentError) {
            const arrowMatcher = line.match(RUST_ARROW_PATTERN);
            if (arrowMatcher) {
                currentError.filePath = arrowMatcher[1].trim();
                currentError.lineNumber = parseInt(arrowMatcher[2], 10);
                currentError.columnNumber = parseInt(arrowMatcher[3], 10);
                results.push(currentError as CompilerDiagnostic);
                currentError = null;
            }
        }
    }

    return results;
}

function parseGoDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    for (const line of raw.split("\n")) {
        const m = line.match(GO_PATTERN);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                columnNumber: parseInt(m[3], 10),
                severity: "error",
                errorMessage: m[4].trim(),
                language: "go",
                raw: line.trim(),
            });
        }
    }
    return results;
}

function parseJavaDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    for (const line of raw.split("\n")) {
        const m = line.match(JAVA_PATTERN);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                severity: "error",
                errorMessage: m[3].trim(),
                language: "java",
                raw: line.trim(),
            });
        }
    }
    return results;
}

function parseGCCDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];
    for (const line of raw.split("\n")) {
        const m = line.match(GCC_PATTERN);
        if (m) {
            results.push({
                filePath: m[1].trim(),
                lineNumber: parseInt(m[2], 10),
                columnNumber: parseInt(m[3], 10),
                severity: m[4] as "error" | "warning",
                errorMessage: m[5].trim(),
                language: "c",
                raw: line.trim(),
            });
        }
    }
    return results;
}

function parseWebpackDiagnostics(raw: string): CompilerDiagnostic[] {
    const results: CompilerDiagnostic[] = [];

    const moduleMatch = raw.match(WEBPACK_PATTERN);
    if (moduleMatch) {
        results.push({
            filePath: moduleMatch[2].trim(),
            severity: "error",
            errorMessage: `Module not found: Can't resolve '${moduleMatch[1]}'`,
            errorCode: "MODULE_NOT_FOUND",
            language: "webpack",
            raw: moduleMatch[0],
        });
    }

    const generalMatch = raw.match(WEBPACK_GENERAL);
    if (generalMatch && results.length === 0) {
        results.push({
            filePath: generalMatch[1].trim(),
            severity: "error",
            errorMessage: generalMatch[2].trim(),
            errorCode: "WEBPACK_BUILD_ERROR",
            language: "webpack",
            raw: generalMatch[0],
        });
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection Heuristic
// ─────────────────────────────────────────────────────────────────────────────

function detectDiagnosticFormat(raw: string): "typescript" | "python" | "eslint" | "rust" | "go" | "java" | "gcc" | "webpack" | "none" {
    if (/TS\d+:/.test(raw)) return "typescript";
    if (/\((\d+),(\d+)\):\s*(error|warning)\s+TS/.test(raw)) return "typescript";
    if (/Traceback \(most recent call last\)/.test(raw) || /^\s*File ".*", line \d+/m.test(raw)) return "python";
    if (/Module not found: Error: Can't resolve/.test(raw) || /ERROR in\s+\S+/.test(raw)) return "webpack";
    if (/error\[E\d+\]/.test(raw) || (/^\s+-->\s+\S+:\d+:\d+/m.test(raw) && raw.includes("error["))) return "rust";
    if (/\.go:\d+:\d+:/.test(raw)) return "go";
    if (/\.java:\d+: error:/.test(raw)) return "java";
    if (/\.(?:c|cpp|cc|h|hpp):\d+:\d+:\s*(?:error|warning):/.test(raw)) return "gcc";
    if (/\.(js|ts|jsx|tsx):\d+:\d+\s+(error|warning)\s+.{5,}\s{2,}\S/.test(raw)) return "eslint";
    return "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses any compiler/build diagnostic output and returns structured diagnostics
 * enriched for use by the Halo recommendation pipeline.
 *
 * Returns null when the input does not appear to be compiler diagnostic output.
 */
export function parseCompilerDiagnostic(raw: string | undefined): ParsedDiagnosticOutput | null {
    if (!raw || raw.trim().length < 10) return null;

    const format = detectDiagnosticFormat(raw);
    if (format === "none") return null;

    let diagnostics: CompilerDiagnostic[] = [];

    switch (format) {
        case "typescript":
            diagnostics = parseTypeScriptDiagnostics(raw);
            break;
        case "python":
            diagnostics = parsePythonTraceback(raw);
            break;
        case "eslint":
            diagnostics = parseESLintDiagnostics(raw);
            break;
        case "rust":
            diagnostics = parseRustDiagnostics(raw);
            break;
        case "go":
            diagnostics = parseGoDiagnostics(raw);
            break;
        case "java":
            diagnostics = parseJavaDiagnostics(raw);
            break;
        case "gcc":
            diagnostics = parseGCCDiagnostics(raw);
            break;
        case "webpack":
            diagnostics = parseWebpackDiagnostics(raw);
            break;
    }

    if (diagnostics.length === 0) return null;

    const errors = diagnostics.filter(d => d.severity === "error");
    const primary = errors[0] || diagnostics[0];

    // Synthesize exceptionType and exceptionMessage from the primary diagnostic
    let synthesizedExceptionType: string | undefined;
    let synthesizedExceptionMessage: string | undefined;

    switch (primary.language) {
        case "typescript":
            synthesizedExceptionType = primary.errorCode
                ? `TypeScriptCompileError_${primary.errorCode}`
                : "TypeScriptCompileError";
            synthesizedExceptionMessage = primary.errorMessage;
            break;
        case "python": {
            // Python stores exception class name in errorCode
            const excClass = primary.errorCode || "PythonError";
            synthesizedExceptionType = excClass;
            synthesizedExceptionMessage = primary.errorMessage.replace(`${excClass}: `, "");
            break;
        }
        case "javascript":
            synthesizedExceptionType = "ESLintError";
            synthesizedExceptionMessage = primary.errorMessage;
            break;
        case "rust":
            synthesizedExceptionType = `RustCompileError_${primary.errorCode || "E0"}`;
            synthesizedExceptionMessage = primary.errorMessage;
            break;
        case "go":
            synthesizedExceptionType = "GoCompileError";
            synthesizedExceptionMessage = primary.errorMessage;
            break;
        case "java":
            synthesizedExceptionType = "JavaCompileError";
            synthesizedExceptionMessage = primary.errorMessage;
            break;
        case "c":
            synthesizedExceptionType = "CCompileError";
            synthesizedExceptionMessage = primary.errorMessage;
            break;
        case "webpack":
            synthesizedExceptionType = primary.errorCode === "MODULE_NOT_FOUND"
                ? "WebpackModuleNotFoundError"
                : "WebpackBuildError";
            synthesizedExceptionMessage = primary.errorMessage;
            break;
    }

    // Build synthetic stack frames (one per unique error diagnostic file location)
    const seenFiles = new Set<string>();
    const syntheticFrames: ParsedDiagnosticOutput["syntheticFrames"] = [];

    for (let i = 0; i < errors.length; i++) {
        const d = errors[i];
        const key = `${d.filePath}:${d.lineNumber}`;
        if (seenFiles.has(key)) continue;
        seenFiles.add(key);

        syntheticFrames.push({
            filePath: d.filePath,
            lineNumber: d.lineNumber,
            columnNumber: d.columnNumber,
            functionName: (d as any).functionName || `<${d.language}_error>`,
            isApplication: true,
            order: i + 1,
        });
    }

    return {
        diagnostics,
        primary,
        synthesizedExceptionType,
        synthesizedExceptionMessage,
        syntheticFrames,
    };
}

/**
 * Extracts a failing expression heuristic from a compiler diagnostic message.
 * Used to seed the archetype detection with a plausible failing expression.
 *
 * Examples:
 *   "Argument of type 'string | undefined' is not assignable to parameter of type 'string'"
 *     -> "argument" (undefined access)
 *   "Property 'foo' does not exist on type 'Bar'"
 *     -> "bar.foo" (property access)
 *   "Cannot find module './utils'"
 *     -> "import('./utils')" (module resolution)
 */
export function extractFailingExpressionFromDiagnostic(message: string): string {
    if (!message) return "";

    // TS: Property 'X' does not exist on type 'Y'
    const propNoExist = message.match(/Property '([^']+)' does not exist on type '([^']+)'/);
    if (propNoExist) {
        const typeName = propNoExist[2].split("<")[0].split("[")[0]; // strip generics/arrays
        return `${typeName.toLowerCase()}.${propNoExist[1]}`;
    }

    // TS: Object is possibly 'null' or Object is possibly 'undefined'
    const possiblyNull = message.match(/Object is possibly '(null|undefined)'/i);
    if (possiblyNull) {
        return `object.${possiblyNull[1]}`;
    }

    // TS: Cannot find module 'X'
    const cannotFind = message.match(/Cannot find module '([^']+)'/);
    if (cannotFind) {
        return `import('${cannotFind[1]}')`;
    }

    // TS: Argument of type 'X' is not assignable to parameter of type 'Y'
    const argNotAssignable = message.match(/Argument of type '([^']+)' is not assignable to parameter of type '([^']+)'/);
    if (argNotAssignable) {
        return argNotAssignable[1].includes("undefined") || argNotAssignable[1].includes("null")
            ? `argument // possibly ${argNotAssignable[1]}`
            : `argument`;
    }

    // Python: AttributeError: 'X' object has no attribute 'Y'
    const attrError = message.match(/AttributeError: '([^']+)' object has no attribute '([^']+)'/);
    if (attrError) {
        return `${attrError[1].toLowerCase()}.${attrError[2]}`;
    }

    // Python: TypeError: 'X' object is not subscriptable
    const notSubscriptable = message.match(/TypeError: '([^']+)' object is not subscriptable/);
    if (notSubscriptable) {
        return `${notSubscriptable[1].toLowerCase()}[0]`;
    }

    // Module not found
    if (message.includes("Module not found") || message.includes("Can't resolve")) {
        const moduleMatch = message.match(/resolve '([^']+)'/);
        return moduleMatch ? `import('${moduleMatch[1]}')` : "import(module)";
    }

    return "";
}
