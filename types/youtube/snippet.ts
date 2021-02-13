import { Thumbnail } from "./thumbnail";

export type Snippet = {
  publishedAt: Date;
  channelId: string;
  title: string;
  description: string;
  thumbnails: Map<string, Thumbnail>;
  channelTitle: string;
  liveBroadcastContent: string;
  publishTime: Date;
}
