import { GuildMember, Message, User, VoiceChannel } from "discord.js";

export class MoveRequest {
  message: Message;
  targetChannel: VoiceChannel;
  reqUser: GuildMember;
  acceptedMemberIds = new Array<string>();
}
