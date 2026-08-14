import { Effect } from "effect";
import { Timestamp } from "./types.js";
import { getCurrentTimestamp } from "./utils.js";

export function pollForUpdates<T>(
  userId: string,
  updatesSince: Timestamp | undefined,
  iterWaitTimeMs: number | undefined,
  maxWaitTimeMs: number | undefined,
  getUpdatesFn: (id: string, since: Timestamp) => Effect.Effect<T[] | null, any, any>,
  logPrefix: string,
): Effect.Effect<T[] | null, any, any> {
  return Effect.gen(function* () {
    const since = updatesSince ?? getCurrentTimestamp();
    const maxWaitTime = maxWaitTimeMs ?? 10000;
    const iterWaitTime = iterWaitTimeMs ?? 1000;
    const startTime = Date.now();
    let done = false;
    let result: T[] | null = null;

    while (!done) {
      const elapsedTime = Date.now() - startTime;
      yield* Effect.logInfo(
        `${logPrefix} - user id: ${userId}, updates since: ${since.timestamp}, elapsed time: ${elapsedTime}ms, max wait time: ${maxWaitTime}ms`,
      );

      const res = yield* getUpdatesFn(userId, since);

      if (res !== null) {
        if (res.length > 0) {
          result = res;
          done = true;
        } else {
          result = [];
          done = Date.now() - startTime >= maxWaitTime;
          if (!done) {
            yield* Effect.sleep(`${iterWaitTime} millis`);
          }
        }
      } else {
        result = null;
        done = true;
      }
    }
    return result;
  });
}
