# Phase 10 — Security & Provenance Audit (§104 - §106)

## Cryptographic Provenance & Command Safety

1. **SHA-256 Provenance Chaining**: Every resolved source, applied patch, and execution sandbox output is hashed with SHA-256.
2. **Non-Fabrication Enforcement**: Synthetic caller source code generation is strictly forbidden (§53). When source cannot be proven from an authoritative commit object, Halo reports `CALLER_SOURCE_UNAVAILABLE` and halts.
3. **Command Injection Prevention**: Execution command validation prevents arbitrary shell injection, restricting runner commands strictly to `node test/repro_*.mjs`.
4. **Hermetic Sandbox Isolation**: All validation runs in isolated temporary sandboxes with automated cleanup.
