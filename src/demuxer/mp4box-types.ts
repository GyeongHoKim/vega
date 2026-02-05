/**
 * Type definitions for MP4Box.js
 * Based on the MP4Box.js API documentation and usage patterns.
 */

export interface MP4BoxFile {
  onMoovStart?: () => void;
  onReady?: (info: MP4Info) => void;
  onError?: (error: string) => void;
  onSamples?: (trackId: number, ref: unknown, samples: MP4Sample[]) => void;

  appendBuffer(data: ArrayBufferWithFileStart): number;
  start(): void;
  stop(): void;
  flush(): void;
  seek(time: number, useRap?: boolean): { offset: number; time: number };
  setExtractionOptions(trackId: number, user?: unknown, options?: ExtractionOptions): void;
  unsetExtractionOptions(trackId: number): void;
  releaseUsedSamples(trackId: number, sampleNumber: number): void;
  getTrackById(trackId: number): MP4Track | undefined;

  moov?: {
    traks: MP4Trak[];
  };
}

export interface ArrayBufferWithFileStart extends ArrayBuffer {
  fileStart: number;
}

export interface ExtractionOptions {
  nbSamples?: number;
  rapAlignement?: boolean;
}

export interface MP4Info {
  duration: number;
  timescale: number;
  isFragmented: boolean;
  isProgressive: boolean;
  hasIOD: boolean;
  brands: string[];
  created?: Date;
  modified?: Date;
  tracks: MP4TrackInfo[];
  videoTracks: MP4VideoTrackInfo[];
  audioTracks: MP4AudioTrackInfo[];
}

export interface MP4TrackInfo {
  id: number;
  created?: Date;
  modified?: Date;
  movie_duration: number;
  layer: number;
  alternate_group: number;
  volume: number;
  track_width: number;
  track_height: number;
  timescale: number;
  duration: number;
  bitrate: number;
  codec: string;
  language: string;
  nb_samples: number;
}

export interface MP4VideoTrackInfo extends MP4TrackInfo {
  video: {
    width: number;
    height: number;
  };
}

export interface MP4AudioTrackInfo extends MP4TrackInfo {
  audio: {
    sample_rate: number;
    channel_count: number;
    sample_size: number;
  };
}

export interface MP4Sample {
  number: number;
  track_id: number;
  timescale: number;
  description_index: number;
  description: unknown;
  data: ArrayBuffer;
  size: number;
  alreadyRead?: number;
  duration: number;
  cts: number;
  dts: number;
  is_sync: boolean;
  is_leading: number;
  depends_on: number;
  is_depended_on: number;
  has_redundancy: number;
  degradation_priority: number;
  offset: number;
}

export interface MP4Track {
  mdia: {
    minf: {
      stbl: {
        stsd: {
          entries: MP4SampleDescriptionEntry[];
        };
      };
    };
  };
}

export interface MP4Trak extends MP4Track {
  tkhd: {
    track_id: number;
  };
}

export interface MP4SampleDescriptionEntry {
  avcC?: MP4ConfigBox;
  hvcC?: MP4ConfigBox;
  vpcC?: MP4ConfigBox;
  av1C?: MP4ConfigBox;
  esds?: {
    esd: {
      descs: Array<{
        tag: number;
        oti?: number;
        descs?: Array<{
          tag: number;
          data: Uint8Array;
        }>;
      }>;
    };
  };
}

export interface MP4ConfigBox {
  write(stream: DataStream): void;
}

export interface DataStream {
  buffer: ArrayBuffer;
}

export interface DataStreamConstructor {
  new (arrayBuffer?: ArrayBuffer, byteOffset?: number, endianness?: number): DataStream;
  BIG_ENDIAN: number;
  LITTLE_ENDIAN: number;
}

export interface MP4BoxModule {
  createFile(): MP4BoxFile;
  DataStream: DataStreamConstructor;
}

declare global {
  const MP4Box: MP4BoxModule;
  const DataStream: DataStreamConstructor;
}
