import { GuildMember, Message } from "discord.js";
import ytpl from 'ytpl';

export class AddPlaylistConfirmList {
  message: Message;
  reqUser: GuildMember;
  playlist: ytpl.Result;
}
