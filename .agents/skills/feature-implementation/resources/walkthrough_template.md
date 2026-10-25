# Feature Implementation Walkthrough: [Feature Title]

- **Feature ID / Slug**: `[feature_name_or_id]`
- **Date**: [YYYY-MM-DD]
- **Status**: Ready for Review <!-- Ready for Review | Approved -->

---

## 1. Executive Summary

Brief summary of what was implemented, how it satisfies the original feature plan, and overall status.

---

## 2. Changes Implemented

### File Modifications

| Action     | File Path                                          | Summary of Changes     |
| :--------- | :------------------------------------------------- | :--------------------- |
| `[NEW]`    | [`path/to/file.ts`](../../path/to/file.ts)         | Implementation summary |
| `[MODIFY]` | [`path/to/existing.ts`](../../path/to/existing.ts) | Implementation summary |

### Key Logic & API Changes

- Detailed highlights of agents, schemas, methods, or workflows added or modified.

---

## 3. Verification & Validation Results

### 3.1 Code Formatting

Command executed:

```bash
npm run format:check # npx prettier --check src/ test/
```

**Result**:

```text
[Output confirming all files match formatting standards]
```

### 3.2 Type Checking

Command executed:

```bash
npm run typecheck   # npx tsc --noEmit
```

**Result**:

```text
[Output or confirmation of zero errors]
```

### 3.3 Linter Verification

Command executed:

```bash
npm run lint        # npx eslint src/ test/
```

**Result**:

```text
[Output or confirmation of zero lint errors]
```

### 3.4 Golem Build

Command executed:

```bash
npm run build       # golem build --yes
```

**Result**:

```text
[Output confirming successful build of WASM components]
```

### 3.5 Automated Unit & Integration Test Suite Execution

Command executed:

```bash
npm test            # npx tsx --test "test/*.test.ts"
```

**Result**:

```text
[Test runner output showing passed unit & integration tests]
```

### 3.6 Containerized End-to-End (E2E) Test Suite Execution

Command executed:

```bash
./run_e2e_test.sh   # or npm run test:e2e
```

**Result**:

```text
[E2E test runner output showing passed end-to-end test suites]
```

### 3.7 Runtime / Smoke Testing

- Agent invocations, RPC checks, or scenario tests conducted.

---

## 4. How to Run & Verify

Instructions for the user or reviewer to test the feature themselves:

1. Commands to deploy or run locally:
   ```bash
   golem deploy
   ```
2. Invocations or REPL steps:
   ```bash
   golem agent invoke ...
   ```

---

## 5. Sign-off / Next Steps

- Awaiting user approval.
- Follow-up recommendations or future enhancements.
