import { GuildMember, Message, VoiceBasedChannel } from 'discord.js';
import { AudioResource, PlayerSubscription } from '@discordjs/voice';
import { LeaveRequest, MoveRequest, SearchResult, SongQueue, Config, AddPlaylistConfirmList, LoopType, PlayHistory } from '.';

export class BotConnection {
  queue: SongQueue;

  joinedVoiceChannel: VoiceBasedChannel;
  subscription: PlayerSubscription;
  currentAudioResource: AudioResource;
  channelJoinRequestMember: GuildMember;
  recentNowPlayingMessage: Message;
  npMsgIntervalHandler: NodeJS.Timeout;
  pauseTimeCounterHandler: NodeJS.Timeout;
  config: Config;

  songStartTimestamp: number;
  songStartOffset = 0;
  pauseTimeCounter = 0;
  skipFlag = false;
  loopFlag = LoopType.NONE;

  searchResultMsgs = new Map<string, SearchResult>(); // string: message id
  moveRequestList = new Map<string, MoveRequest>();  // string: message id
  leaveRequestList = new Map<string, LeaveRequest>();  // string: message id
  addPlaylistConfirmList = new Map<string, AddPlaylistConfirmList>();  // string: message id
}
