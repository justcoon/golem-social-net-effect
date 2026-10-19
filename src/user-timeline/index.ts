import { Effect, Ref, Schema } from "effect";
import {
  defineAgent,
  Http,
  method,
  Snapshot,
} from "@golemcloud/effect-golem";
import { TimestampSchema } from "../common/types.js";
import { parseQuery } from "../common/query.js";
import { getCurrentTimestamp } from "../common/utils.js";
import { pollForUpdates } from "../common/poll.js";
import { PostSchema, fetchPostsByIds } from "../post/index.js";
import {
  TimelinePostRefSchema,
  UserTimelineSchema,
  UserTimelineUpdatesSchema,
  initUserTimelineState,
  updateUserTimelinePosts,
  matchesPostRef,
  TimelinePostRef,
  UserTimeline,
} from "./schema.js";

import { UserTimelineAgent } from "./spec.js";

export * from "./schema.js";
export * from "./spec.js";

UserTimelineAgent.implement({
  init: ({ id }) =>
    Ref.make<UserTimeline | null>(null).pipe(
      Effect.map((ref) => ({ id, ref })),
    ),
  methods: ({ id, ref }) => {
    const getOrInitState = Effect.gen(function* () {
      let current = yield* Ref.get(ref);
      if (current === null) {
        current = initUserTimelineState(id, getCurrentTimestamp());
        yield* Ref.set(ref, current);
      }
      return current;
    });

    return {
      getTimeline: () => Ref.get(ref),

      getUpdates: ({ updatesSince }) =>
        Ref.get(ref).pipe(
          Effect.map((s) => {
            if (s !== null) {
              const updates = s.posts.filter(
                (p) => p.updatedAt.timestamp > updatesSince.timestamp,
              );
              return {
                userId: s.userId,
                posts: updates,
              };
            }
            return null;
          }),
        ),

      postsUpdated: ({ posts }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          yield* Effect.logInfo(`posts updated - count: ${posts.length}`);
          const updatedState = updateUserTimelinePosts(s, posts, getCurrentTimestamp());
          yield* Ref.set(ref, updatedState);
        }),
    };
  },
  snapshot: {
    save: (state) => Ref.get(state.ref),
    restore: (saved, context) =>
      Ref.make(saved).pipe(Effect.map((ref) => ({ id: context.id.id, ref }))),
  },
});

export const UserTimelineViewAgent = defineAgent({
  name: "UserTimelineViewAgent",
  mode: "ephemeral",
  id: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getPostsView: method({
      input: {
        userId: Schema.String,
        query: Schema.String,
      },
      success: Schema.NullOr(Schema.Array(PostSchema)),
      http: [Http.get("/{userId}/timeline/posts?query={query}")],
    }),
    getPostsUpdatesView: method({
      input: {
        userId: Schema.String,
        updatesSince: TimestampSchema,
      },
      success: Schema.NullOr(Schema.Array(PostSchema)),
    }),
  },
}).implement({
  init: () => Effect.void,
  methods: () => ({
    getPostsView: ({ userId, query }) =>
      Effect.gen(function* () {
        const uTimelineAgent = yield* UserTimelineAgent.client
          .get({ id: userId })
          .pipe(Effect.orDie);
        const timelinePosts = yield* uTimelineAgent
          .getTimeline({})
          .pipe(Effect.orDie);

        yield* Effect.logInfo(`get posts view - user id: ${userId}, query: ${query}`);

        if (timelinePosts !== null) {
          const parsedQuery = parseQuery(query);

          const postIds = timelinePosts.posts
            .filter((p) => matchesPostRef(p, parsedQuery))
            .map((p) => p.postId);

          if (postIds.length === 0) {
            return [];
          } else {
            return yield* fetchPostsByIds(postIds, parsedQuery);
          }
        }
        return null;
      }),

    getPostsUpdatesView: ({ userId, updatesSince }) =>
      Effect.gen(function* () {
        const uTimelineAgent = yield* UserTimelineAgent.client
          .get({ id: userId })
          .pipe(Effect.orDie);
        const timelineUpdates = yield* uTimelineAgent
          .getUpdates({ updatesSince })
          .pipe(Effect.orDie);

        yield* Effect.logInfo(
          `get posts updates view - user id: ${userId}, updates since: ${updatesSince.timestamp}`,
        );

        if (timelineUpdates !== null) {
          const postIds = timelineUpdates.posts.map((p) => p.postId);

          if (postIds.length === 0) {
            return [];
          } else {
            return yield* fetchPostsByIds(postIds, undefined);
          }
        }
        return null;
      }),
  }),
});

export const UserTimelineUpdatesAgent = defineAgent({
  name: "UserTimelineUpdatesAgent",
  mode: "ephemeral",
  id: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getPostsUpdates: method({
      input: {
        userId: Schema.String,
        since: Schema.NullOr(Schema.String),
        iterWaitTime: Schema.NullOr(Schema.Number),
        maxWaitTime: Schema.NullOr(Schema.Number),
      },
      success: Schema.NullOr(Schema.Array(TimelinePostRefSchema)),
      http: [
        Http.get(
          "/{userId}/timeline/posts/updates?since={since}&iterWaitTime={iterWaitTime}&maxWaitTime={maxWaitTime}",
        ),
      ],
    }),
  },
}).implement({
  init: () => Effect.void,
  methods: () => ({
    getPostsUpdates: ({ userId, since, iterWaitTime, maxWaitTime }) =>
      Effect.gen(function* () {
        const uSince = since ? { timestamp: since } : undefined;
        const iWait = iterWaitTime ?? undefined;
        const mWait = maxWaitTime ?? undefined;

        const res = yield* pollForUpdates<TimelinePostRef>(
          userId,
          uSince,
          iWait,
          mWait,
          (uid, sinceTime) =>
            Effect.gen(function* () {
              const uAgent = yield* UserTimelineAgent.client
                .get({ id: uid })
                .pipe(Effect.orDie);
              const updates = yield* uAgent
                .getUpdates({ updatesSince: sinceTime })
                .pipe(Effect.orDie);
              return updates ? [...updates.posts] : null;
            }),
          "get posts updates",
        );
        return res;
      }),
  }),
});
