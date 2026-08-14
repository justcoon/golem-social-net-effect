import { Schema } from "effect";

export const UserConnectionType = {
  Friend: "Friend",
  Follower: "Follower",
  Following: "Following",
} as const;

export type UserConnectionType =
  (typeof UserConnectionType)[keyof typeof UserConnectionType];

export const UserConnectionTypeSchema = Schema.Literals([
  UserConnectionType.Friend,
  UserConnectionType.Follower,
  UserConnectionType.Following,
]);

export function getOppositeConnectionType(
  type: UserConnectionType,
): UserConnectionType {
  switch (type) {
    case UserConnectionType.Follower:
      return UserConnectionType.Following;
    case UserConnectionType.Following:
      return UserConnectionType.Follower;
    case UserConnectionType.Friend:
      return UserConnectionType.Friend;
  }
}

export const LikeType = {
  Like: "Like",
  Insightful: "Insightful",
  Love: "Love",
  Dislike: "Dislike",
} as const;

export type LikeType = (typeof LikeType)[keyof typeof LikeType];

export const LikeTypeSchema = Schema.Literals([
  LikeType.Like,
  LikeType.Insightful,
  LikeType.Love,
  LikeType.Dislike,
]);

export function isPositiveLike(type: LikeType): boolean {
  return !isNegativeLike(type);
}

export function isNegativeLike(type: LikeType): boolean {
  return type === LikeType.Dislike;
}

export const TimestampSchema = Schema.Struct({
  timestamp: Schema.String,
});

export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>;

export const ErrorResponseSchema = Schema.Struct({
  message: Schema.String,
});

export type ErrorResponse = Schema.Schema.Type<typeof ErrorResponseSchema>;
