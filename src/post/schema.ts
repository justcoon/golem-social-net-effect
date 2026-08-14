import { Schema } from "effect";
import * as Result from "effect/Result";
import {
  LikeType,
  LikeTypeSchema,
  TimestampSchema,
  Timestamp,
  ErrorResponse,
} from "../common/types.js";
import { Query, textExactMatches, textMatches } from "../common/query.js";

const MAX_COMMENTS_LENGTH = 2000;

export const CommentSchema = Schema.Struct({
  commentId: Schema.String,
  parentCommentId: Schema.NullOr(Schema.String),
  content: Schema.String,
  likes: Schema.Array(Schema.Tuple([Schema.String, LikeTypeSchema])),
  createdBy: Schema.String,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Comment = Schema.Schema.Type<typeof CommentSchema>;

export const AddCommentResponseSchema = Schema.Struct({
  postId: Schema.String,
  commentId: Schema.String,
});

export type AddCommentResponse = Schema.Schema.Type<
  typeof AddCommentResponseSchema
>;

export const UpdatePostResponseSchema = Schema.Struct({
  postId: Schema.String,
});

export type UpdatePostResponse = Schema.Schema.Type<
  typeof UpdatePostResponseSchema
>;

export const PostSchema = Schema.Struct({
  postId: Schema.String,
  content: Schema.String,
  createdBy: Schema.String,
  likes: Schema.Array(Schema.Tuple([Schema.String, LikeTypeSchema])),
  comments: Schema.Array(Schema.Tuple([Schema.String, CommentSchema])),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Post = Schema.Schema.Type<typeof PostSchema>;

export function postMatchesQuery(post: Post, query: Query): boolean {
  for (const filter of query.fieldFilters) {
    const field = filter[0];
    const value = filter[1];
    let matches = false;
    switch (field.toLowerCase()) {
      case "created-by":
      case "createdby":
        matches = textExactMatches(post.createdBy, value);
        break;
      case "content":
        matches = textMatches(post.content, value);
        break;
      case "comments":
        matches = post.comments.some(([_, comment]) =>
          textMatches(comment.content, value),
        );
        break;
      default:
        matches = false;
    }
    if (!matches) {
      return false;
    }
  }

  return (
    query.terms.length === 0 ||
    query.terms.some((term) => {
      const matchesContent = textMatches(post.content, term);
      const matchesComments = post.comments.some(([_, comment]) =>
        textMatches(comment.content, term),
      );
      return matchesContent || matchesComments;
    })
  );
}

export const PostUpdateSchema = Schema.Struct({
  postId: Schema.String,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type PostUpdate = Schema.Schema.Type<typeof PostUpdateSchema>;

export const PostUpdatesSchema = Schema.Struct({
  userId: Schema.String,
  updates: Schema.Array(PostUpdateSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type PostUpdates = Schema.Schema.Type<typeof PostUpdatesSchema>;

export function initPostUpdates(userId: string, now: Timestamp): PostUpdates {
  return {
    userId,
    updates: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePostUpdates(
  state: PostUpdates,
  update: PostUpdate,
  now: Timestamp,
): PostUpdates {
  const updates = state.updates.filter((u) => u.postId !== update.postId);
  updates.push(update);
  return {
    ...state,
    updates,
    updatedAt: now,
  };
}

export function clearPostUpdates(
  state: PostUpdates,
  now: Timestamp,
): { clearedState: PostUpdates; updates: PostUpdate[] } {
  const updates = [...state.updates];
  return {
    clearedState: {
      ...state,
      updates: [],
      updatedAt: now,
    },
    updates,
  };
}

export function initPostState(postId: string, now: Timestamp): Post {
  return {
    postId,
    content: "",
    createdBy: "",
    likes: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function initializePostAgent(
  post: Post,
  createdBy: string,
  content: string,
): Post {
  return {
    ...post,
    createdBy,
    content,
  };
}

export function setPostLike(
  post: Post,
  userId: string,
  likeType: LikeType,
  now: Timestamp,
): Post {
  const likes = post.likes.filter((l) => l[0] !== userId);
  likes.push([userId, likeType]);
  return {
    ...post,
    likes,
    updatedAt: now,
  };
}

export function removePostLike(
  post: Post,
  userId: string,
  now: Timestamp,
): Result.Result<Post, ErrorResponse> {
  const initialLength = post.likes.length;
  const likes = post.likes.filter((l) => l[0] !== userId);

  if (likes.length !== initialLength) {
    return Result.succeed({
      ...post,
      likes,
      updatedAt: now,
    });
  } else {
    return Result.fail({ message: "Like not found" });
  }
}

export function addPostComment(
  post: Post,
  userId: string,
  content: string,
  parentCommentId: string | null,
  now: Timestamp,
): Result.Result<{ post: Post; commentId: string }, ErrorResponse> {
  if (post.comments.length >= MAX_COMMENTS_LENGTH) {
    return Result.fail({ message: "Max comments limit reached" });
  }

  const cid = crypto.randomUUID();
  const comments = [...post.comments];
  const newComment: Comment = {
    commentId: cid,
    parentCommentId,
    content,
    likes: [],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  comments.push([cid, newComment]);

  return Result.succeed({
    post: {
      ...post,
      comments,
      updatedAt: now,
    },
    commentId: cid,
  });
}

export function removePostComment(
  post: Post,
  commentId: string,
  now: Timestamp,
): Result.Result<Post, ErrorResponse> {
  const initialLength = post.comments.length;
  const comments = post.comments.filter(
    (c) => c[0] !== commentId && c[1].parentCommentId !== commentId,
  );

  if (comments.length !== initialLength) {
    return Result.succeed({
      ...post,
      comments,
      updatedAt: now,
    });
  } else {
    return Result.fail({ message: "Comment not found" });
  }
}

export function setPostCommentLike(
  post: Post,
  commentId: string,
  userId: string,
  likeType: LikeType,
  now: Timestamp,
): Result.Result<Post, ErrorResponse> {
  const commentTupleIdx = post.comments.findIndex((c) => c[0] === commentId);
  if (commentTupleIdx !== -1) {
    const comments = [...post.comments];
    const comment = comments[commentTupleIdx]![1];
    const likes = comment.likes.filter((l) => l[0] !== userId);
    likes.push([userId, likeType]);

    const updatedComment: Comment = {
      ...comment,
      likes,
      updatedAt: now,
    };
    comments[commentTupleIdx] = [commentId, updatedComment];

    return Result.succeed({
      ...post,
      comments,
      updatedAt: now,
    });
  } else {
    return Result.fail({ message: "Comment not found" });
  }
}

export function removePostCommentLike(
  post: Post,
  commentId: string,
  userId: string,
  now: Timestamp,
): Result.Result<Post, ErrorResponse> {
  const commentTupleIdx = post.comments.findIndex((c) => c[0] === commentId);
  if (commentTupleIdx !== -1) {
    const comments = [...post.comments];
    const comment = comments[commentTupleIdx]![1];
    const initialLikes = comment.likes.length;
    const likes = comment.likes.filter((l) => l[0] !== userId);

    if (likes.length !== initialLikes) {
      const updatedComment: Comment = {
        ...comment,
        likes,
        updatedAt: now,
      };
      comments[commentTupleIdx] = [commentId, updatedComment];

      return Result.succeed({
        ...post,
        comments,
        updatedAt: now,
      });
    }
  }
  return Result.fail({ message: "Comment not found" });
}
