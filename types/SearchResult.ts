import { Message, User } from 'discord.js';

export class SearchResult {
  message: Message;
  songIds: Array<string>;
  reqUser: User;
}
