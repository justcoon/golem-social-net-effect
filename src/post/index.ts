import { Effect, Ref, Schema } from "effect";
import {
  defineAgent,
  Http,
  method,
  Snapshot,
} from "@golemcloud/effect-golem";
import {
  LikeTypeSchema,
  ErrorResponseSchema,
} from "../common/types.js";
import { Query, QuerySchema } from "../common/query.js";
import { arrayChunks, getCurrentTimestamp } from "../common/utils.js";
import { UserAgent } from "../user/index.js";
import { UserTimelineAgent } from "../user-timeline/spec.js";
import {
  CommentSchema,
  AddCommentResponseSchema,
  UpdatePostResponseSchema,
  PostSchema,
  Post,
  postMatchesQuery,
  PostUpdateSchema,
  PostUpdatesSchema,
  initPostUpdates,
  updatePostUpdates,
  clearPostUpdates,
  initPostState,
  initializePostAgent,
  setPostLike,
  removePostLike,
  addPostComment,
  removePostComment,
  setPostCommentLike,
  removePostCommentLike,
} from "./schema.js";
import { TimelinePostRef } from "../user-timeline/schema.js";

export * from "./schema.js";

export const TimelinesUpdaterAgent = defineAgent({
  name: "TimelinesUpdaterAgent",
  mode: "durable",
  constructorParams: {
    id: Schema.String,
  },
  snapshot: Snapshot.define({
    schema: Schema.NullOr(PostUpdatesSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    postUpdated: method({
      params: {
        update: PostUpdateSchema,
        processImmediately: Schema.Boolean,
      },
      success: Schema.Void,
    }),
    processPostsUpdates: method({
      params: {},
      success: Schema.Void,
    }),
  },
}).implement(({ id }, snapshot) =>
  Effect.gen(function* () {
    const state = yield* snapshot.init(null);

    const getOrInitState = Effect.gen(function* () {
      let current = yield* Ref.get(state);
      if (current === null) {
        current = initPostUpdates(id, getCurrentTimestamp());
        yield* Ref.set(state, current);
      }
      return current;
    });

    const executePostsUpdates = Effect.gen(function* () {
      const s = yield* getOrInitState;
      if (s.updates.length === 0) {
        return;
      }

      yield* Effect.logInfo(
        `posts updates - user id: ${id} - updates: ${s.updates.length} - processing ...`,
      );

      const userAgent = yield* UserAgent.client
        .get({ id })
        .pipe(Effect.orDie);
      const user = yield* userAgent.getUser({}).pipe(Effect.orDie);

      if (user !== null) {
        const { clearedState, updates } = clearPostUpdates(s, getCurrentTimestamp());
        yield* Ref.set(state, clearedState);

        const connectedUsers = user.connectedUsers;
        const postRefs: TimelinePostRef[] = updates.map((u) => ({
          postId: u.postId,
          createdBy: id,
          createdByConnectionType: null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        }));

        const selfTimeline = yield* UserTimelineAgent.client
          .get({ id })
          .pipe(Effect.orDie);
        yield* selfTimeline.postsUpdated
          .trigger({ posts: postRefs })
          .pipe(Effect.orDie);

        for (const cuTuple of connectedUsers) {
          const cu = cuTuple[1];
          for (const ct of cu.connectionTypes) {
            const notifyPostRefs: TimelinePostRef[] = updates.map((u) => ({
              postId: u.postId,
              createdBy: id,
              createdByConnectionType: ct,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
            }));
            const cuTimeline = yield* UserTimelineAgent.client
              .get({ id: cu.userId })
              .pipe(Effect.orDie);
            yield* cuTimeline.postsUpdated
              .trigger({ posts: notifyPostRefs })
              .pipe(Effect.orDie);
          }
        }
      } else {
        yield* Effect.logInfo(`posts updates - user id: ${id} - not found`);
      }
    });

    return {
      postUpdated: ({ update, processImmediately }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`timelines updater - user: ${id}, post: ${update.postId}`);
          const s = yield* getOrInitState;
          const updated = updatePostUpdates(s, update, getCurrentTimestamp());
          yield* Ref.set(state, updated);

          if (processImmediately) {
            yield* executePostsUpdates;
          }
        }),

      processPostsUpdates: () => executePostsUpdates,
    };
  }),
);

export const PostAgent = defineAgent({
  name: "PostAgent",
  mode: "durable",
  constructorParams: {
    id: Schema.String,
  },
  http: Http.mount("/v1/social-net/posts/{id}"),
  snapshot: Snapshot.define({
    schema: Schema.NullOr(PostSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getPost: method({
      params: {},
      success: Schema.NullOr(PostSchema),
      http: [Http.get("/")],
    }),
    getPostIfMatch: method({
      params: { query: QuerySchema },
      success: Schema.NullOr(PostSchema),
    }),
    initPost: method({
      params: { createdBy: Schema.String, content: Schema.String },
      success: UpdatePostResponseSchema,
      error: ErrorResponseSchema,
    }),
    setLike: method({
      params: { userId: Schema.String, likeType: LikeTypeSchema },
      success: UpdatePostResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.put("/likes")],
    }),
    removeLike: method({
      params: { userId: Schema.String },
      success: UpdatePostResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.del("/likes/{userId}")],
    }),
    addComment: method({
      params: {
        userId: Schema.String,
        content: Schema.String,
        parentCommentId: Schema.NullOr(Schema.String),
      },
      success: AddCommentResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.post("/comments")],
    }),
    removeComment: method({
      params: { commentId: Schema.String },
      success: UpdatePostResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.del("/comments/{commentId}")],
    }),
    setCommentLike: method({
      params: {
        commentId: Schema.String,
        userId: Schema.String,
        likeType: LikeTypeSchema,
      },
      success: UpdatePostResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.put("/comments/{commentId}/likes")],
    }),
    removeCommentLike: method({
      params: {
        commentId: Schema.String,
        userId: Schema.String,
      },
      success: UpdatePostResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.del("/comments/{commentId}/likes/{userId}")],
    }),
  },
}).implement(({ id }, snapshot) =>
  Effect.gen(function* () {
    const state = yield* snapshot.init(null);

    return {
      getPost: () => Ref.get(state),

      getPostIfMatch: ({ query }) =>
        Ref.get(state).pipe(
          Effect.map((s) => (s && postMatchesQuery(s, query) ? s : null)),
        ),

      initPost: ({ createdBy, content }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s !== null) {
            return yield* Effect.fail({ message: "Post already exists" });
          }

          let newPost = initPostState(id, getCurrentTimestamp());
          yield* Effect.logInfo(
            `init post - created by: ${createdBy}, content: ${content}`,
          );

          newPost = initializePostAgent(newPost, createdBy, content);
          yield* Ref.set(state, newPost);

          const updater = yield* TimelinesUpdaterAgent.client
            .get({ id: createdBy })
            .pipe(Effect.orDie);
          yield* updater.postUpdated
            .trigger({
              update: {
                postId: newPost.postId,
                createdAt: newPost.createdAt,
                updatedAt: newPost.createdAt,
              },
              processImmediately: true,
            })
            .pipe(Effect.orDie);

          return { postId: newPost.postId };
        }),

      setLike: ({ userId, likeType }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Post not exists" });
          }
          yield* Effect.logInfo(`set like - user id: ${userId}, like type: ${likeType}`);
          const updated = setPostLike(s, userId, likeType, getCurrentTimestamp());
          yield* Ref.set(state, updated);
          return { postId: updated.postId };
        }),

      removeLike: ({ userId }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Post not exists" });
          }
          yield* Effect.logInfo(`remove like - user id: ${userId}`);
          const updated = yield* Effect.fromResult(
            removePostLike(s, userId, getCurrentTimestamp()),
          );
          yield* Ref.set(state, updated);
          return { postId: updated.postId };
        }),

      addComment: ({ userId, content, parentCommentId }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Post not exists" });
          }
          yield* Effect.logInfo(`add comment - user id: ${userId}, content: ${content}`);
          const { post: updatedPost, commentId } = yield* Effect.fromResult(
            addPostComment(
              s,
              userId,
              content,
              parentCommentId,
              getCurrentTimestamp(),
            ),
          );
          yield* Ref.set(state, updatedPost);
          return { postId: updatedPost.postId, commentId };
        }),

      removeComment: ({ commentId }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Post not exists" });
          }
          yield* Effect.logInfo(`remove comment - comment id: ${commentId}`);
          const updated = yield* Effect.fromResult(
            removePostComment(s, commentId, getCurrentTimestamp()),
          );
          yield* Ref.set(state, updated);
          return { postId: updated.postId };
        }),

      setCommentLike: ({ commentId, userId, likeType }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Post not exists" });
          }
          yield* Effect.logInfo(
            `set comment like - comment id: ${commentId}, user id: ${userId}, like type: ${likeType}`,
          );
          const updated = yield* Effect.fromResult(
            setPostCommentLike(
              s,
              commentId,
              userId,
              likeType,
              getCurrentTimestamp(),
            ),
          );
          yield* Ref.set(state, updated);
          return { postId: updated.postId };
        }),

      removeCommentLike: ({ commentId, userId }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Post not exists" });
          }
          yield* Effect.logInfo(
            `remove comment like - comment id: ${commentId}, user id: ${userId}`,
          );
          const updated = yield* Effect.fromResult(
            removePostCommentLike(
              s,
              commentId,
              userId,
              getCurrentTimestamp(),
            ),
          );
          yield* Ref.set(state, updated);
          return { postId: updated.postId };
        }),
    };
  }),
);

export function fetchPostsByIds(
  postIds: string[],
  query?: Query,
): Effect.Effect<Post[], any, any> {
  return Effect.gen(function* () {
    const results: Post[] = [];
    const chunks = arrayChunks(postIds, 10);

    for (const chunk of chunks) {
      for (const id of chunk) {
        const postAgent = yield* PostAgent.client.get({ id }).pipe(Effect.orDie);
        const p = query
          ? yield* postAgent.getPostIfMatch({ query }).pipe(Effect.orDie)
          : yield* postAgent.getPost({}).pipe(Effect.orDie);
        if (p !== null) {
          results.push(p);
        }
      }
    }

    return results;
  });
}
