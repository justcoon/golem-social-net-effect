import { Schema } from "effect";
import { UserConnectionTypeSchema, TimestampSchema, Timestamp } from "../common/types.js";
import { Query, optTextExactMatches, textExactMatches } from "../common/query.js";

const POSTS_MAX_COUNT = 500;

export const TimelinePostRefSchema = Schema.Struct({
  postId: Schema.String,
  createdBy: Schema.String,
  createdByConnectionType: Schema.NullOr(UserConnectionTypeSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type TimelinePostRef = Schema.Schema.Type<
  typeof TimelinePostRefSchema
>;

export const UserTimelineSchema = Schema.Struct({
  userId: Schema.String,
  posts: Schema.Array(TimelinePostRefSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type UserTimeline = Schema.Schema.Type<typeof UserTimelineSchema>;

export const UserTimelineUpdatesSchema = Schema.Struct({
  userId: Schema.String,
  posts: Schema.Array(TimelinePostRefSchema),
});

export type UserTimelineUpdates = Schema.Schema.Type<
  typeof UserTimelineUpdatesSchema
>;

export function initUserTimelineState(
  userId: string,
  now: Timestamp,
): UserTimeline {
  return {
    userId,
    posts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateUserTimelinePosts(
  state: UserTimeline,
  postRefs: readonly TimelinePostRef[],
  now: Timestamp,
): UserTimeline {
  const ids = new Set(postRefs.map((p) => p.postId));

  const posts = state.posts.filter((p) => !ids.has(p.postId));
  posts.push(...postRefs);

  posts.sort((a, b) =>
    b.updatedAt.timestamp.localeCompare(a.updatedAt.timestamp),
  );

  const trimmedPosts = posts.length > POSTS_MAX_COUNT ? posts.slice(0, POSTS_MAX_COUNT) : posts;

  return {
    ...state,
    posts: trimmedPosts,
    updatedAt: now,
  };
}

export function matchesPostRef(postRef: TimelinePostRef, query: Query): boolean {
  for (const filter of query.fieldFilters) {
    const field = filter[0];
    const value = filter[1];
    let matches = false;
    switch (field.toLowerCase()) {
      case "connection-type":
      case "connectiontype":
        matches = optTextExactMatches(postRef.createdByConnectionType, value);
        break;
      case "created-by":
      case "createdby":
        matches = textExactMatches(postRef.createdBy, value);
        break;
      case "content":
        matches = true;
        break;
      default:
        matches = false;
    }
    if (!matches) {
      return false;
    }
  }
  return true;
}
