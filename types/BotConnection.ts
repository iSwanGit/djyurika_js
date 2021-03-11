import { VoiceConnection, GuildMember, Message } from "discord.js";
import { LeaveRequest, MoveRequest, SearchResult, SongQueue, Config, AddPlaylistConfirmList } from ".";

export class BotConnection {
  queue: SongQueue;
  joinedVoiceConnection: VoiceConnection;
  channelJoinRequestMember: GuildMember;
  recentNowPlayingMessage: Message;
  intervalHandler: NodeJS.Timeout;
  config: Config;

  songStartTimestamp: number;
  skipFlag = false;

  searchResultMsgs = new Map<string, SearchResult>(); // string: message id
  moveRequestList = new Map<string, MoveRequest>();  // string: message id
  leaveRequestList = new Map<string, LeaveRequest>();  // string: message id
  addPlaylistConfirmList = new Map<string, AddPlaylistConfirmList>();  // string: message id
}
