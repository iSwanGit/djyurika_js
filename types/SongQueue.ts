import { DMChannel, NewsChannel, PartialDMChannel, TextChannel, ThreadChannel } from 'discord.js';
import { Song } from './Song';

export class SongQueue {
  textChannel: DMChannel | PartialDMChannel | NewsChannel | TextChannel | ThreadChannel;
  songs: Array<Song>;

  constructor(
    textChannel?: DMChannel | PartialDMChannel | NewsChannel | TextChannel | ThreadChannel,
    songs?: Array<Song>,
    ) {
      this.textChannel = textChannel;
      this.songs = songs;
    }
}