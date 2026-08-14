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
} from "./schema.js";

export * from "./schema.js";

export const UserTimelineAgent = defineAgent({
  name: "UserTimelineAgent",
  mode: "durable",
  constructorParams: {
    id: Schema.String,
  },
  snapshot: Snapshot.define({
    schema: Schema.NullOr(UserTimelineSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getTimeline: method({
      params: {},
      success: Schema.NullOr(UserTimelineSchema),
    }),
    getUpdates: method({
      params: { updatesSince: TimestampSchema },
      success: Schema.NullOr(UserTimelineUpdatesSchema),
    }),
    postsUpdated: method({
      params: { posts: Schema.Array(TimelinePostRefSchema) },
      success: Schema.Void,
    }),
  },
}).implement(({ id }, snapshot) =>
  Effect.gen(function* () {
    const state = yield* snapshot.init(null);

    const getOrInitState = Effect.gen(function* () {
      let current = yield* Ref.get(state);
      if (current === null) {
        current = initUserTimelineState(id, getCurrentTimestamp());
        yield* Ref.set(state, current);
      }
      return current;
    });

    return {
      getTimeline: () => Ref.get(state),

      getUpdates: ({ updatesSince }) =>
        Ref.get(state).pipe(
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
          yield* Ref.set(state, updatedState);
        }),
    };
  }),
);

export const UserTimelineViewAgent = defineAgent({
  name: "UserTimelineViewAgent",
  mode: "ephemeral",
  constructorParams: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getPostsView: method({
      params: {
        userId: Schema.String,
        query: Schema.String,
      },
      success: Schema.NullOr(Schema.Array(PostSchema)),
      http: [Http.get("/{userId}/timeline/posts?query={query}")],
    }),
    getPostsUpdatesView: method({
      params: {
        userId: Schema.String,
        updatesSince: TimestampSchema,
      },
      success: Schema.NullOr(Schema.Array(PostSchema)),
    }),
  },
}).implement(() =>
  Effect.succeed({
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
);

export const UserTimelineUpdatesAgent = defineAgent({
  name: "UserTimelineUpdatesAgent",
  mode: "ephemeral",
  constructorParams: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getPostsUpdates: method({
      params: {
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
}).implement(() =>
  Effect.succeed({
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
);
