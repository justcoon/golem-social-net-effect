import { Schema } from "effect";
import { defineAgent, method, Snapshot } from "@golemcloud/effect-golem";
import { TimestampSchema } from "../common/types.js";
import { TimelinePostRefSchema, UserTimelineSchema, UserTimelineUpdatesSchema } from "./schema.js";

export const UserTimelineAgent = defineAgent({
  name: "UserTimelineAgent",
  mode: "durable",
  id: {
    id: Schema.String,
  },
  snapshotting: Snapshot.define({
    schema: Schema.NullOr(UserTimelineSchema),
    policy: Snapshot.policy.everyN(10),
  }),
  methods: {
    getTimeline: method({
      input: {},
      success: Schema.NullOr(UserTimelineSchema),
    }),
    getUpdates: method({
      input: { updatesSince: TimestampSchema },
      success: Schema.NullOr(UserTimelineUpdatesSchema),
    }),
    postsUpdated: method({
      input: { posts: Schema.Array(TimelinePostRefSchema) },
      success: Schema.Void,
    }),
  },
});
