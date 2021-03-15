import Discord from 'discord.js';
import { Song } from './Song';

export class SongQueue {
  textChannel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
  songs: Array<Song>;

  constructor(
    textChannel?: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel,
    songs?: Array<Song>,
    ) {
      this.textChannel = textChannel;
      this.songs = songs;
    }
}