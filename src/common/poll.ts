import { Effect, Ref, Schedule, Stream } from "effect";
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

export function streamUpdates<T>(
  userId: string,
  since: string | null | undefined,
  iterWaitTime: number | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchUpdates: (userId: string, since: string) => Effect.Effect<T[] | null, any, any>,
  getItemTimestamp: (item: T) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Effect.Effect<Stream.Stream<T, unknown, never>, never, any> {
  return Effect.gen(function* () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = yield* Effect.context<any>();
    const interval = iterWaitTime ?? 1000;
    const initialSince = since ?? getCurrentTimestamp().timestamp;
    const cursorRef = yield* Ref.make(initialSince);

    const pollEffect = Effect.scoped(
      Effect.gen(function* () {
        const currentSince = yield* Ref.get(cursorRef);
        const updates = yield* fetchUpdates(userId, currentSince);

        if (updates && updates.length > 0) {
          const latest = updates.reduce((max, item) => {
            const ts = getItemTimestamp(item);
            return ts > max ? ts : max;
          }, currentSince);
          yield* Ref.set(cursorRef, latest);
          return updates;
        }
        return [] as T[];
      }),
    ).pipe(Effect.provide(context));

    return Stream.fromEffectSchedule(pollEffect, Schedule.spaced(`${interval} millis`)).pipe(
      Stream.flatMap((items: T[]) => Stream.fromIterable(items)),
    );
  });
}
