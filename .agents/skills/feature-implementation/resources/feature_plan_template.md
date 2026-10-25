# Feature Plan: [Feature Title]

- **Feature ID / Slug**: `[feature_name_or_id]`
- **Date**: [YYYY-MM-DD]
- **Status**: Draft <!-- Draft | Approved | In Progress | Completed -->

---

## 1. Overview & Goals

Provide a clear description of the feature, business context, problem being solved, and success criteria.

### Goals

- Goal 1
- Goal 2

### Non-Goals

- What is intentionally out of scope.

---

## 2. Architecture & Technical Design

Explain the technical approach, architectural considerations, and integrations (e.g. Golem agent contracts, Effect services, schemas, database/storage).

### Key Decisions

- Decision 1: Rationale
- Decision 2: Rationale

---

## 3. Proposed Changes & File Impact

List all files that will be created, modified, or removed. Group by component or module.

| Action     | File Path                                          | Description                 |
| :--------- | :------------------------------------------------- | :-------------------------- |
| `[NEW]`    | [`path/to/file.ts`](../../path/to/file.ts)         | Purpose of new file         |
| `[MODIFY]` | [`path/to/existing.ts`](../../path/to/existing.ts) | Specific changes to be made |
| `[DELETE]` | [`path/to/old.ts`](../../path/to/old.ts)           | Reason for removal          |

### Detailed Changes

#### [Component / Module Name]

- **`[path/to/file.ts]`**:
  - Detailed description of types, methods, or logic changes.

---

## 4. Verification Plan

### Automated Checks

- **Code Formatting**:
  ```bash
  npm run format:check # npx prettier --check src/ test/
  ```
- **Type Checking**:
  ```bash
  npm run typecheck   # npx tsc --noEmit
  ```
- **Linter Verification**:
  ```bash
  npm run lint        # npx eslint src/ test/
  ```
- **Golem Component Build**:
  ```bash
  npm run build       # golem build --yes
  ```
- **Automated Unit & Integration Tests**:
  ```bash
  npm test            # npx tsx --test "test/*.test.ts"
  ```
- **End-to-End (E2E) Test Suite**:
  ```bash
  ./run_e2e_test.sh   # or npm run test:e2e
  ```

### Manual / Integration Verification

- Steps to deploy, invoke agents, or verify runtime behaviors.

---

## 5. Risks & Open Questions

- **Risk 1**: Mitigation strategy
- **Open Question 1**: Awaiting user input
