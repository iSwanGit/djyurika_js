import { GuildMember, Message, VoiceBasedChannel } from "discord.js";

export class LeaveRequest {
  message: Message;
  reqUser: GuildMember;
  voiceChannel: VoiceBasedChannel;
  acceptedMemberIds = new Array<string>();
}
