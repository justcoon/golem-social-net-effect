import { Effect, Ref, Schema } from "effect";
import * as Result from "effect/Result";
import {
  defineAgent,
  Http,
  method,
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

UserChatsAgent.implement(({ id }, snapshot) =>
  Effect.gen(function* () {
    const state = yield* snapshot.init(null);

    const getOrInitState = Effect.gen(function* () {
      let current = yield* Ref.get(state);
      if (current === null) {
        current = initUserChatsState(id, getCurrentTimestamp());
        yield* Ref.set(state, current);
      }
      return current;
    });

    return {
      getChats: () => Ref.get(state),

      createChat: ({ participants }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          const chatId = crypto.randomUUID();
          yield* Effect.logInfo(
            `create chat - chat id: ${chatId}, created by: ${s.userId}, participants: ${participants.length}`,
          );

          const now = getCurrentTimestamp();
          const { updatedState, chatRef } = addUserChat(s, chatId, s.userId, now);
          yield* Ref.set(state, updatedState);

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

      getUpdates: ({ updatesSince }) =>
        Ref.get(state).pipe(
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
          yield* Ref.set(state, res.success);
        }),

      addChat: ({ chatId, createdBy, createdAt }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          yield* Effect.logInfo(
            `add chat - chat id: ${chatId}, created by: ${createdBy}, created at: ${createdAt.timestamp}`,
          );
          const updatedState = addExistingChat(s, chatId, createdBy, createdAt, getCurrentTimestamp());
          yield* Ref.set(state, updatedState);
        }),

      removeChat: ({ chatId }) =>
        Effect.gen(function* () {
          const s = yield* getOrInitState;
          yield* Effect.logInfo(`remove chat - chat id: ${chatId}`);
          const updatedState = removeUserChat(s, chatId, getCurrentTimestamp());
          yield* Ref.set(state, updatedState);
        }),
    };
  }),
);

export function fetchChatsByIds(
  chatIds: string[],
  query?: Query,
): Effect.Effect<Chat[], any, any> {
  return Effect.gen(function* () {
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
  });
}

export const UserChatsViewAgent = defineAgent({
  name: "UserChatsViewAgent",
  mode: "ephemeral",
  constructorParams: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getChatsView: method({
      params: {
        userId: Schema.String,
        query: Schema.String,
      },
      success: Schema.NullOr(Schema.Array(ChatSchema)),
      http: [Http.get("/{userId}/chats/search?query={query}")],
    }),
    getChatsUpdatesView: method({
      params: {
        userId: Schema.String,
        updatesSince: TimestampSchema,
      },
      success: Schema.NullOr(Schema.Array(ChatSchema)),
    }),
  },
}).implement(() =>
  Effect.succeed({
    getChatsView: ({ userId, query }) =>
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

    getChatsUpdatesView: ({ userId, updatesSince }) =>
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
  }),
);

export const UserChatsUpdatesAgent = defineAgent({
  name: "UserChatsUpdatesAgent",
  mode: "ephemeral",
  constructorParams: {},
  http: Http.mount("/v1/social-net/users"),
  methods: {
    getChatsUpdates: method({
      params: {
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
  },
}).implement(() =>
  Effect.succeed({
    getChatsUpdates: ({ userId, since, iterWaitTime, maxWaitTime }) =>
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
            Effect.gen(function* () {
              const uAgent = yield* UserChatsAgent.client
                .get({ id: uid })
                .pipe(Effect.orDie);
              const updates = yield* uAgent
                .getUpdates({ updatesSince: sinceTime })
                .pipe(Effect.orDie);
              return updates ? [...updates.chats] : null;
            }),
          "get chats updates",
        );
        return res;
      }),
  }),
);
