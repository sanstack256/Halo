import { describe, expect, it } from "vitest";
import {
    buildGitHubContentsUrl,
    classifyGitHubSourceStatus,
    normalizeRepositoryFilePath,
    selectGitHubSourceRef,
} from "../../../apps/dashboard/src/lib/investigation/runtime/github-source-utils";

describe("GitHub source resolution regression coverage", () => {
    const repository = "example-service";

    it("normalizes an absolute macOS stack path from a repository checkout", () => {
        expect(normalizeRepositoryFilePath(
            "/Users/alex/work/example-service/index.js",
            repository,
        )).toBe("index.js");
    });

    it("removes a repository-prefixed relative path exactly once", () => {
        expect(normalizeRepositoryFilePath(
            "example-service/index.js",
            repository,
        )).toBe("index.js");
    });

    it("keeps Unix repository-relative paths intact", () => {
        expect(normalizeRepositoryFilePath(
            "/home/build/example-service/src/server/handler.ts",
            repository,
        )).toBe("src/server/handler.ts");
    });

    it("normalizes Windows-style checkout paths", () => {
        expect(normalizeRepositoryFilePath(
            "C:\\work\\example-service\\src\\server\\handler.ts",
            repository,
        )).toBe("src/server/handler.ts");
    });

    it("uses an event commit SHA instead of the configured branch", () => {
        expect(selectGitHubSourceRef("5a7012e4b01c2d3e4f5a6b7c8d9e0f1234567890", "main")).toEqual({
            ref: "5a7012e4b01c2d3e4f5a6b7c8d9e0f1234567890",
            commitSha: "5a7012e4b01c2d3e4f5a6b7c8d9e0f1234567890",
        });
    });

    it("uses the configured branch when no commit SHA exists", () => {
        expect(selectGitHubSourceRef(undefined, "main")).toEqual({ ref: "main" });
        expect(selectGitHubSourceRef("example-service-2.0.0", "main")).toEqual({ ref: "main" });
    });

    it("builds a Contents request with the exact repository-relative path", () => {
        const path = normalizeRepositoryFilePath(
            "Users/alex/example-service/index.js",
            repository,
        );
        const { ref } = selectGitHubSourceRef(undefined, "main");
        const url = buildGitHubContentsUrl("octo-org", repository, path, ref);

        expect(path).toBe("index.js");
        expect(url).toBe(
            "https://api.github.com/repos/octo-org/example-service/contents/index.js?ref=main",
        );
        expect(url).not.toContain("contents/example-service/index.js");
    });

    it("uses a verified commit SHA in the Contents request", () => {
        const { ref } = selectGitHubSourceRef("5a7012e", "main");
        expect(buildGitHubContentsUrl("octo-org", repository, "index.js", ref)).toContain(
            "ref=5a7012e",
        );
    });

    it("classifies a real 404 at the normalized path and selected ref as file_not_found", () => {
        expect(classifyGitHubSourceStatus(404)).toBe("file_not_found");
    });

    it("does not treat a corrected local path as a missing repository file", () => {
        const correctedPath = normalizeRepositoryFilePath(
            "Users/alex/example-service/index.js",
            repository,
        );
        expect(correctedPath).toBe("index.js");
        expect(correctedPath).not.toBe("example-service/index.js");
    });
});
