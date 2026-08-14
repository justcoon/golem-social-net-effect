import { Schema } from "effect";
import * as Result from "effect/Result";
import {
  TimestampSchema,
  Timestamp,
  ErrorResponse,
} from "../common/types.js";
import { Query, textExactMatches } from "../common/query.js";
import { getCurrentTimestamp } from "../common/utils.js";

const CHATS_MAX_COUNT = 500;

export const ChatRefSchema = Schema.Struct({
  chatId: Schema.String,
  createdBy: Schema.String,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type ChatRef = Schema.Schema.Type<typeof ChatRefSchema>;

export const UserChatsSchema = Schema.Struct({
  userId: Schema.String,
  chats: Schema.Array(ChatRefSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type UserChats = Schema.Schema.Type<typeof UserChatsSchema>;

export const UserChatsUpdatesSchema = Schema.Struct({
  userId: Schema.String,
  chats: Schema.Array(ChatRefSchema),
});

export type UserChatsUpdates = Schema.Schema.Type<
  typeof UserChatsUpdatesSchema
>;

export function initUserChatsState(userId: string, now: Timestamp): UserChats {
  return {
    userId,
    chats: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addUserChat(
  state: UserChats,
  chatId: string,
  createdBy: string,
  now: Timestamp,
): { updatedState: UserChats; chatRef: ChatRef } {
  const chatRef: ChatRef = {
    chatId,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const chats = [...state.chats, chatRef];
  chats.sort((a, b) =>
    b.updatedAt.timestamp.localeCompare(a.updatedAt.timestamp),
  );

  const trimmedChats = chats.length > CHATS_MAX_COUNT ? chats.slice(0, CHATS_MAX_COUNT) : chats;

  return {
    updatedState: {
      ...state,
      chats: trimmedChats,
      updatedAt: now,
    },
    chatRef,
  };
}

export function updateUserChat(
  state: UserChats,
  chatId: string,
  updatedAt: Timestamp,
): Result.Result<UserChats, ErrorResponse> {
  const chats = [...state.chats];
  const chatIdx = chats.findIndex((c) => c.chatId === chatId);
  if (chatIdx !== -1) {
    const updatedChatRef: ChatRef = {
      ...chats[chatIdx]!,
      updatedAt,
    };
    chats[chatIdx] = updatedChatRef;
    chats.sort((a, b) =>
      b.updatedAt.timestamp.localeCompare(a.updatedAt.timestamp),
    );
    return Result.succeed({
      ...state,
      chats,
      updatedAt: getCurrentTimestamp(),
    });
  } else {
    return Result.fail({ message: "Chat not found" });
  }
}

export function addExistingChat(
  state: UserChats,
  chatId: string,
  createdBy: string,
  createdAt: Timestamp,
  now: Timestamp,
): UserChats {
  if (!state.chats.find((c) => c.chatId === chatId)) {
    const chats = [
      ...state.chats,
      {
        chatId,
        createdBy,
        createdAt: createdAt,
        updatedAt: now,
      },
    ];

    chats.sort((a, b) =>
      b.updatedAt.timestamp.localeCompare(a.updatedAt.timestamp),
    );

    const trimmedChats = chats.length > CHATS_MAX_COUNT ? chats.slice(0, CHATS_MAX_COUNT) : chats;
    return {
      ...state,
      chats: trimmedChats,
      updatedAt: now,
    };
  }
  return state;
}

export function removeUserChat(
  state: UserChats,
  chatId: string,
  now: Timestamp,
): UserChats {
  const chats = state.chats.filter((c) => c.chatId !== chatId);
  return {
    ...state,
    chats,
    updatedAt: now,
  };
}

export function chatRefMatchesQuery(chatRef: ChatRef, query: Query): boolean {
  for (const filter of query.fieldFilters) {
    const field = filter[0];
    const value = filter[1];
    let matches = false;
    switch (field.toLowerCase()) {
      case "created-by":
      case "createdby":
        matches = textExactMatches(chatRef.createdBy, value);
        break;
      case "participants":
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
