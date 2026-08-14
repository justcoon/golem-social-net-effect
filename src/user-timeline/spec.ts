import { Schema } from "effect";
import { defineAgent, method, Snapshot } from "@golemcloud/effect-golem";
import { TimestampSchema } from "../common/types.js";
import {
  TimelinePostRefSchema,
  UserTimelineSchema,
  UserTimelineUpdatesSchema,
} from "./schema.js";

export const UserTimelineAgent = defineAgent({
  name: "UserTimelineAgent",
  mode: "durable",
  constructorParams: {
    id: Schema.String,
  },
  snapshot: Snapshot.define({
    schema: Schema.NullOr(UserTimelineSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getTimeline: method({
      params: {},
      success: Schema.NullOr(UserTimelineSchema),
    }),
    getUpdates: method({
      params: { updatesSince: TimestampSchema },
      success: Schema.NullOr(UserTimelineUpdatesSchema),
    }),
    postsUpdated: method({
      params: { posts: Schema.Array(TimelinePostRefSchema) },
      success: Schema.Void,
    }),
  },
});
