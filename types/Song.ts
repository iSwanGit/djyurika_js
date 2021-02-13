export class Song {
  id: string;
  title: string;
  url: string;
  channel: string;
  thumbnail: string;
  duration: number;

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
