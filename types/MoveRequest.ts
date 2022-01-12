import { GuildMember, Message, VoiceBasedChannel } from "discord.js";

export class MoveRequest {
  message: Message;
  targetChannel: VoiceBasedChannel;
  reqUser: GuildMember;
  acceptedMemberIds = new Array<string>();
}
