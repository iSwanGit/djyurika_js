import { SongSource } from "./SongSource";

export class Song {
  id: string;
  title: string;
  url: string;
  channel: string;
  thumbnail: string;
  duration: number;
  requestUserId: string;
  source: SongSource;
  startOffset: number;

  constructor(
    id?: string,
    title?: string,
    url?: string,
    channel?: string,
    thumbnail?: string,
    duration?: number,
    requestUserId?: string,
    source?: SongSource,
    startOffset?: number,
    ) {
      this.id = id;
      this.title = title;
      this.url = url;
      this.channel = channel;
      this.thumbnail = thumbnail;
      this.duration = duration;
      this.requestUserId = requestUserId;
      this.source = source;
      this.startOffset = startOffset ?? 0;
    }

  get durationH() {
    return Math.trunc(this.duration / 3600);
  }

  get durationM() {
    return Math.trunc((this.duration % 3600) / 60);
  }

  get durationS() {
    return Math.trunc(this.duration % 60);
  }
}
