import { Message, User } from 'discord.js';
import { SongSource } from './SongSource';

export class SearchResult {
  message: Message;
  songUrls: Array<[SongSource, string]>;
  reqUser: User;
}
