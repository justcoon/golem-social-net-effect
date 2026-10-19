import { Effect, Ref, Schema } from "effect";
import {
  defineAgent,
  Http,
  method,
  Snapshot,
} from "@golemcloud/effect-golem";
import { TimestampSchema, Timestamp, ErrorResponseSchema } from "../common/types.js";
import { getCurrentTimestamp } from "../common/utils.js";
import { parseQuery } from "../common/query.js";
import { PostSchema, Post, PostAgent, fetchPostsByIds } from "../post/index.js";

export const PostRefSchema = Schema.Struct({
  postId: Schema.String,
  createdAt: TimestampSchema,
});

export type PostRef = Schema.Schema.Type<typeof PostRefSchema>;

export const UserPostsSchema = Schema.Struct({
  userId: Schema.String,
  posts: Schema.Array(PostRefSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type UserPosts = Schema.Schema.Type<typeof UserPostsSchema>;

export const UserPostsUpdatesSchema = Schema.Struct({
  userId: Schema.String,
  posts: Schema.Array(PostRefSchema),
});

export type UserPostsUpdates = Schema.Schema.Type<
  typeof UserPostsUpdatesSchema
>;

export function initUserPostsState(userId: string, now: Timestamp): UserPosts {
  return {
    userId,
    posts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addUserPost(
  state: UserPosts,
  postId: string,
  now: Timestamp,
): { updatedState: UserPosts; postRef: PostRef } {
  const postRef: PostRef = {
    postId,
    createdAt: now,
  };

  return {
    updatedState: {
      ...state,
      posts: [...state.posts, postRef],
      updatedAt: now,
    },
    postRef,
  };
}

export const UserPostsAgent = defineAgent({
  name: "UserPostsAgent",
  mode: "durable",
  id: {
    id: Schema.String,
  },
  http: Http.mount("/v1/social-net/users/{id}/posts"),
  snapshotting: Snapshot.define({
    schema: Schema.NullOr(UserPostsSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getPosts: method({
      input: {},
      success: Schema.NullOr(UserPostsSchema),
      http: [Http.get("/")],
    }),
    getUpdates: method({
      input: { updatesSince: TimestampSchema },
      success: Schema.NullOr(UserPostsUpdatesSchema),
    }),
    createPost: method({
      input: { content: Schema.String },
      success: PostRefSchema,
      http: [Http.post("/")],
    }),
  },
}).implement({
  init: ({ id }) =>
    Ref.make<UserPosts | null>(null).pipe(
      Effect.map((ref) => ({ id, ref })),
    ),
  methods: ({ id, ref }) => {
    const getOrInitState = Effect.gen(function* () {
      let current = yield* Ref.get(ref);
      if (current === null) {
        current = initUserPostsState(id, getCurrentTimestamp());
        yield* Ref.set(ref, current);
      }
      return current;
    });

    return {
      getPosts: () => Ref.get(ref),

      getUpdates: ({ updatesSince }) =>
        Ref.get(ref).pipe(
          Effect.map((s) => {
            if (s !== null) {
              const updates = s.posts.filter(
                (p) => p.createdAt.timestamp > updatesSince.timestamp,
              );
              return {
                userId: s.userId,
                posts: updates,
              };
            }
            return null;
          }),
        ),

      createPost: ({ content }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const s = yield* getOrInitState;
            const postId = crypto.randomUUID();
            yield* Effect.logInfo(`create post - id: ${postId}`);

            const now = getCurrentTimestamp();
            const { updatedState, postRef } = addUserPost(s, postId, now);
            yield* Ref.set(ref, updatedState);

            const postAgent = yield* PostAgent.client.get({ id: postId }).pipe(Effect.orDie);
            yield* postAgent.initPost.trigger({
              createdBy: s.userId,
              content,
            }).pipe(Effect.orDie);

            return postRef;
          }),
        ),
    };
  },
  snapshot: {
    save: (state) => Ref.get(state.ref),
    restore: (saved, context) =>
      Ref.make(saved).pipe(Effect.map((ref) => ({ id: context.id.id, ref }))),
  },
});

export const UserPostsViewAgent = defineAgent({
  name: "UserPostsViewAgent",
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
      http: [Http.get("/{userId}/posts/search?query={query}")],
    }),
    getPostsUpdatesView: method({
      input: {
        userId: Schema.String,
        since: Schema.NullOr(Schema.String),
      },
      success: Schema.NullOr(Schema.Array(PostSchema)),
      http: [Http.get("/{userId}/posts/updates?since={since}")],
    }),
  },
}).implement({
  init: () => Effect.void,
  methods: () => ({
    getPostsView: ({ userId, query }) =>
      Effect.gen(function* () {
        const postsAgent = yield* UserPostsAgent.client.get({ id: userId }).pipe(Effect.orDie);
        const userPosts = yield* postsAgent.getPosts({}).pipe(Effect.orDie);

        yield* Effect.logInfo(
          `get posts view - user id: ${userId}, query: ${query}`,
        );

        if (userPosts !== null) {
          const parsedQuery = parseQuery(query);
          const postIds = userPosts.posts.map((p) => p.postId);
          if (postIds.length === 0) {
            return [];
          } else {
            return yield* fetchPostsByIds(postIds, parsedQuery);
          }
        }
        return null;
      }),

    getPostsUpdatesView: ({ userId, since }) =>
      Effect.gen(function* () {
        const postsAgent = yield* UserPostsAgent.client.get({ id: userId }).pipe(Effect.orDie);
        const updatesSince = since ? { timestamp: since } : getCurrentTimestamp();
        const userPostsUpdates = yield* postsAgent.getUpdates({ updatesSince }).pipe(Effect.orDie);

        yield* Effect.logInfo(
          `get posts updates view - user id: ${userId}, updates since: ${since}`,
        );

        if (userPostsUpdates !== null) {
          const postIds = userPostsUpdates.posts.map((p) => p.postId);
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

