import { Effect, Ref, Schedule, Schema, Stream } from "effect";
import * as Result from "effect/Result";
import {
  defineAgent,
  Http,
  method,
  WitTypes,
} from "@golemcloud/effect-golem";
import {
  TimestampSchema,
} from "../common/types.js";
import { Query, parseQuery } from "../common/query.js";
import { arrayChunks, getCurrentTimestamp } from "../common/utils.js";
import { pollForUpdates } from "../common/poll.js";
import { ChatSchema, Chat, ChatAgent } from "../chat/index.js";
import {
  ChatRefSchema,
  ChatRef,
  UserChats,
  initUserChatsState,
  addUserChat,
  updateUserChat,
  addExistingChat,
  removeUserChat,
  chatRefMatchesQuery,
} from "./schema.js";
import { UserChatsAgent } from "./spec.js";

export * from "./schema.js";
export * from "./spec.js";

UserChatsAgent.implement({
  init: ({ id }) =>
    Ref.make<UserChats | null>(null).pipe(
      Effect.map((ref) => ({ id, ref })),
    ),
  methods: ({ id, ref }) => {
    const getOrInitState = Effect.gen(function* () {
      let current = yield* Ref.get(ref);
      if (current === null) {
        current = initUserChatsState(id, getCurrentTimestamp());
        yield* Ref.set(ref, current);
      }
      return current;
    });

    return {
      getChats: () => Ref.get(ref),

      createChat: ({ participants }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const s = yield* getOrInitState;
            const chatId = crypto.randomUUID();
            yield* Effect.logInfo(
              `create chat - chat id: ${chatId}, created by: ${s.userId}, participants: ${participants.length}`,
            );

            const now = getCurrentTimestamp();
            const { updatedState, chatRef } = addUserChat(s, chatId, s.userId, now);
            yield* Ref.set(ref, updatedState);

            const chatAgent = yield* ChatAgent.client
              .get({ id: chatId })
              .pipe(Effect.orDie);
            yield* chatAgent.initChat
              .trigger({
                participantsIds: participants,
                createdBy: s.userId,
                createdAt: now,
              })
              .pipe(Effect.orDie);

            return chatRef;
          }),
        ),

      getUpdates: ({ updatesSince }) =>
        Ref.get(ref).pipe(
          Effect.map((s) => {
            if (s !== null) {
              const updates = s.chats.filter(
                (c) => c.updatedAt.timestamp > updatesSince.timestamp,
              );
              return {
                userId: s.userId,
                chats: updates,
              };
            }
            return null;
          }),
        ),

      chatUpdated: ({ chatId, updatedAt }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          yield* Effect.logInfo(
            `chat updated - chat id: ${chatId}, updated at: ${updatedAt.timestamp}`,
          );

          const res = updateUserChat(s, chatId, updatedAt);
          if (Result.isFailure(res)) {
            yield* Effect.logInfo(`chat updated - chat id: ${chatId} - chat not found`);
            return yield* Effect.fail(res.failure);
          }
          yield* Ref.set(ref, res.success);
        }),

      addChat: ({ chatId, createdBy, createdAt }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          yield* Effect.logInfo(
            `add chat - chat id: ${chatId}, created by: ${createdBy}, created at: ${createdAt.timestamp}`,
          );
          const updatedState = addExistingChat(s, chatId, createdBy, createdAt, getCurrentTimestamp());
          yield* Ref.set(ref, updatedState);
        }),

      removeChat: ({ chatId }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          yield* Effect.logInfo(`remove chat - chat id: ${chatId}`);
          const updatedState = removeUserChat(s, chatId, getCurrentTimestamp());
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

export function fetchChatsByIds(
  chatIds: string[],
  query?: Query,
): Effect.Effect<Chat[], any, any> {
  return Effect.scoped(
    Effect.gen(function* () {
      const results: Chat[] = [];
      const chunks = arrayChunks(chatIds, 10);

      for (const chunk of chunks) {
        for (const id of chunk) {
          const chatAgent = yield* ChatAgent.client.get({ id }).pipe(Effect.orDie);
          const c = query
            ? yield* chatAgent.getChatIfMatch({ query }).pipe(Effect.orDie)
            : yield* chatAgent.getChat({}).pipe(Effect.orDie);
          if (c !== null) {
            results.push(c);
          }
        }
      }

      return results;
    }),
  );
}

export const UserChatsViewAgent = defineAgent({
  name: "UserChatsViewAgent",
  mode: "ephemeral",
  id: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getChatsView: method({
      input: {
        userId: Schema.String,
        query: Schema.String,
      },
      success: Schema.NullOr(Schema.Array(ChatSchema)),
      http: [Http.get("/{userId}/chats/search?query={query}")],
    }),
    getChatsUpdatesView: method({
      input: {
        userId: Schema.String,
        updatesSince: TimestampSchema,
      },
      success: Schema.NullOr(Schema.Array(ChatSchema)),
    }),
  },
}).implement({
  init: () => Effect.void,
  methods: () => ({
    getChatsView: ({ userId, query }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const uAgent = yield* UserChatsAgent.client
            .get({ id: userId })
            .pipe(Effect.orDie);
          const userChats = yield* uAgent.getChats({}).pipe(Effect.orDie);

          yield* Effect.logInfo(`get chats view - user id: ${userId}, query: ${query}`);

          if (userChats !== null) {
            const parsedQuery = parseQuery(query);
            const chatRefs = userChats.chats;
            const chatIds = chatRefs
              .filter((chatRef) => chatRefMatchesQuery(chatRef, parsedQuery))
              .map((p) => p.chatId);

            if (chatIds.length === 0) {
              return [];
            } else {
              return yield* fetchChatsByIds(chatIds, parsedQuery);
            }
          }
          return null;
        }),
      ),

    getChatsUpdatesView: ({ userId, updatesSince }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const uAgent = yield* UserChatsAgent.client
            .get({ id: userId })
            .pipe(Effect.orDie);
          const userChatsUpdates = yield* uAgent
            .getUpdates({ updatesSince })
            .pipe(Effect.orDie);

          yield* Effect.logInfo(
            `get chats updates view - user id: ${userId}, updates since: ${updatesSince.timestamp}`,
          );

          if (userChatsUpdates !== null) {
            const updatedChatRefs = userChatsUpdates.chats;

            if (updatedChatRefs.length === 0) {
              return [];
            } else {
              const chatIds = updatedChatRefs.map((p) => p.chatId);
              return yield* fetchChatsByIds(chatIds);
            }
          }
          return null;
        }),
      ),
  }),
});

export const UserChatsUpdatesAgent = defineAgent({
  name: "UserChatsUpdatesAgent",
  mode: "ephemeral",
  id: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getChatsUpdates: method({
      input: {
        userId: Schema.String,
        since: Schema.NullOr(Schema.String),
        iterWaitTime: Schema.NullOr(Schema.Number),
        maxWaitTime: Schema.NullOr(Schema.Number),
      },
      success: Schema.NullOr(Schema.Array(ChatRefSchema)),
      http: [
        Http.get(
          "/{userId}/chats/updates?since={since}&iterWaitTime={iterWaitTime}&maxWaitTime={maxWaitTime}",
        ),
      ],
    }),
    getChatsUpdatesStream: method({
      input: {
        userId: Schema.String,
        since: Schema.NullOr(Schema.String),
        iterWaitTime: Schema.NullOr(Schema.Number),
      },
      success: WitTypes.AgentStream(ChatRefSchema),
      http: [
        Http.get(
          "/{userId}/chats/updates/stream?since={since}&iterWaitTime={iterWaitTime}",
          {
            durableStreams: {
              slots: [
                { source: "output", slot: "$result", name: "updates" },
              ],
              load: {
                maxConcurrentReadersPerStream: 8,
              },
            },
          },
        ),
      ],
    }),
  },
}).implement({
  init: () => Effect.void,
  methods: () => ({
    getChatsUpdates: ({ userId, since, iterWaitTime, maxWaitTime }) =>
      Effect.scoped(
        Effect.gen(function* () {
          const uSince = since ? { timestamp: since } : undefined;
          const iWait = iterWaitTime ?? undefined;
          const mWait = maxWaitTime ?? undefined;

          const res = yield* pollForUpdates<ChatRef>(
            userId,
            uSince,
            iWait,
            mWait,
            (uid, sinceTime) =>
              Effect.scoped(
                Effect.gen(function* () {
                  const uAgent = yield* UserChatsAgent.client
                    .get({ id: uid })
                    .pipe(Effect.orDie);
                  const updates = yield* uAgent
                    .getUpdates({ updatesSince: sinceTime })
                    .pipe(Effect.orDie);
                  return updates ? [...updates.chats] : null;
                }),
              ),
            "get chats updates",
          );
          return res;
        }),
      ),

    getChatsUpdatesStream: ({ userId, since, iterWaitTime }) =>
      Effect.gen(function* () {
        const context = yield* Effect.context<any>();
        const interval = iterWaitTime ?? 1000;
        const initialSince = since ?? getCurrentTimestamp().timestamp;
        const cursorRef = yield* Ref.make(initialSince);

        const pollEffect = Effect.scoped(
          Effect.gen(function* () {
            const currentSince = yield* Ref.get(cursorRef);
            const uAgent = yield* UserChatsAgent.client
              .get({ id: userId })
              .pipe(Effect.orDie);
            const updates = yield* uAgent
              .getUpdates({ updatesSince: { timestamp: currentSince } })
              .pipe(Effect.orDie);

            if (updates && updates.chats.length > 0) {
              const latest = updates.chats.reduce(
                (max, c) =>
                  c.updatedAt.timestamp > max ? c.updatedAt.timestamp : max,
                currentSince,
              );
              yield* Ref.set(cursorRef, latest);
              return updates.chats as ChatRef[];
            }
            return [] as ChatRef[];
          }),
        ).pipe(Effect.provide(context));

        const stream = Stream.fromEffectSchedule(
          pollEffect,
          Schedule.spaced(`${interval} millis`),
        ).pipe(
          Stream.flatMap((chats: ChatRef[]) => Stream.fromIterable(chats)),
        );

        return stream;
      }),
  }),
});
