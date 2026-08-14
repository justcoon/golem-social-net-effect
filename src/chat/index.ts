import { Effect, Ref, Schema } from "effect";
import * as Result from "effect/Result";
import {
  defineAgent,
  Http,
  method,
  Snapshot,
} from "@golemcloud/effect-golem";
import {
  LikeType,
  LikeTypeSchema,
  TimestampSchema,
  Timestamp,
  ErrorResponseSchema,
  ErrorResponse,
} from "../common/types.js";
import { Query, QuerySchema, optTextMatches, textExactMatches } from "../common/query.js";
import { getCurrentTimestamp } from "../common/utils.js";
import { UserChatsAgent } from "../user-chats/spec.js";

const MAX_CHAT_LENGTH = 2000;

export const MessageSchema = Schema.Struct({
  messageId: Schema.String,
  content: Schema.String,
  likes: Schema.Array(Schema.Tuple([Schema.String, LikeTypeSchema])),
  createdBy: Schema.String,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Message = Schema.Schema.Type<typeof MessageSchema>;

export const ChatSchema = Schema.Struct({
  chatId: Schema.String,
  createdBy: Schema.String,
  participants: Schema.Array(Schema.String),
  messages: Schema.Array(MessageSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Chat = Schema.Schema.Type<typeof ChatSchema>;

export const UpdateChatResponseSchema = Schema.Struct({
  chatId: Schema.String,
});

export type UpdateChatResponse = Schema.Schema.Type<
  typeof UpdateChatResponseSchema
>;

export const AddMessageResponseSchema = Schema.Struct({
  chatId: Schema.String,
  messageId: Schema.String,
});

export type AddMessageResponse = Schema.Schema.Type<
  typeof AddMessageResponseSchema
>;

function executeChatUpdates(
  chatId: string,
  participantsIds: readonly string[],
  updatedAt: Timestamp,
): Effect.Effect<void, any, any> {
  return Effect.gen(function* () {
    for (const pId of participantsIds) {
      const userChats = yield* UserChatsAgent.client
        .get({ id: pId })
        .pipe(Effect.orDie);
      yield* userChats.chatUpdated
        .trigger({ chatId, updatedAt })
        .pipe(Effect.orDie);
    }
  });
}

function executeAddChat(
  chatId: string,
  createdBy: string,
  createdAt: Timestamp,
  participantsIds: readonly string[],
): Effect.Effect<void, any, any> {
  return Effect.gen(function* () {
    for (const pId of participantsIds) {
      if (pId !== createdBy) {
        const userChats = yield* UserChatsAgent.client
          .get({ id: pId })
          .pipe(Effect.orDie);
        yield* userChats.addChat
          .trigger({ chatId, createdBy, createdAt })
          .pipe(Effect.orDie);
      }
    }
  });
}

export function initChatState(chatId: string, now: Timestamp): Chat {
  return {
    chatId,
    createdBy: "",
    participants: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function initializeChatAgent(
  chat: Chat,
  participantsIds: readonly string[],
  createdBy: string,
  createdAt: Timestamp,
): Chat {
  const pSet = new Set(participantsIds);
  pSet.add(createdBy);
  return {
    ...chat,
    createdBy,
    participants: Array.from(pSet),
    createdAt,
    updatedAt: createdAt,
  };
}

export function addChatParticipants(
  chat: Chat,
  participantsIds: readonly string[],
  now: Timestamp,
): { updatedChat: Chat; newParticipants: string[] } {
  const existingSet = new Set(chat.participants);
  const newParticipants = participantsIds.filter((id) => !existingSet.has(id));

  if (newParticipants.length > 0) {
    return {
      updatedChat: {
        ...chat,
        participants: [...chat.participants, ...newParticipants],
        updatedAt: now,
      },
      newParticipants,
    };
  }
  return { updatedChat: chat, newParticipants: [] };
}

export function addChatMessage(
  chat: Chat,
  userId: string,
  content: string,
  now: Timestamp,
): Result.Result<{ chat: Chat; message: Message }, ErrorResponse> {
  if (chat.messages.length >= MAX_CHAT_LENGTH) {
    return Result.fail({ message: "Max chat length" });
  } else {
    const message: Message = {
      messageId: crypto.randomUUID(),
      content: content,
      likes: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    return Result.succeed({
      chat: {
        ...chat,
        messages: [...chat.messages, message],
        updatedAt: message.createdAt,
      },
      message,
    });
  }
}

export function removeChatMessage(
  chat: Chat,
  messageId: string,
  now: Timestamp,
): { updatedChat: Chat; updated: boolean } {
  const initialLength = chat.messages.length;
  const messages = chat.messages.filter((m) => m.messageId !== messageId);

  if (messages.length !== initialLength) {
    return {
      updatedChat: {
        ...chat,
        messages,
        updatedAt: now,
      },
      updated: true,
    };
  }
  return { updatedChat: chat, updated: false };
}

export function setChatMessageLike(
  chat: Chat,
  messageId: string,
  userId: string,
  likeType: LikeType,
  now: Timestamp,
): { updatedChat: Chat; updated: boolean } {
  const msgIdx = chat.messages.findIndex((m) => m.messageId === messageId);
  if (msgIdx !== -1) {
    const messages = [...chat.messages];
    const msg = messages[msgIdx]!;
    const likes = msg.likes.filter((l) => l[0] !== userId);
    likes.push([userId, likeType]);

    const updatedMsg: Message = {
      ...msg,
      likes,
      updatedAt: now,
    };
    messages[msgIdx] = updatedMsg;

    return {
      updatedChat: {
        ...chat,
        messages,
        updatedAt: now,
      },
      updated: true,
    };
  }
  return { updatedChat: chat, updated: false };
}

export function removeChatMessageLike(
  chat: Chat,
  messageId: string,
  userId: string,
  now: Timestamp,
): { updatedChat: Chat; updated: boolean } {
  const msgIdx = chat.messages.findIndex((m) => m.messageId === messageId);
  if (msgIdx !== -1) {
    const messages = [...chat.messages];
    const msg = messages[msgIdx]!;
    const initialLikes = msg.likes.length;
    const likes = msg.likes.filter((l) => l[0] !== userId);

    if (likes.length !== initialLikes) {
      const updatedMsg: Message = {
        ...msg,
        likes,
        updatedAt: now,
      };
      messages[msgIdx] = updatedMsg;

      return {
        updatedChat: {
          ...chat,
          messages,
          updatedAt: now,
        },
        updated: true,
      };
    }
  }
  return { updatedChat: chat, updated: false };
}

export function chatMatchesQuery(chat: Chat, query: Query): boolean {
  for (const filter of query.fieldFilters) {
    const field = filter[0];
    const value = filter[1];
    let matches = false;
    switch (field.toLowerCase()) {
      case "chat-id":
      case "chatid":
        matches = textExactMatches(chat.chatId, value);
        break;
      case "created-by":
      case "createdby":
        matches = textExactMatches(chat.createdBy, value);
        break;
      case "participants":
        matches = chat.participants.some((p) => textExactMatches(p, value));
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
        textExactMatches(chat.chatId, term) ||
        textExactMatches(chat.createdBy, term) ||
        chat.participants.some((p) => textExactMatches(p, term)),
    )
  );
}

export const ChatAgent = defineAgent({
  name: "ChatAgent",
  mode: "durable",
  constructorParams: {
    id: Schema.String,
  },
  http: Http.mount("/v1/social-net/chats/{id}"),
  snapshot: Snapshot.define({
    schema: Schema.NullOr(ChatSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getChat: method({
      params: {},
      success: Schema.NullOr(ChatSchema),
      http: [Http.get("/")],
    }),
    getChatIfMatch: method({
      params: { query: QuerySchema },
      success: Schema.NullOr(ChatSchema),
    }),
    initChat: method({
      params: {
        participantsIds: Schema.Array(Schema.String),
        createdBy: Schema.String,
        createdAt: TimestampSchema,
      },
      success: UpdateChatResponseSchema,
      error: ErrorResponseSchema,
    }),
    addParticipants: method({
      params: { participants: Schema.Array(Schema.String) },
      success: UpdateChatResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.custom("PATCH", "/participants")],
    }),
    addMessage: method({
      params: { userId: Schema.String, content: Schema.String },
      success: AddMessageResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.post("/messages")],
    }),
    removeMessage: method({
      params: { messageId: Schema.String },
      success: UpdateChatResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.del("/messages/{messageId}")],
    }),
    setMessageLike: method({
      params: {
        messageId: Schema.String,
        userId: Schema.String,
        likeType: LikeTypeSchema,
      },
      success: UpdateChatResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.put("/messages/{messageId}/likes")],
    }),
    removeMessageLike: method({
      params: {
        messageId: Schema.String,
        userId: Schema.String,
      },
      success: UpdateChatResponseSchema,
      error: ErrorResponseSchema,
      http: [Http.del("/messages/{messageId}/likes/{userId}")],
    }),
  },
}).implement(({ id }, snapshot) =>
  Effect.gen(function* () {
    const state = yield* snapshot.init(null);

    return {
      getChat: () => Ref.get(state),

      getChatIfMatch: ({ query }) =>
        Ref.get(state).pipe(
          Effect.map((s) => (s && chatMatchesQuery(s, query) ? s : null)),
        ),

      initChat: ({ participantsIds, createdBy, createdAt }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s !== null) {
            return yield* Effect.fail({ message: "Chat already exists" });
          }

          const pSet = new Set(participantsIds);
          pSet.add(createdBy);
          const uniqueParticipants = Array.from(pSet);

          if (uniqueParticipants.length < 2) {
            return yield* Effect.fail({
              message: "Chat must have at least 2 participants",
            });
          }

          let newChat = initChatState(id, getCurrentTimestamp());
          yield* Effect.logInfo(
            `init chat - created by: ${createdBy}, participants: ${uniqueParticipants.length}`,
          );

          newChat = initializeChatAgent(newChat, participantsIds, createdBy, createdAt);
          yield* Ref.set(state, newChat);

          yield* executeAddChat(
            newChat.chatId,
            createdBy,
            newChat.createdAt,
            newChat.participants,
          );

          return { chatId: newChat.chatId };
        }),

      addParticipants: ({ participants }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Chat not exists" });
          }

          const oldParticipants = [...s.participants];
          const { updatedChat, newParticipants } = addChatParticipants(
            s,
            participants,
            getCurrentTimestamp(),
          );

          if (newParticipants.length === 0) {
            return yield* Effect.fail({ message: "No new participants" });
          }

          yield* Effect.logInfo(
            `add participants - new participants: ${newParticipants.length}`,
          );
          yield* Ref.set(state, updatedChat);

          yield* executeAddChat(
            updatedChat.chatId,
            updatedChat.createdBy,
            updatedChat.updatedAt,
            newParticipants,
          );
          yield* executeChatUpdates(updatedChat.chatId, oldParticipants, updatedChat.updatedAt);

          return { chatId: updatedChat.chatId };
        }),

      addMessage: ({ userId, content }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Chat not exists" });
          }

          yield* Effect.logInfo(`add message - user id: ${userId}, content: ${content}`);
          const { chat: updatedChat, message } = yield* Effect.fromResult(
            addChatMessage(
              s,
              userId,
              content,
              getCurrentTimestamp(),
            ),
          );

          yield* Ref.set(state, updatedChat);
          yield* executeChatUpdates(updatedChat.chatId, updatedChat.participants, updatedChat.updatedAt);

          return { chatId: updatedChat.chatId, messageId: message.messageId };
        }),

      removeMessage: ({ messageId }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Chat not exists" });
          }

          yield* Effect.logInfo(`remove message - message id: ${messageId}`);
          const { updatedChat, updated } = removeChatMessage(s, messageId, getCurrentTimestamp());

          if (!updated) {
            return yield* Effect.fail({ message: "Message not found" });
          }

          yield* Ref.set(state, updatedChat);
          yield* executeChatUpdates(updatedChat.chatId, updatedChat.participants, updatedChat.updatedAt);

          return { chatId: updatedChat.chatId };
        }),

      setMessageLike: ({ messageId, userId, likeType }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Chat not exists" });
          }

          yield* Effect.logInfo(
            `set message like - message id: ${messageId}, user id: ${userId}, like type: ${likeType}`,
          );

          const { updatedChat, updated } = setChatMessageLike(
            s,
            messageId,
            userId,
            likeType,
            getCurrentTimestamp(),
          );

          if (!updated) {
            return yield* Effect.fail({ message: "Message not found" });
          }

          yield* Ref.set(state, updatedChat);
          yield* executeChatUpdates(updatedChat.chatId, updatedChat.participants, updatedChat.updatedAt);

          return { chatId: updatedChat.chatId };
        }),

      removeMessageLike: ({ messageId, userId }) =>
        Effect.gen(function* () {
          const s = yield* Ref.get(state);
          if (s === null) {
            return yield* Effect.fail({ message: "Chat not exists" });
          }

          yield* Effect.logInfo(
            `remove message like - chat id: ${messageId}, user id: ${userId}`,
          );

          const { updatedChat, updated } = removeChatMessageLike(
            s,
            messageId,
            userId,
            getCurrentTimestamp(),
          );

          if (!updated) {
            return yield* Effect.fail({ message: "Message not found" });
          }

          yield* Ref.set(state, updatedChat);
          yield* executeChatUpdates(updatedChat.chatId, updatedChat.participants, updatedChat.updatedAt);

          return { chatId: updatedChat.chatId };
        }),
    };
  }),
);
