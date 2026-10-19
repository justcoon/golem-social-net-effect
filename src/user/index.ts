import { Effect, Ref, Schema } from "effect";
import * as Result from "effect/Result";
import {
  defineAgent,
  Http,
  method,
  Snapshot,
} from "@golemcloud/effect-golem";
import {
  UserConnectionType,
  UserConnectionTypeSchema,
  getOppositeConnectionType,
  TimestampSchema,
  Timestamp,
  ErrorResponseSchema,
  ErrorResponse,
} from "../common/types.js";
import {
  Query,
  QuerySchema,
  parseQuery,
  optTextMatches,
  textExactMatches,
} from "../common/query.js";
import {
  arrayChunks,
  getCurrentTimestamp,
  getShardNumber,
} from "../common/utils.js";

export const ConnectedUserSchema = Schema.Struct({
  userId: Schema.String,
  connectionTypes: Schema.Array(UserConnectionTypeSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type ConnectedUser = Schema.Schema.Type<typeof ConnectedUserSchema>;

export const UserSchema = Schema.Struct({
  userId: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  connectedUsers: Schema.Array(
    Schema.Tuple([Schema.String, ConnectedUserSchema]),
  ),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type User = Schema.Schema.Type<typeof UserSchema>;

export const UserIndexStateSchema = Schema.Struct({
  userIds: Schema.Array(Schema.String),
  updatedAt: TimestampSchema,
});

export type UserIndexState = Schema.Schema.Type<typeof UserIndexStateSchema>;

export const UpdateUserResponseSchema = Schema.Struct({
  userId: Schema.String,
});

export type UpdateUserResponse = Schema.Schema.Type<
  typeof UpdateUserResponseSchema
>;

export const USER_INDEX_SHARDS = 8;

export function getUserIndexShard(id: string): number {
  return getShardNumber(id, USER_INDEX_SHARDS);
}

export function initUserState(userId: string, now: Timestamp): User {
  return {
    userId,
    name: null,
    email: null,
    connectedUsers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function initUserIndexState(): UserIndexState {
  const now = getCurrentTimestamp();
  return {
    userIds: [],
    updatedAt: now,
  };
}

export function setUserAgentName(
  user: User,
  name: string | null,
  now: Timestamp,
): User {
  return {
    ...user,
    name,
    updatedAt: now,
  };
}

export function setUserAgentEmail(
  user: User,
  email: string | null,
  now: Timestamp,
): Result.Result<User, ErrorResponse> {
  if (email !== null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Result.fail({ message: "Invalid email" });
    }
  }
  return Result.succeed({
    ...user,
    email,
    updatedAt: now,
  });
}

export function connectUserAgent(
  user: User,
  userId: string,
  connectionType: UserConnectionType,
  now: Timestamp,
): { updatedUser: User; isNew: boolean } {
  if (userId === user.userId) {
    return { updatedUser: user, isNew: false };
  }

  const connectedUsers = [...user.connectedUsers];
  const existingIdx = connectedUsers.findIndex((u) => u[0] === userId);
  const existingEntry = existingIdx !== -1 ? connectedUsers[existingIdx] : undefined;
  const existingConnection = existingEntry ? existingEntry[1] : undefined;

  const shouldConnect =
    !existingConnection ||
    !existingConnection.connectionTypes.includes(connectionType);

  if (shouldConnect) {
    if (existingConnection) {
      const newConnTypes = [...existingConnection.connectionTypes, connectionType];
      const updatedConn: ConnectedUser = {
        ...existingConnection,
        connectionTypes: newConnTypes,
        updatedAt: now,
      };
      connectedUsers[existingIdx] = [userId, updatedConn];
    } else {
      const newConn: ConnectedUser = {
        userId: userId,
        connectionTypes: [connectionType],
        createdAt: now,
        updatedAt: now,
      };
      connectedUsers.push([userId, newConn]);
    }
    return {
      updatedUser: {
        ...user,
        connectedUsers,
        updatedAt: now,
      },
      isNew: true,
    };
  }
  return { updatedUser: user, isNew: false };
}

export function disconnectUserAgent(
  user: User,
  userId: string,
  connectionType: UserConnectionType,
  now: Timestamp,
): { updatedUser: User; isNew: boolean } {
  if (userId === user.userId) {
    return { updatedUser: user, isNew: false };
  }

  let connectedUsers = [...user.connectedUsers];
  const existingIdx = connectedUsers.findIndex((u) => u[0] === userId);
  const existingEntry = existingIdx !== -1 ? connectedUsers[existingIdx] : undefined;
  const existingConnection = existingEntry ? existingEntry[1] : undefined;

  const shouldDisconnect =
    existingConnection !== undefined &&
    existingConnection.connectionTypes.includes(connectionType);

  if (shouldDisconnect) {
    if (existingConnection!.connectionTypes.length === 1) {
      connectedUsers.splice(existingIdx, 1);
    } else {
      const newConnTypes = existingConnection!.connectionTypes.filter(
        (c) => c !== connectionType,
      );
      const updatedConn: ConnectedUser = {
        ...existingConnection!,
        connectionTypes: newConnTypes,
        updatedAt: now,
      };
      connectedUsers[existingIdx] = [userId, updatedConn];
    }
    return {
      updatedUser: {
        ...user,
        connectedUsers,
        updatedAt: now,
      },
      isNew: true,
    };
  }
  return { updatedUser: user, isNew: false };
}

export function userIdMatchesQuery(userId: string, query: Query): boolean {
  for (const filter of query.fieldFilters) {
    const field = filter[0];
    const value = filter[1];
    let matches = false;
    switch (field.toLowerCase()) {
      case "user-id":
      case "userid":
        matches = textExactMatches(userId, value);
        break;
      case "name":
      case "email":
      case "connected-users":
      case "connectedusers":
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

export function userMatchesQuery(user: User, query: Query): boolean {
  for (const filter of query.fieldFilters) {
    const field = filter[0];
    const value = filter[1];
    let matches = false;
    switch (field.toLowerCase()) {
      case "user-id":
      case "userid":
        matches = textExactMatches(user.userId, value);
        break;
      case "name":
        matches = optTextMatches(user.name, value);
        break;
      case "email":
        matches = optTextMatches(user.email, value);
        break;
      case "connected-users":
      case "connectedusers":
        matches = user.connectedUsers.some((u) => textExactMatches(u[0], value));
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
    query.terms.some(
      (term: string) =>
        textExactMatches(user.userId, term) ||
        optTextMatches(user.name, term) ||
        optTextMatches(user.email, term),
    )
  );
}

export const UserIndexAgent = defineAgent({
  name: "UserIndexAgent",
  mode: "durable",
  id: {
    shard: Schema.Number,
  },
  snapshotting: Snapshot.define({
    schema: UserIndexStateSchema,
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    add: method({
      input: { userId: Schema.String },
      success: Schema.Void,
    }),
    getState: method({
      input: {},
      success: UserIndexStateSchema,
    }),
  },
}).implement({
  init: ({ shard }) =>
    Ref.make<UserIndexState>(initUserIndexState()).pipe(
      Effect.map((ref) => ({ shard, ref })),
    ),
  methods: ({ shard, ref }) => ({
    add: ({ userId }) =>
      Ref.update(ref, (current) => {
        const userShard = getUserIndexShard(userId);
        if (userShard === shard && !current.userIds.includes(userId)) {
          return {
            userIds: [...current.userIds, userId],
            updatedAt: getCurrentTimestamp(),
          };
        }
        return current;
      }),

    getState: () => Ref.get(ref),
  }),
  snapshot: {
    save: (state) => Ref.get(state.ref),
    restore: (saved, context) =>
      Ref.make(saved).pipe(Effect.map((ref) => ({ shard: context.id.shard, ref }))),
  },
});

export const UserAgent = defineAgent({
  name: "UserAgent",
  mode: "durable",
  id: {
    id: Schema.String,
  },
  http: Http.mount("/v1/social-net/users/{id}"),
  snapshotting: Snapshot.define({
    schema: Schema.NullOr(UserSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getUser: method({
      input: {},
      success: Schema.NullOr(UserSchema),
      http: [Http.get("/")],
    }),
    getUserIfMatch: method({
      input: { query: QuerySchema },
      success: Schema.NullOr(UserSchema),
    }),
    setName: method({
      input: { name: Schema.NullOr(Schema.String) },
      success: UpdateUserResponseSchema,
      http: [Http.put("/name")],
    }),
    setEmail: method({
      input: { email: Schema.NullOr(Schema.String) },
      success: UpdateUserResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.put("/email")],
    }),
    connectUser: method({
      input: {
        userId: Schema.String,
        connectionType: UserConnectionTypeSchema,
      },
      success: UpdateUserResponseSchema,
      http: [Http.put("/connections")],
    }),
    disconnectUser: method({
      input: {
        userId: Schema.String,
        connectionType: UserConnectionTypeSchema,
      },
      success: UpdateUserResponseSchema,
      http: [Http.del("/connections")],
    }),
  },
});

UserAgent.implement({
  init: ({ id }) =>
    Ref.make<User | null>(null).pipe(
      Effect.map((ref) => ({ id, ref })),
    ),
  methods: ({ id, ref }) => {
    const getOrInitState = Effect.scoped(
      Effect.gen(function* () {
        let current = yield* Ref.get(ref);
        if (current === null) {
          current = initUserState(id, getCurrentTimestamp());
          yield* Ref.set(ref, current);
          const userShard = getUserIndexShard(id);
          const indexAgent = yield* UserIndexAgent.client
            .get({ shard: userShard })
            .pipe(Effect.orDie);
          yield* indexAgent.add.trigger({ userId: id }).pipe(Effect.orDie);
        }
        return current;
      }),
    );

    return {
      getUser: () => Ref.get(ref),

      getUserIfMatch: ({ query }) =>
        Ref.get(ref).pipe(
          Effect.map((u) => (u && userMatchesQuery(u, query) ? u : null)),
        ),

      setName: ({ name }) =>
        Effect.gen(function* () {
          const user = yield* getOrInitState;
          const updated = setUserAgentName(user, name, getCurrentTimestamp());
          yield* Ref.set(ref, updated);
          return { userId: id };
        }),

      setEmail: ({ email }) =>
        Effect.gen(function* () {
          const user = yield* getOrInitState;
          const updatedUser = yield* Effect.fromResult(
            setUserAgentEmail(user, email, getCurrentTimestamp()),
          );
          yield* Ref.set(ref, updatedUser);
          return { userId: id };
        }),

      connectUser: ({ userId, connectionType }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const user = yield* getOrInitState;
            const { updatedUser, isNew } = connectUserAgent(
              user,
              userId,
              connectionType,
              getCurrentTimestamp(),
            );
            yield* Ref.set(ref, updatedUser);
            if (isNew) {
              yield* Effect.logInfo(`connect user - id: ${userId}, type: ${connectionType}`);
              const otherUser = yield* UserAgent.client
                .get({ id: userId })
                .pipe(Effect.orDie);
              yield* otherUser.connectUser
                .trigger({
                  userId: id,
                  connectionType: getOppositeConnectionType(connectionType),
                })
                .pipe(Effect.orDie);
            }
            return { userId: id };
          }),
        ),

      disconnectUser: ({ userId, connectionType }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const user = yield* getOrInitState;
            const { updatedUser, isNew } = disconnectUserAgent(
              user,
              userId,
              connectionType,
              getCurrentTimestamp(),
            );
            yield* Ref.set(ref, updatedUser);
            if (isNew) {
              yield* Effect.logInfo(`disconnect user - id: ${userId}, type: ${connectionType}`);
              const otherUser = yield* UserAgent.client
                .get({ id: userId })
                .pipe(Effect.orDie);
              yield* otherUser.disconnectUser
                .trigger({
                  userId: id,
                  connectionType: getOppositeConnectionType(connectionType),
                })
                .pipe(Effect.orDie);
            }
            return { userId: id };
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

export const UserSearchAgent = defineAgent({
  name: "UserSearchAgent",
  mode: "ephemeral",
  id: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    search: method({
      input: { query: Schema.String },
      success: Schema.Array(UserSchema),
      http: [Http.get("/search?query={query}")],
    }),
  },
}).implement({
  init: () => Effect.void,
  methods: () => ({
    search: ({ query }) =>
      Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.logInfo("Search users - query: " + query);
          const parsedQuery = parseQuery(query);
          const result: User[] = [];

          const shardStates: UserIndexState[] = [];
          for (let i = 0; i < USER_INDEX_SHARDS; i++) {
            const shardAgent = yield* UserIndexAgent.client
              .get({ shard: i })
              .pipe(Effect.orDie);
            const shardState = yield* shardAgent.getState({}).pipe(Effect.orDie);
            shardStates.push(shardState);
          }

          const allUserIds: string[] = [];
          for (const sState of shardStates) {
            const matchingIds = sState.userIds.filter((id) =>
              userIdMatchesQuery(id, parsedQuery),
            );
            allUserIds.push(...matchingIds);
          }

          if (allUserIds.length > 0) {
            const idsChunks = arrayChunks(allUserIds, 20);

            for (const ids of idsChunks) {
              yield* Effect.logInfo("Search users - ids: (" + ids.join(", ") + ")");

              for (const id of ids) {
                const uAgent = yield* UserAgent.client
                  .get({ id })
                  .pipe(Effect.orDie);
                const userVal = yield* uAgent
                  .getUserIfMatch({ query: parsedQuery })
                  .pipe(Effect.orDie);
                if (userVal !== null) {
                  result.push(userVal);
                }
              }
            }
          }

          return result;
        }),
      ),
  }),
});


