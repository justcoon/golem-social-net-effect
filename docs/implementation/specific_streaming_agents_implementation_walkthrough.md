# Feature Implementation Walkthrough: Specific Streaming Agents for Timeline and Chat Updates

- **Feature ID / Slug**: `specific-streaming-agents`
- **Date**: 2026-10-27
- **Status**: Ready for Review <!-- Ready for Review | Approved -->

---

## 1. Executive Summary

We separated streaming responsibilities from the ephemeral worker agents ([`UserTimelineUpdatesAgent`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-timeline/index.ts) and [`UserChatsUpdatesAgent`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-chats/index.ts)) into two dedicated, durable streaming agents:
- [`UserTimelineUpdatesStreamAgent`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-timeline/index.ts)
- [`UserChatsUpdatesStreamAgent`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-chats/index.ts)

Both streaming agents are defined with `mode: "durable"` and mounted with `{ phantomAgent: true }`. This architecture resolves ephemeral execution timeout limitations (`ephemeral_max_sleep`) and allows long-lived Durable Streams sessions to run independently with dedicated phantom instances per stream connection. Method names inside the streaming agents have been simplified to `getPostsUpdates` and `getChatsUpdates` while preserving identical external HTTP routes (`/updates/stream`).

---

## 2. Changes Implemented

### File Modifications

| Action     | File Path                                                                                  | Summary of Changes                                                                                                                                                    |
| :--------- | :----------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[MODIFY]` | [`src/common/poll.ts`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/common/poll.ts)                 | Added generic `streamUpdates` utility managing cursor tracking, interval scheduling, and caller context propagation for Durable Streams.                             |
| `[MODIFY]` | [`src/user-timeline/index.ts`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-timeline/index.ts) | Removed `getPostsUpdatesStream` from `UserTimelineUpdatesAgent`. Implemented `UserTimelineUpdatesStreamAgent` delegating `getPostsUpdates` to `streamUpdates`.       |
| `[MODIFY]` | [`src/user-chats/index.ts`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-chats/index.ts)       | Removed `getChatsUpdatesStream` from `UserChatsUpdatesAgent`. Implemented `UserChatsUpdatesStreamAgent` delegating `getChatsUpdates` to `streamUpdates`.             |
| `[MODIFY]` | [`golem.yaml`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/golem.yaml)                                   | Registered `UserChatsUpdatesStreamAgent` and `UserTimelineUpdatesStreamAgent` under `httpApi.deployments.local.agents`.                                              |
| `[MODIFY]` | [`frontend/src/api.ts`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/frontend/src/api.ts)                 | Added Durable Streams SSE helpers (`streamUpdates`, `streamChatUpdates`, `streamTimelineUpdates`), and `parseDate` / `formatTimestamp` utilities.                     |
| `[MODIFY]` | [`frontend/src/views/HomeView.vue`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/frontend/src/views/HomeView.vue) | Switched from timeline long-polling to Durable Streams via `streamTimelineUpdates`.                                                                                  |
| `[MODIFY]` | [`frontend/src/stores/chat.ts`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/frontend/src/stores/chat.ts)         | Switched from chat polling to Durable Streams via `streamChatUpdates`.                                                                                                |
| `[MODIFY]` | [`frontend/src/views/ChatView.vue`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/frontend/src/views/ChatView.vue) | Updated lifecycle hooks to start/stop chat streaming.                                                                                                                |
| `[MODIFY]` | [`frontend/src/views/SearchView.vue`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/frontend/src/views/SearchView.vue) | Fixed TypeScript type-safety issues in search options to ensure clean `vue-tsc` builds.                                                                              |
| `[MODIFY]` | [`README.md`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/README.md)                                       | Added streaming agents section under architecture documentation and updated the Real-time Synchronization overview.                                                  |
| `[MODIFY]` | [`docs/implementation/specific_streaming_agents_feature_plan.md`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/docs/implementation/specific_streaming_agents_feature_plan.md) | Created and marked the feature plan as completed.                                                                                                                     |

### Key Logic & API Changes

1. **Common `streamUpdates` Utility ([`src/common/poll.ts`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/common/poll.ts))**:
   - Created reusable generic helper mirroring `pollForUpdates`:
     ```typescript
     export function streamUpdates<T>(
       userId: string,
       since: string | null | undefined,
       iterWaitTime: number | null | undefined,
       fetchUpdates: (userId: string, since: string) => Effect.Effect<T[] | null, any, any>,
       getItemTimestamp: (item: T) => string,
     ): Effect.Effect<Stream.Stream<T, unknown, never>, never, any>
     ```
   - Encapsulates `cursorRef` tracking, interval scheduling with `Schedule.spaced`, and context propagation to eliminate boilerplate across streaming agents.

2. **[`UserTimelineUpdatesStreamAgent`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-timeline/index.ts)**:
   - Defined with `mode: "durable"`, `id: {}`, and `http: Http.mount("/v1/social-net/users", { phantomAgent: true })`.
   - Exposes `getPostsUpdates` mapped to `GET /{userId}/timeline/posts/updates/stream?since={since}&iterWaitTime={iterWaitTime}` with Durable Streams slot configuration.
   - Delegates stream polling to `streamUpdates(...)`.

3. **[`UserChatsUpdatesStreamAgent`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/src/user-chats/index.ts)**:
   - Defined with `mode: "durable"`, `id: {}`, and `http: Http.mount("/v1/social-net/users", { phantomAgent: true })`.
   - Exposes `getChatsUpdates` mapped to `GET /{userId}/chats/updates/stream?since={since}&iterWaitTime={iterWaitTime}` with Durable Streams slot configuration.
   - Delegates stream polling to `streamUpdates(...)`.

4. **Ephemeral Updates Agents**:
   - `UserTimelineUpdatesAgent` and `UserChatsUpdatesAgent` now strictly contain polling methods (`getPostsUpdates` and `getChatsUpdates`).

5. **Application Manifest & API Deployment**:
   - Both new streaming agents registered under `httpApi.deployments.local.agents` in [`golem.yaml`](file:///Users/coon/workspace-zv/git/golem-social-net-effect/golem.yaml).

---

## 3. Verification & Validation Results

### 3.1 Code Formatting

Command executed:
```bash
npm run format:check
```

**Result**:
```text
> format:check
> prettier --check .

Checking formatting...
All matched files use Prettier code style!
```

### 3.2 Type Checking

Command executed:
```bash
npm run typecheck
```

**Result**:
```text
> typecheck
> tsc --noEmit
```
Completed with exit code `0` (zero TypeScript errors).

### 3.3 Linter Verification

Command executed:
```bash
npm run lint
```

**Result**:
```text
> lint
> eslint .

✖ 12 problems (0 errors, 12 warnings)
```
Completed with exit code `0` (zero lint errors; warnings exist only in pre-existing codebase files).

### 3.4 Golem Component Build

Command executed:
```bash
npm run build
```

**Result**:
```text
> build
> golem build --yes

Selecting components
  Found components: golem-social-net-effect:effect-main
  Selected components and layers:
    golem-social-net-effect:effect-main: effect, effect[optimized],
         golem-social-net-effect:effect-main,
         golem-social-net-effect:effect-main[local]
Building components
  Building golem-social-net-effect:effect-main
    Executing external command 'npx tsc ...' [OK]
    Executing external command 'npx --no rollup ...' [OK]
    Injecting JS module ... into QuickJS WASM ...
    Pre-initializing JS component ... into ...
Reading component from .../golem_social_net_effect_effect_main.dynamic.wasm...
Pre-initializing component (init_func=wizer-initialize)...
Writing pre-initialized component to .../golem_social_net_effect_effect_main.preinitialized.wasm...
Done! Input: 18234.0 KB, Output: 43634.9 KB
  Adding metadata to golem-social-net-effect:effect-main

Finished building [OK]
```

---

## 4. How to Run & Verify

1. **Build and Deploy**:
   ```bash
   golem build
   golem deploy
   ```

2. **Verify Streaming Endpoints**:
   - Stream timeline updates:
     ```bash
     curl -N "http://localhost:9006/v1/social-net/users/user-1/timeline/posts/updates/stream"
     ```
   - Stream chat updates:
     ```bash
     curl -N "http://localhost:9006/v1/social-net/users/user-1/chats/updates/stream"
     ```

3. **Verify Polling Endpoints**:
   - Poll timeline updates:
     ```bash
     curl "http://localhost:9006/v1/social-net/users/user-1/timeline/posts/updates"
     ```
   - Poll chat updates:
     ```bash
     curl "http://localhost:9006/v1/social-net/users/user-1/chats/updates"
     ```

---

## 5. Sign-off / Next Steps

Implementation and validation are complete. All checks passed with zero errors. Awaiting final user approval.
