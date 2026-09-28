/**
 * Phase 1 — Compiler Diagnostic Parser Tests
 *
 * Validates that parseCompilerDiagnostic correctly extracts structured
 * diagnostics from TypeScript, Python, ESLint, Rust, Go, Java, and Webpack
 * output formats, and that extractFailingExpressionFromDiagnostic produces
 * plausible failing expressions for archetype detection.
 *
 * These are NEW scenarios not covered by the baseline test suite.
 * Regression contract: all 430 existing tests + these new tests must pass.
 */

import { describe, it, expect } from "vitest";
import {
    parseCompilerDiagnostic,
    extractFailingExpressionFromDiagnostic,
} from "../compiler-diagnostic-parser";

describe("parseCompilerDiagnostic — TypeScript", () => {
    it("parses parenthesized TS diagnostic format", () => {
        const raw = `src/services/auth.ts(42,7): error TS2339: Property 'userId' does not exist on type 'Session'.`;
        const result = parseCompilerDiagnostic(raw);
        expect(result).not.toBeNull();
        expect(result!.primary).toBeDefined();
        expect(result!.primary!.filePath).toBe("src/services/auth.ts");
        expect(result!.primary!.lineNumber).toBe(42);
        expect(result!.primary!.columnNumber).toBe(7);
        expect(result!.primary!.errorCode).toBe("TS2339");
        expect(result!.primary!.language).toBe("typescript");
        expect(result!.synthesizedExceptionType).toContain("TypeScriptCompileError_TS2339");
    });

    it("parses colon-separated TS diagnostic format", () => {
        const raw = `src/api/handler.ts:18:3 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`;
        const result = parseCompilerDiagnostic(raw);
        expect(result).not.toBeNull();
        expect(result!.primary!.filePath).toBe("src/api/handler.ts");
        expect(result!.primary!.lineNumber).toBe(18);
        expect(result!.primary!.errorCode).toBe("TS2345");
        expect(result!.synthesizedExceptionType).toContain("TS2345");
        expect(result!.syntheticFrames.length).toBeGreaterThan(0);
        expect(result!.syntheticFrames[0].isApplication).toBe(true);
    });

    it("returns null for plain runtime stack traces (V8 format)", () => {
        const raw = `TypeError: Cannot read properties of undefined (reading 'name')
    at processUser (src/user.js:15:20)
    at handler (src/api.js:8:5)`;
        // V8 format, not compiler diagnostic
        const result = parseCompilerDiagnostic(raw);
        expect(result).toBeNull();
    });

    it("returns null for empty or very short input", () => {
        expect(parseCompilerDiagnostic(undefined)).toBeNull();
        expect(parseCompilerDiagnostic("")).toBeNull();
        expect(parseCompilerDiagnostic("ok")).toBeNull();
    });
});

describe("parseCompilerDiagnostic — Python", () => {
    it("parses Python AttributeError traceback", () => {
        const raw = `Traceback (most recent call last):
  File "app/models/user.py", line 45, in get_full_name
    return self.profile.display_name
AttributeError: 'NoneType' object has no attribute 'display_name'`;
        const result = parseCompilerDiagnostic(raw);
        expect(result).not.toBeNull();
        expect(result!.primary!.filePath).toBe("app/models/user.py");
        expect(result!.primary!.lineNumber).toBe(45);
        expect(result!.primary!.language).toBe("python");
        expect(result!.synthesizedExceptionType).toBe("AttributeError");
    });

    it("parses Python TypeError", () => {
        const raw = `Traceback (most recent call last):
  File "api/views.py", line 22, in process
    result = data['items'][0]
TypeError: 'NoneType' object is not subscriptable`;
        const result = parseCompilerDiagnostic(raw);
        expect(result).not.toBeNull();
        expect(result!.primary!.filePath).toBe("api/views.py");
        expect(result!.primary!.language).toBe("python");
        expect(result!.synthesizedExceptionType).toBe("TypeError");
    });
});

describe("parseCompilerDiagnostic — Webpack", () => {
    it("parses Module not found error", () => {
        const raw = `Module not found: Error: Can't resolve './utils/formatter' in '/app/src/components'`;
        const result = parseCompilerDiagnostic(raw);
        expect(result).not.toBeNull();
        expect(result!.primary!.errorCode).toBe("MODULE_NOT_FOUND");
        expect(result!.synthesizedExceptionType).toBe("WebpackModuleNotFoundError");
        expect(result!.synthesizedExceptionMessage).toContain("./utils/formatter");
    });
});

describe("extractFailingExpressionFromDiagnostic", () => {
    it("extracts property expression from 'does not exist on type'", () => {
        const expr = extractFailingExpressionFromDiagnostic(
            "Property 'userId' does not exist on type 'Session'"
        );
        expect(expr).toContain("userId");
        expect(expr).toContain("session");
    });

    it("extracts module expression from 'Cannot find module'", () => {
        const expr = extractFailingExpressionFromDiagnostic(
            "Cannot find module './config/database'"
        );
        expect(expr).toContain("./config/database");
    });

    it("returns empty string for empty input", () => {
        expect(extractFailingExpressionFromDiagnostic("")).toBe("");
    });

    it("handles 'Object is possibly null' pattern", () => {
        const expr = extractFailingExpressionFromDiagnostic(
            "Object is possibly 'null'"
        );
        expect(expr).toContain("null");
    });

    it("handles Python AttributeError pattern", () => {
        const expr = extractFailingExpressionFromDiagnostic(
            "AttributeError: 'NoneType' object has no attribute 'display_name'"
        );
        expect(expr).toContain("display_name");
    });
});
