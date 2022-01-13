import { GuildMember, Message, VoiceBasedChannel } from 'discord.js';
import { AudioResource, PlayerSubscription, VoiceConnection } from '@discordjs/voice';
import { LeaveRequest, MoveRequest, SearchResult, SongQueue, Config, AddPlaylistConfirmList, LoopType, PlayHistory } from '.';

export class BotConnection {
  queue: SongQueue;
  history: PlayHistory[] = [];

  joinedVoiceChannel: VoiceBasedChannel;
  subscription: PlayerSubscription;
  currentAudioResource: AudioResource;
  channelJoinRequestMember: GuildMember;
  recentNowPlayingMessage: Message;
  intervalHandler: NodeJS.Timeout;
  config: Config;

  songStartTimestamp: number;
  skipFlag = false;
  loopFlag = LoopType.NONE;

  searchResultMsgs = new Map<string, SearchResult>(); // string: message id
  moveRequestList = new Map<string, MoveRequest>();  // string: message id
  leaveRequestList = new Map<string, LeaveRequest>();  // string: message id
  addPlaylistConfirmList = new Map<string, AddPlaylistConfirmList>();  // string: message id
}
