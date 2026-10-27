import { Schema } from "effect";
import { defineAgent, Http, method, Snapshot } from "@golemcloud/effect-golem";
import { TimestampSchema, ErrorResponseSchema } from "../common/types.js";
import { ChatRefSchema, UserChatsSchema, UserChatsUpdatesSchema } from "./schema.js";

export const UserChatsAgent = defineAgent({
  name: "UserChatsAgent",
  mode: "durable",
  id: {
    id: Schema.String,
  },
  http: Http.mount("/v1/social-net/users/{id}/chats"),
  snapshotting: Snapshot.define({
    schema: Schema.NullOr(UserChatsSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getChats: method({
      input: {},
      success: Schema.NullOr(UserChatsSchema),
      http: [Http.get("/")],
    }),
    createChat: method({
      input: { participants: Schema.Array(Schema.String) },
      success: ChatRefSchema,
      error: ErrorResponseSchema,
      http: [Http.post("/")],
    }),
    getUpdates: method({
      input: { updatesSince: TimestampSchema },
      success: Schema.NullOr(UserChatsUpdatesSchema),
    }),
    chatUpdated: method({
      input: { chatId: Schema.String, updatedAt: TimestampSchema },
      success: Schema.Void,
      error: ErrorResponseSchema,
    }),
    addChat: method({
      input: {
        chatId: Schema.String,
        createdBy: Schema.String,
        createdAt: TimestampSchema,
      },
      success: Schema.Void,
    }),
    removeChat: method({
      input: { chatId: Schema.String },
      success: Schema.Void,
    }),
  },
});
