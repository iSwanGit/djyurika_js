import Discord from 'discord.js';
import { Song } from "./Song";

export class SongQueue {
  textChannel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
  voiceChannel: Discord.VoiceChannel;
  connection: Discord.VoiceConnection;
  songs: Array<Song>;
  volume: number;
  playing: boolean;
}