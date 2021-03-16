import { GuildMember, Message } from "discord.js";
import { SetInfo } from "soundcloud-downloader/src/info";
import ytpl from 'ytpl';
import { SongSource } from "./SongSource";

export class AddPlaylistConfirmList {
  message: Message;
  reqUser: GuildMember;
  playlist: ytpl.Result | SetInfo;
  provider: SongSource;
}
