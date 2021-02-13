export class Song {
  id: string;
  title: string;
  url: string;
  channel: string;
  thumbnail: string;
  duration: number;
  durationH: number;
  durationM: number;
  durationS: number;

  constructor(
    id?: string,
    title?: string,
    url?: string,
    channel?: string,
    thumbnail?: string,
    duration?: number,
    ) {
      this.id = id;
      this.title = title;
      this.url = url;
      this.channel = channel;
      this.thumbnail = thumbnail;
      this.duration = duration;
      this.durationH = Math.trunc(duration / 3600);
      this.durationM = Math.trunc((duration % 3600) / 60);
      this.durationS = Math.trunc(duration % 60);
    }
}
