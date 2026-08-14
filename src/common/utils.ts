import { Timestamp } from "./types.js";

export function arrayChunks<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

export function getCurrentTimestamp(): Timestamp {
  return {
    timestamp: new Date().toISOString().replace("Z", "000+00:00"),
  };
}

export function getShardNumber(id: string, numOfShards: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % numOfShards;
}
