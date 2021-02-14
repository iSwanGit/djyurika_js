import { GuildMember, Message, VoiceChannel } from "discord.js";

export class LeaveRequest {
  message: Message;
  reqUser: GuildMember;
  voiceChannel: VoiceChannel;
  acceptedMemberIds = new Array<string>();
}
