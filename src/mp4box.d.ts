/**
 * Type declaration for mp4box (no @types/mp4box); worker imports it for demuxing.
 */
declare module "mp4box" {
  export function createFile(): unknown;
  export const DataStream: unknown;
}
