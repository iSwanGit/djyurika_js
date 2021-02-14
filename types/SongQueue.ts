import Discord from 'discord.js';
import { Song } from './Song';

export class SongQueue {
  textChannel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
  songs: Array<Song>;
  volume: number;
  playing: boolean;

  constructor(
    textChannel?: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel,
    songs?: Array<Song>,
    volume?: number,
    playing?: boolean,
    ) {
      this.textChannel = textChannel;
      this.songs = songs;
      this.volume = volume;
      this.playing = playing;
    }
}