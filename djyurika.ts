import { Client, DMChannel, Guild, GuildMember, Message, MessageEmbed, MessageReaction, NewsChannel, TextChannel, User, VoiceChannel } from 'discord.js';
import ytdl from 'ytdl-core-discord';
import ytdlc, { videoInfo } from 'ytdl-core';  // for using type declaration
import ytpl from 'ytpl';
import scdl from 'soundcloud-downloader';
import { SetInfo, TrackInfo } from 'soundcloud-downloader/src/info';

import { environment, keys } from './config';
import { AddPlaylistConfirmList, BotConnection, Config, LeaveRequest, LoopType, MoveRequest, SearchError, SearchResult, ServerOption, Song, SongQueue, SongSource, UpdatedVoiceState, YoutubeSearch } from './types';
import { checkDeveloperRole, checkModeratorRole, fillZeroPad, getYoutubeSearchList } from './util';
import { DJYurikaDB } from './DJYurikaDB';
import { SearchResponseAll } from 'soundcloud-downloader/src/search';

export class DJYurika {
  private readonly client: Client;
  private readonly db: DJYurikaDB;

  private readonly selectionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  private readonly cancelEmoji = '❌';
  private readonly acceptEmoji = '⭕';
  private readonly denyEmoji = '❌';
  private readonly helpCmd = '`~p`: 노래 검색/재생\n' +
  '`~q`: 대기열 정보\n' +
  '`~np`: 현재 곡 정보\n' +
  '`~s`: 건너뛰기\n' +
  '`~l`: 채널에서 봇 퇴장\n' + 
  '`~loop`: 현재 곡 반복/해제\n' + 
  '`~loopq`: 현재 재생목록 반복/해제\n' + 
  '`~move`: 음성 채널 이동 요청\n' +
  '`~ping`: 지연시간 측정(메시지)\n';
  private readonly helpCmdMod = '`~p`: 노래 검색/재생\n' +
  '`~q`: 대기열 정보\n' +
  '`~np`: 현재 곡 정보\n' +
  '`~s`: 건너뛰기\n' +
  '`~l`: 채널에서 봇 퇴장\n' + 
  '`~loop`: 현재 곡 반복/해제\n' + 
  '`~loopq`: 현재 재생목록 반복/해제\n' + 
  '`~m`: 재생목록 순서 변경\n' + 
  '`~d`: 재생목록에서 곡 삭제\n' + 
  '`~c`: 재생목록 비우기\n' + 
  '`~move`: 음성 채널 이동 요청\n' +
  '`~ping`: 지연시간 측정(메시지)\n' +
  '`~v`: 음량 조정\n';
  private readonly helpCmdDev = '`~p`: 노래 검색/재생\n' +
  '`~q`: 대기열 정보\n' +
  '`~np`: 현재 곡 정보\n' +
  '`~npid`: 현재 곡 ID\n' + 
  '`~s`: 건너뛰기\n' +
  '`~l`: 채널에서 봇 퇴장\n' + 
  '`~loop`: 현재 곡 반복/해제\n' + 
  '`~loopq`: 현재 재생목록 반복/해제\n' + 
  '`~m`: 재생목록 순서 변경\n' + 
  '`~d`: 재생목록에서 곡 삭제\n' + 
  '`~c`: 재생목록 비우기\n' + 
  '`~move`: 음성 채널 이동 요청\n' +
  '`~ping`: 지연시간 측정(메시지)\n' +
  '`~v`: 음량 조정\n' + 
  '`~cl`: 기본 설정값 로드\n' + 
  '`~cs`: 설정값 저장\n';

  private readonly defaultConfig: Config;
  private readonly serverConfigs: Map<string, Config>;
  private readonly overrideConfigs: Map<string, Config>;
  private readonly connections: Map<string, BotConnection>;
  private readonly interval: number;
  private readonly maxQueueTextRowSize: number;
  
  constructor() {
    this.db = new DJYurikaDB();
    this.client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
    this.defaultConfig = environment.defaultConfig as Config;
    this.serverConfigs = new Map<string, Config>();
    this.overrideConfigs = new Map<string, Config>();
    this.connections = new Map<string, BotConnection>();
    this.interval = environment.refreshInterval;
    this.maxQueueTextRowSize = environment.maxQueueTextRows;
  }

  // ------- Client Initialization -------

  public async start() {
    try {
      this.registerConnectionHandler();
      this.registerVoiceStateUpdateHandler();
      this.registerMessageHandler();
      this.registerMessageReactionAddHandler();
      this.registerMessageReactionRemoveHandler();
      
      await this.initConfig();
      
      this.client.login(keys.botToken);
    }
    catch (err) {
      console.error(err);
    }
  }

  private async initConfig() {
    await this.db.waitAndCheckPoolCreated();  // wait until pool is created

    const configs = await this.db.loadAllConfig();
    for (const config of configs) {
      this.serverConfigs.set(config.server, config);
    }
    this.loadLocalConfig();
    
    console.log('All configs are loaded');
  }

  // load config in environments and override
  private loadLocalConfig() {
    for (const config of environment.overrideConfigs) {
      const override = Object.assign(new Config(), this.serverConfigs.get(config.server));  // deep copy
      override.volume = config.volume ||  this.defaultConfig.volume;
      override.commandChannelID = config.commandChannelID || override.commandChannelID || null;
      override.developerRoleID = config.developerRoleID || override.developerRoleID || null;
      override.moderatorRoleID = config.moderatorRoleID || override.moderatorRoleID || null;
      this.overrideConfigs.set(config.server, override);
    }
    console.log(`${environment.overrideConfigs.length} configs overrided`);
  }

  private registerConnectionHandler() {
    this.client.once('ready', async () => {
      await this.refreshServerName();
      await this.client.user.setActivity('Help: ~h', { type: 'PLAYING' });
      console.log('Ready!');
    });
    this.client.once('reconnecting', () => {
      console.log('Reconnecting!');
    });
    this.client.once('disconnect', () => {
      console.log('Disconnect!');
    });
  }

  private registerMessageHandler() {
    this.client.on('message', async message => {
      
      // load config
      let cfg: Config;
      if (this.overrideConfigs.has(message.guild.id)) {
        cfg = this.overrideConfigs.get(message.guild.id);
      }
      else {
        cfg = this.serverConfigs.get(message.guild.id);
      }

      // load bot connection
      let conn = this.connections.get(message.guild.id);
      if (!conn) {
        conn = new BotConnection();
        conn.config = cfg;
        this.connections.set(message.guild.id, conn);
      }
    
      if (message.author.bot) return;   // ignore self message
      if (!message.content.startsWith(environment.prefix)) return;  // ignore not including prefix
    
      // ignore messages from another channel
      if (message.channel.id !== cfg.commandChannelID) return;
    
      // need help?
      const cmd = message.content.split(' ')[0].replace(`${environment.prefix}`, '');
      if (cmd === 'h') {
        return this.sendHelp(message);
      }
    
      // check sender is in voice channel (except moderator and developer)
      const voiceChannel = message.member.voice.channel;
      if (!(checkDeveloperRole(message.member, cfg) || checkModeratorRole(message.member, cfg))) {
        if (!voiceChannel) {
          return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');
        }
      }
    
    
      switch (cmd.toLowerCase()) {
        case 'p':
        case 'ㅔ':
          this.execute(message, conn);
          break;
    
        case 'np':
        case 'ㅞ':
          this.nowPlaying(message, conn);
          break;
    
        case 'q':
        case 'ㅂ':
          this.getQueue(message, conn);
          break;
    
        case 's':
        case 'ㄴ':
          this.skip(message, conn);
          break;
    
        case 'l':
        case 'ㅣ':
          this.requestStop(message, conn, cfg);
          break;
    
        case 'loop':
          this.setLoop(message, conn, LoopType.SINGLE);
          break;
        
        case 'loopq':
          this.setLoop(message, conn, LoopType.LIST);
          break;
    
        case 'npid':
          if (checkDeveloperRole(message.member, cfg)) {
            if (conn.queue && conn.queue.songs.length > 0) {
              message.channel.send(`🎵 id: \`${conn.queue.songs[0]?.id}\``)
            }
          }
          break;
    
        case 'd':
          if (checkModeratorRole(message.member, cfg) || checkDeveloperRole(message.member, cfg)) {
            this.deleteSong(message, conn);
          }
          break;
    
        case 'm':
          if (checkModeratorRole(message.member, cfg) || checkDeveloperRole(message.member, cfg)) {
            this.modifyOrder(message, conn);
          }
          break;
    
        case 'c':
          if (checkModeratorRole(message.member, cfg) || checkDeveloperRole(message.member, cfg)) {
            this.clearQueue(message, conn);
          }
          break;
    
        case 'move':
          this.requestMove(message, conn, cfg);
          break;
    
        case 'v':
          if (checkModeratorRole(message.member, cfg) || checkDeveloperRole(message.member, cfg)) {
            this.changeVolume(message, conn);
          }
          break;
    
        case 'cl':
          if (checkDeveloperRole(message.member, cfg)) {
            this.loadConfig(message, conn);
          }
          break;
    
        case 'cs':
          if (checkDeveloperRole(message.member, cfg)) {
            this.saveConfig(message, conn);
          }
          break;
    
        case 'ping':
          this.calculatePing(message);
          break;
    
        default:
          message.channel.send('사용법: `~h`');
          break;
      }
    });
  }
  private registerMessageReactionAddHandler() {
    this.client.on('messageReactionAdd', async (reaction: MessageReaction, user: User) => {
      const servOpt = this.serverConfigs.get(reaction.message.guild.id);
      const conn = this.connections.get(reaction.message.guild.id);
    
      const reactedUser = reaction.message.guild.members.cache.get(user.id);
      var selectedMsg: SearchResult | MoveRequest | LeaveRequest | AddPlaylistConfirmList;
    
      if (!conn) return;  // ignore message which is created before bot is initialized
      // 아무 명령도 받지 않은 초기 상태 && 기존에 쌓인 메시지 인 경우 무시

      if (user.id === this.client.user.id) return; // ignore self reaction
      if (!conn.searchResultMsgs.has(reaction.message.id) && !conn.moveRequestList.has(reaction.message.id) && !conn.leaveRequestList.has(reaction.message.id) && !conn.addPlaylistConfirmList.has(reaction.message.id)) return; // ignore reactions from other messages
    
      selectedMsg = conn.searchResultMsgs.get(reaction.message.id);
      if (selectedMsg) {
        // check requested user is in voice channel
        const voiceChannel = reaction.message.guild.members.cache.get(user.id).voice.channel;
        if (!voiceChannel) {
          reaction.message.reply(`<@${user.id}> 재생을 원하는 음성채널에 들어와서 다시 요청해 주세요.`);
          return;
        }
    
        //  except developer or moderator
        if (!(checkDeveloperRole(reactedUser, servOpt) || checkModeratorRole(reactedUser, servOpt))) {
          // requested user only
          if (user.id !== selectedMsg.reqUser.id) return;
        }
    
        // cancel
        if (reaction.emoji.name === this.cancelEmoji) {
          reaction.message.edit('⚠ `검색 취소됨`');
          reaction.message.suppressEmbeds();
          reaction.message.reactions.removeAll();
          conn.searchResultMsgs.delete(reaction.message.id);
          return;
        }
      
        const selected = this.selectionEmojis.indexOf(reaction.emoji.name);
        if (selected >= environment.maxSearchResults * 2) return;  // ignore other reaction
        const [type, url] = selectedMsg.songUrls[selected];

        switch (type) {
          case SongSource.YOUTUBE:
            this.playYoutubeRequest(conn, reaction.message, user, url, reaction.message.id);
            break;
          case SongSource.SOUNDCLOUD:
            this.playSoundcloudRequest(conn, reaction.message, user, url, reaction.message.id);
            break;
          default:
            break;
        }

        conn.searchResultMsgs.delete(reaction.message.id);
        return;
      }
    
      selectedMsg = conn.moveRequestList.get(reaction.message.id);
      if (selectedMsg) {
        // channel move vote
        
        // self vote - ok: nothing, deny: cancel
        if (reactedUser.id === selectedMsg.reqUser.id) {
          if (reaction.emoji.name === this.denyEmoji) {
            // cancel
            reaction.message.edit('⚠ `요청 취소됨`');
            reaction.message.suppressEmbeds();
            reaction.message.reactions.removeAll();
            conn.moveRequestList.delete(reaction.message.id);
          }
          return;
        }
    
        // vote
        const currentJoinedUsers = conn.joinedVoiceConnection.channel.members;
        if (reaction.emoji.name === this.acceptEmoji) {
          if (!selectedMsg.acceptedMemberIds.includes(user.id)) {
            selectedMsg.acceptedMemberIds.push(user.id);
          }
    
          // current count
          const acceptedVotes = selectedMsg.acceptedMemberIds;
          const minimumAcceptCount = Math.round((currentJoinedUsers.size-1) / 2);  // except bot
          let acceptedVoiceMemberCount = 0;
          currentJoinedUsers.forEach(user => {
            if (acceptedVotes.includes(user.id)) acceptedVoiceMemberCount++;
          });
          
          // 과반수, ok
          if (acceptedVoiceMemberCount >= minimumAcceptCount) {
            // send message
            reaction.message.channel.send('🔊 과반수의 동의로 음성채널을 이동합니다');
            // channel move
            this.moveVoiceChannel(conn, reaction.message, reactedUser, reaction.message.channel, selectedMsg.targetChannel);
          }
        }
        return;
      }
    
      selectedMsg = conn.leaveRequestList.get(reaction.message.id);
      if (selectedMsg) {
        // self vote - ok: **include**, deny: cancel
        if (reactedUser.id === selectedMsg.reqUser.id) {
          if (reaction.emoji.name === this.denyEmoji) {
            // cancel
            reaction.message.edit('⚠ `요청 취소됨`');
            reaction.message.suppressEmbeds();
            reaction.message.reactions.removeAll();
            conn.leaveRequestList.delete(reaction.message.id);
            return;
          }
          // include self vote for leave request
        }
    
        // vote
        const currentJoinedUsers = conn.joinedVoiceConnection.channel.members;
        if (reaction.emoji.name === this.acceptEmoji) {
          if (!selectedMsg.acceptedMemberIds.includes(user.id)) {
            selectedMsg.acceptedMemberIds.push(user.id);
          }
    
          // current count
          const acceptedVotes = selectedMsg.acceptedMemberIds;
          const minimumAcceptCount = Math.round((currentJoinedUsers.size-1) / 2);  // except bot
          let acceptedVoiceMemberCount = 0;
          currentJoinedUsers.forEach(user => {
            if (acceptedVotes.includes(user.id)) acceptedVoiceMemberCount++;
          });
          
          // 과반수, ok
          if (acceptedVoiceMemberCount >= minimumAcceptCount) {
            // send message
            reaction.message.channel.send('🔊 과반수 동의, 그럼 20000 들어가보겠습니다');
            // leave
            this.stop(reaction.message, reaction.message.id);
          }
        }
        return;
      }
    
      selectedMsg = conn.addPlaylistConfirmList.get(reaction.message.id);
      if (selectedMsg) {
    
        //  except developer or moderator
        if (!(checkDeveloperRole(reactedUser, servOpt) || checkModeratorRole(reactedUser, servOpt))) {
          const voiceChannel = reaction.message.guild.members.cache.get(user.id).voice.channel;
          // requested user only
          if (user.id !== selectedMsg.reqUser.id) return;
          // check requested user is in voice channel
          if (!voiceChannel) {
            reaction.message.reply(`<@${user.id}> 재생을 원하는 음성채널에 들어와서 다시 요청해 주세요.`);
            return;
          }
        }
      
        // cancel
        if (reaction.emoji.name === this.cancelEmoji) {
          reaction.message.edit('⚠ `추가 취소됨`');
          reaction.message.suppressEmbeds();
          reaction.message.reactions.removeAll();
          conn.searchResultMsgs.delete(reaction.message.id);
          return;
        }
        // accept
        else if (reaction.emoji.name === this.acceptEmoji) {
          switch (selectedMsg.provider) {
            case SongSource.YOUTUBE:
              this.playYoutubeRequestList(conn, reaction.message, user, selectedMsg.playlist as ytpl.Result, reaction.message.id);
              break;
            case SongSource.SOUNDCLOUD:
              this.playSoundcloudRequestList(conn, reaction.message, user, selectedMsg.playlist as SetInfo, reaction.message.id);
              break;
          }
          conn.searchResultMsgs.delete(reaction.message.id);
        }
      }
    
      // nothing of both
      return;
    });
  }
    
  private registerMessageReactionRemoveHandler() {
    this.client.on('messageReactionRemove', async (reaction: MessageReaction, user: User) => {
      const conn = this.connections.get(reaction.message.guild.id);
    
      var selectedMsg: SearchResult | MoveRequest | LeaveRequest;
    
      if (!conn) return;  // ignore message which is created before bot is initialized
      // 아무 명령도 받지 않은 초기 상태 && 기존에 쌓인 메시지 인 경우 무시

      if (user.id === this.client.user.id) return; // ignore self reaction
      if (!conn.searchResultMsgs.has(reaction.message.id) && !conn.moveRequestList.has(reaction.message.id) && !conn.leaveRequestList.has(reaction.message.id)) return; // ignore reactions from other messages
    
      // vote re-calculate
      selectedMsg = conn.moveRequestList.get(reaction.message.id);
      if (selectedMsg) {
        if (reaction.emoji.name === this.acceptEmoji) {
          // undo vote
          const index = selectedMsg.acceptedMemberIds.indexOf(user.id);
          if (index !== undefined) {
            selectedMsg.acceptedMemberIds.splice(index, 1);
          }
        }
        return;
      }
    
      selectedMsg = conn.leaveRequestList.get(reaction.message.id);
      if (selectedMsg) {
        if (reaction.emoji.name === this.acceptEmoji) {
          // undo vote
          const index = selectedMsg.acceptedMemberIds.indexOf(user.id);
          if (index !== undefined) {
            selectedMsg.acceptedMemberIds.splice(index, 1);
          }
        }
        return;
      }
    
    });
  }

  private registerVoiceStateUpdateHandler() {
    // Event가 발생한 Member의 State
    this.client.on('voiceStateUpdate', (oldState, newState) => {
      const conn = this.connections.get(oldState.guild.id);
      
      if (!conn?.joinedVoiceConnection) return;
    
      let state: UpdatedVoiceState;
      // discriminate voice state
      if (oldState.channel?.id === conn.joinedVoiceConnection.channel.id && newState.channel?.id !== conn.joinedVoiceConnection.channel.id) {
        // 나감
        state = UpdatedVoiceState.OUT;
        console.log(`[${oldState.guild.name}] ` + oldState.member.displayName + ' leaved ' + conn.joinedVoiceConnection.channel.name);
        if (oldState.member.id === conn.channelJoinRequestMember?.id) {
          conn.channelJoinRequestMember = null;
          console.info(oldState.member.displayName + ' was summoner');
        }
      }
      else if (!oldState.channel && newState.channel?.id === conn.joinedVoiceConnection.channel.id) {
        state = UpdatedVoiceState.IN;
        console.log(`[${oldState.guild.name}] ` + oldState.member.displayName + ' joined ' + conn.joinedVoiceConnection.channel.name);
      }
      else {
        state = UpdatedVoiceState.NONE;
      }
    
      // vote re-calculate
      const currentJoinedUsers = conn.joinedVoiceConnection.channel.members;
      // current count
      conn.moveRequestList.forEach((req, msgId, list) => {
        // 채널 소환자가 나가면
        if (state === UpdatedVoiceState.OUT && req.reqUser.id === newState.member.id) {
          req.message.edit('⚠ `요청 취소됨 (퇴장)`'); // my message, no error
          req.message.suppressEmbeds();
          req.message.reactions.removeAll();
          return list.delete(msgId);  // == continue, cannot break (overhead)
        }
        else {
          const acceptedVotes = req.acceptedMemberIds;
          const minimumAcceptCount = Math.round((currentJoinedUsers.size-1) / 2);  // except bot
          let acceptedVoiceMemberCount = 0;
          currentJoinedUsers.forEach(user => {
            if (acceptedVotes.includes(user.id)) acceptedVoiceMemberCount++;
          });
          // 과반수, ok
          if (acceptedVoiceMemberCount >= minimumAcceptCount) {
            // send message
            req.message.channel.send('🔊 인원수 변동으로 인한 과반수의 동의로 음성채널을 이동합니다');
            // channel move
            this.moveVoiceChannel(conn, req.message, req.reqUser, req.message.channel, req.targetChannel);
          }
        }
      });
      
      for (let [key, req] of conn.leaveRequestList) {
        // 채널 소환자가 나가면
        if (state === UpdatedVoiceState.OUT && req.reqUser.id === newState.member.id) {
          req.message.edit('⚠ `요청 취소됨 (퇴장)`');
          req.message.suppressEmbeds();
          req.message.reactions.removeAll();
          conn.leaveRequestList.delete(key);
        }
        // if my voice channel has changed(req channel is different), ignore all
        else if (conn.joinedVoiceConnection.channel.id !== req.voiceChannel.id) {
          req.message.edit('⚠ `요청 취소됨 (DJ Yurika 채널 이동)`');
          req.message.suppressEmbeds();
          req.message.reactions.removeAll();
          conn.leaveRequestList.delete(key);
        }
        else {
          const acceptedVotes = req.acceptedMemberIds;
          const minimumAcceptCount = Math.round((currentJoinedUsers.size-1) / 2);  // except bot
          let acceptedVoiceMemberCount = 0;
          currentJoinedUsers.forEach(user => {
            if (acceptedVotes.includes(user.id)) acceptedVoiceMemberCount++;
          });
          // 과반수, ok
          if (acceptedVoiceMemberCount >= minimumAcceptCount) {
            // send message unless no members left
            if (acceptedVoiceMemberCount) {
              req.message.channel.send('🔊 `인원수 변동으로 인한 과반수 동의, 그럼 20000 들어가보겠습니다`');
            }
            this.stop(req.message, req.message.id);
            conn.leaveRequestList.clear();
            break;
          }
        }
      }
    });
  }

  // -------- function definition -------

  private async refreshServerName() {
    console.log('Refreshing server(guild) info...');
    for (const cfg of this.serverConfigs.values()) {
      await this.client.guilds.fetch(cfg.server)
      .then(guild => {
        const currentName = guild.name;
        if (cfg.name !== currentName) {
          cfg.name = currentName;
          this.db.saveConfig(cfg)
          .then(() => {
            console.log(`Server config of '${cfg.name}' is updated`);
          })
          .catch();
        }
      })
      .catch(err => {
        console.error(`${err.name}: ${err.message} (${cfg.server}, ${cfg.name})`);
      });
    }
  }

  private sendHelp(message: Message) {
    const opt = this.serverConfigs.get(message.guild.id);
    const cmdName = '명령어';
    let cmdValue: string;
    if (checkDeveloperRole(message.member, opt)) {
      cmdValue = this.helpCmdDev;
    }
    else if (checkModeratorRole(message.member, opt)) {
      cmdValue = this.helpCmdMod;
    }
    else {
      cmdValue = this.helpCmd;
    }
  
    const embedMessage = new MessageEmbed()
      .setAuthor('사용법', message.guild.me.user.avatarURL(), environment.githubRepoUrl)
      .setColor('#ffff00')
      .addFields(
        {
          name: cmdName,
          value: cmdValue,
        },
      );
  
    return message.channel.send(embedMessage);
  }

  private async execute(message: Message, conn: BotConnection) {
    const args = message.content.split(' ');
  
    if (args.length < 2 && conn.joinedVoiceConnection) {
      return message.channel.send('`~p <soundcloud_or_youtube_link>` or `~p <youtube_keyword>`');
    }
  
    // Developer/Moderator skip voice check when music playing
    if (!(conn.queue && conn.queue.songs.length)) {
      // check sender is in voice channel
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');    
      }
  
      // check permission of voice channel
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!conn.joinedVoiceConnection && !(permissions.has('CONNECT') && permissions.has('SPEAK'))) {
        return message.channel.send('```cs\n'+
        '# Error: 요청 음성채널 권한 없음\n'+
        '```');
      }
    }

    // first ~p, then random pick
    if (args.length === 1 && !conn.joinedVoiceConnection) {
      try {
        const randSong = await this.selectRandomSong(message.guild);
        console.log('Play request with no args, pick random one');
        this.playProcess(conn, message, message.author, randSong, null);
      }
      catch (err) {
        console.error(err);
        message.channel.send('History is empty, `~p <soundcloud_or_youtube_link>` or `~p <youtube_keyword>`');
      }
      finally {
        return;
      }
    }
  
    const arg = message.content.split(' ').slice(1).join(' ');
    // search (this message will be removed after found)
    let id = (await message.channel.send(`🎵 \`검색 중: ${arg}\``)).id;
    console.log(`[${message.guild.name}] ` + `검색 중: ${arg}`);
  
    // determine link or keyword
    const source = this.resolveSongSource(arg);
    switch (source) {
      case SongSource.YOUTUBE:
        if (arg.includes('list=')) {
          this.parseYoutubePlaylist(conn, message, message.author, arg, id);
        }
        else {
          this.playYoutubeRequest(conn, message, message.author, arg, id);
        }
        break;
      case SongSource.SOUNDCLOUD:
        if (scdl.isPlaylistURL(arg)) {
          // todo
          this.parseSoundcloudPlaylist(conn, message, message.author, arg, id);
        }
        else {
          this.playSoundcloudRequest(conn, message, message.author, arg, id);
        }
        break;
      
      default:
        this.keywordSearch(message, id, conn);
        break;
    }
  }

  private skip(message: Message, conn: BotConnection) {
    if (!message.member.voice.channel)
      return message.channel.send(
        'You have to be in a voice channel to stop the music!'
      );
    if (!conn.queue || conn.queue.songs.length === 0)
      return; // message.channel.send('There is no song that I could skip!');
    
    // 큐 변경 중 shift 일어날 경우 undefined에러 발생, ?로 객체 존재여부 확인 추가
    conn.skipFlag = true;
    console.log(`[${message.guild.name}] ` + `건너 뜀: ${conn.queue.songs[0]?.title}`);
    message.channel.send(`⏭ \`건너뛰기: ${conn.queue.songs[0]?.title}\``);
    if (conn.loopFlag === LoopType.SINGLE) {
      conn.loopFlag = LoopType.NONE;
      message.channel.send('🔂 `한곡 반복 해제됨`');
    }
    if (conn.joinedVoiceConnection && conn.joinedVoiceConnection.dispatcher) {
      conn.joinedVoiceConnection.dispatcher.end();
    }
  }
  
  private async nowPlaying(message: Message, conn: BotConnection) {
    if (!conn.queue || conn.queue.songs.length === 0 || !conn.joinedVoiceConnection || !conn.joinedVoiceConnection.dispatcher) {
      return;
    }
  
    const song = conn.queue.songs[0];
    if (!song) return message.channel.send('`Error: song object not defined`');  // prevent error
    // calculate current playtime. 1/3 scale
    var playtime: number | string = conn.joinedVoiceConnection.dispatcher.streamTime / 1000;
    const currentPoint = Math.round(playtime / song.duration * 100 / 4);
    var playbar: string[] | string = Array(26).fill('▬');
    playbar[currentPoint] = '🔘';
    playbar = playbar.join('');
    var remaintime: number | string = song.duration - playtime;
    if (song.duration >= 3600) {
      playtime = `${Math.trunc(playtime / 3600), 2}:${fillZeroPad(Math.trunc((playtime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(playtime % 60), 2)}`;
      remaintime = `-${Math.trunc(remaintime / 3600), 2}:${fillZeroPad(Math.trunc((remaintime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(remaintime % 60), 2)}`;
    } else {
      playtime = `${fillZeroPad(Math.trunc((playtime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(playtime % 60), 2)}`;
      remaintime = `-${fillZeroPad(Math.trunc((remaintime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(remaintime % 60), 2)}`;
    }
  
    const embedMessage = new MessageEmbed()
      .setAuthor(`${conn.joinedVoiceConnection.channel.name} 에서 재생 중`, message.guild.me.user.avatarURL(), song.url)
      .setColor('#0000ff')
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields(
        {
          name: '\u200B', // invisible zero width space
          value:  `**선곡: <@${song.requestUserId}>**\n\n\`${playtime}\` \`${playbar}\` \`${remaintime}\``, // playbar
          inline: false,
        },
        {
          name: '채널',
          value:  song.channel,
          inline: true,
        },
        {
          name:   '길이',
          value:  `${fillZeroPad(song.durationH, 2)}:${fillZeroPad(song.durationM, 2)}:${fillZeroPad(song.durationS, 2)}`,
          inline: true,
        }
      );
  
    switch (song.source) {
      case SongSource.YOUTUBE:
        embedMessage.setFooter('Youtube', 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png');
        break;
      case SongSource.SOUNDCLOUD:
        embedMessage.setFooter('SoundCloud', 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png');
        break;
    }
    
    conn.recentNowPlayingMessage = await message.channel.send(embedMessage);
    this.updateNowPlayingProgrssbar(conn);
  }
  
  private async getQueue(message: Message, conn: BotConnection) {
    if (!conn.queue || conn.queue.songs.length === 0) {
      return;
    }
  
    const guildName = message.guild.name;
    let queueData: string[] = [];
    const currentSong = conn.queue.songs[0];
    // slice maximum 50(env value)
    const length = conn.queue.songs.length - 1;
    const promise = conn.queue.songs.slice(1, this.maxQueueTextRowSize+1).map((song, index) => {
      if (!queueData[Math.trunc(index / 5)]) {
        queueData[Math.trunc(index / 5)] = '';
      }
      queueData[Math.trunc(index / 5)] += `${index+1}. [${song?.title}](${song?.url})\n`;
    });
    await Promise.all(promise);
    if (length > 50) {
      queueData[5] = `and ${length - this.maxQueueTextRowSize} more song(s)`;
    }
  
    let loopStr = '';
    switch (conn.loopFlag) {
      case LoopType.SINGLE:
        loopStr = '\n*(한곡 반복 켜짐)';
        break;
      case LoopType.LIST:
        loopStr = '\n*(리스트 반복 켜짐)';
        break;
    }
    const nowPlayingStr = `[${currentSong?.title}](${currentSong?.url})` + loopStr;
    const embedMessage = new MessageEmbed()
      .setAuthor(`${guildName}의 재생목록`, message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
      .setColor('#FFC0CB')
      .addFields(
        {
          name: '지금 재생 중: ' + conn.joinedVoiceConnection.channel.name,
          value: nowPlayingStr,
          inline: false,
        },
        {
          name: '대기열',
          value: queueData[0] || '없음 (다음 곡 랜덤 재생)',
          inline: false,
        },
      );
    
    if (queueData.length > 1) {
      for (let q of queueData.slice(1)) {
        embedMessage.addField('\u200B', q, false);
      }
    }
  
    return message.channel.send(embedMessage);
  }
  
  private stop(message: Message, delMsgId: string) {
    const voiceState = message.guild.me.voice;
    const voiceChannel = voiceState?.channel;
    // onDisconnect callback will do clear queue
    if (voiceState !== undefined) {
      try {
        voiceChannel.leave();
        if (delMsgId) {
          message.channel.messages.fetch(delMsgId).then(msg => msg.delete());
        }
        return message.channel.send('👋 또 봐요~ 음성채널에 없더라도 명령어로 부르면 달려올게요. 혹시 제가 돌아오지 않는다면 관리자를 불러주세요..!');
      }
      catch (err) {
        console.error(err);
      }
    }
   
  }
  
  private deleteSong(message: Message, conn: BotConnection) {
    const args = message.content.split(' ');
    if (args.length < 2) {
      return message.channel.send('`~d <queue_index>`');
    }
    if (!conn.queue || conn.queue.songs.length <= 1) {
      return message.channel.send('⚠ `대기열이 비었음`');
    }
  
    const index = parseInt(args[1]);
    if (isNaN(index) || index < 1 || index > conn.queue.songs.length) {
      return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
    }
  
    const removedSong = conn.queue.songs.splice(index, 1);
    if (removedSong) {
      message.channel.send(`❎ \`대기열 ${index}번째 삭제: ${removedSong[0]?.title}\``);   
    }
  }
  
  private modifyOrder(message: Message, conn: BotConnection) {
    const args = message.content.split(' ');
    if (args.length < 3) {
      return message.channel.send('`~m <target_index> <new_index>`');
    }
    if (!conn.queue || conn.queue.songs.length <= 1) {
      return message.channel.send('⚠ `대기열이 비었음`');
    }
    const targetIndex = parseInt(args[1]);
    const newIndex = parseInt(args[2]);
    if (isNaN(targetIndex) || isNaN(newIndex)) {
      return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
    }
    if (targetIndex === newIndex) {
      return message.channel.send('⚠ `Ignored: same index`');
    }
    const size = conn.queue.songs.length;
    if (targetIndex < 1 || targetIndex > size || newIndex < 1 || newIndex > size) {
      return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
    }
  
    // shift order
    const targetSong = conn.queue.songs.splice(targetIndex, 1)[0];
    conn.queue.songs.splice(newIndex, 0, targetSong);
    message.channel.send('✅ `순서 변경 완료`');
  }
  
  private async requestStop(message: Message, conn: BotConnection, cfg: Config) {
    const voiceState = message.guild.me.voice;
    const voiceChannel = voiceState?.channel;
    if (!conn.queue || conn.queue.songs.length === 0) {
      return;
      // return message.channel.send("There is no song that I could stop!");
    }
    // if no summoner, channel summoner, moderator or developer, do stop
    if (!conn.channelJoinRequestMember || conn.channelJoinRequestMember?.id === message.member.id
        || checkModeratorRole(message.member, cfg) || checkDeveloperRole(message.member, cfg)) {
      return this.stop(message, null);
    }
    // ignore if user is not in my voice channel
    if (message.member.voice.channel.id !== voiceChannel.id) {
      return;
    }
    // if there are only bot or, bot and user, do stop. 3포함은 과반수때문에 어차피 걸림
    if (voiceChannel.members.size <= 3) {
      return this.stop(message, null);
    }
  
    // 요청한 사람 수가 지금 요청까지 해서 과반수 도달할때, do stop
    const currentJoinedUsers = conn.joinedVoiceConnection.channel.members;
    const minimumAcceptCount = Math.round((currentJoinedUsers.size-1) / 2);  // except bot
    let acceptedVoiceMemberCount = 0;
    conn.leaveRequestList.forEach((req, msgId) => {
      if (req.voiceChannel.id === conn.joinedVoiceConnection.channel.id) {
        acceptedVoiceMemberCount++;
      }
    })
    if (acceptedVoiceMemberCount + 1 >= minimumAcceptCount) {
      return this.stop(message, null);
    }
  
    // request vote
    const embedMessage = new MessageEmbed()
    .setAuthor('중지 요청', message.author.avatarURL())  
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields(
      {
        name: '현재 채널',
        value:  conn.joinedVoiceConnection.channel.name,
        inline: true,
      },
      {
        name: '안내',
        value: '현재 채널의 과반수가 동의해야 합니다.',
        inline: false,
      },
    );  
  
    let msg = await message.channel.send(embedMessage);
    msg.react(this.acceptEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Request message deleted already`);
    });
    msg.react(this.denyEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Request message deleted already`);
    });    
  
    const req = new LeaveRequest();
    req.message = msg;
    req.reqUser = message.member;
    req.voiceChannel = voiceChannel;
  
    conn.leaveRequestList.set(msg.id, req);
  }
  
  private async requestMove(message: Message, conn: BotConnection, cfg: Config) {
    // check DJ Yurika joined voice channel
    if (!conn.joinedVoiceConnection || !conn.queue || conn.queue.songs.length === 0) {
      return;
    }
  
    // check sender joined voice channel
    const userVoiceChannel = message.member.voice.channel;
    if (!userVoiceChannel) {
      // return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');
      return;
    }
  
    // check djyurika and user are in same voice channel
    if (conn.joinedVoiceConnection.channel.id === userVoiceChannel.id) {
      return;
    }
  
    // move if no summoner, summoner's request, or if no one in current voice channel
    if (!conn.channelJoinRequestMember || message.member.id === conn.channelJoinRequestMember?.id
        || conn.joinedVoiceConnection.channel.members.size === 1 || checkModeratorRole(message.member, cfg) || checkDeveloperRole(message.member, cfg)) {
      this.moveVoiceChannel(conn, null, message.member, message.channel, userVoiceChannel);
      return;
    }
  
    const embedMessage = new MessageEmbed()
    .setAuthor('음성채널 이동 요청', message.author.avatarURL())
    .setColor('#39c5bb')
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields(
      {
        name: '현재 채널',
        value:  conn.joinedVoiceConnection.channel.name,
        inline: true,
      },
      {
        name: '요청 채널',
        value: userVoiceChannel.name,
        inline: true,
      },
      {
        name: '안내',
        value: '현재 채널의 과반수가 동의해야 합니다.',
        inline: false,
      },
    );  
  
    let msg = await message.channel.send(embedMessage);
    
    msg.react(this.acceptEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Request message deleted already`);
    });
    msg.react(this.denyEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Request message deleted already`);
    });
  
    const req = new MoveRequest();
    req.message = msg;
    req.reqUser = message.member;
    req.targetChannel = userVoiceChannel;
  
    conn.moveRequestList.set(msg.id, req);
  }
  
  private clearQueue(message: Message, conn: BotConnection) {
    if (!conn.queue || conn.queue.songs.length < 2) return;
  
    conn.queue.songs.length = 1;
    message.channel.send('❎ `모든 대기열 삭제 완료`');
  }
  
  private changeVolume(message: Message, conn: BotConnection) {
    if (!conn.joinedVoiceConnection || !conn.joinedVoiceConnection.dispatcher) return;
  
    const args = message.content.split(' ');
    if (args.length < 2) {
      message.channel.send('`~v <0~100> | default | <0~100> default`');
      message.channel.send(`🔊 volume: \`${conn.config.volume}\`/\`100\``);
      return;
    }
  
    const volume = parseInt(args[1])
    if (args[1] === 'default') {
      conn.joinedVoiceConnection.dispatcher.setVolumeLogarithmic(conn.config.volume/100);
      return message.channel.send(`✅ \`Set volume to default ${conn.config.volume}\``);
    }
    else if (isNaN(volume) || volume < 0 || volume > 100) {
      return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
    }
    else {
      conn.joinedVoiceConnection.dispatcher.setVolumeLogarithmic(volume/100);
      if (args[2] === 'default') {  // default update
        conn.config.volume = volume;
        return message.channel.send(`✅ \`Set volume to ${volume} as default\``);
      }
      else {
        return message.channel.send(`✅ \`Set volume to ${volume}\``);
      }
    }
  }
  
  private async loadConfig(message: Message, conn: BotConnection) {
    try {
      const config = await this.db.loadConfig(message.guild.id);
      if (config) {
        conn.config = config;
        console.info(`Load config of ${message.guild.name} from DB successfully`);
      }
      else {
        conn.config = this.defaultConfig;
        this.db.saveConfig(this.defaultConfig);
        console.info(`Load and save default config of ${message.guild.name}`);
      }
      if (message && conn.joinedVoiceConnection) {
        message.channel.send(`✅ \`Default config load success\``);
        // apply to current song playing
        conn.joinedVoiceConnection.dispatcher.setVolumeLogarithmic(conn.config.volume/100);
      }
    }
    catch (err) {
      console.error(err);
      console.error(`Config of ${message.guild.name} load failed`);
      if (message) {
        message.channel.send(`⚠ \`Config load failed\``);
      }
    }
  }
  
  private async saveConfig(message: Message, conn: BotConnection) {
    try {
      this.db.saveConfig(conn.config);
      console.info(`Save config of ${message.guild.name} successfully`);
      if (message) {
        message.channel.send(`✅ \`Config save success\``);
      }
    }
    catch (err) {
      console.error(`Config of ${message.guild.name} save failed`);
      if (message) {
        message.channel.send(`⚠ \`Config save failed\``);
      }
    }
  }
  
  private calculatePing(message: Message) {
    const stamp1 = Date.now();
    message.channel.send('🏓 `Calculating...`').then(msg => {
      const stamp2 = Date.now();

      const receive = stamp1 - message.createdTimestamp;
      const response = msg.createdTimestamp - stamp1;
      const trip = stamp2 - stamp1;
      const total = msg.createdTimestamp - message.createdTimestamp;

      msg.delete();
      const pingMessage = `⏳ receive: \`${receive}ms\` \n`
      + `⌛ response: \`${response}ms\` \n`
      + `⏱ bot message trip: \`${trip}ms\` \n`
      + `💓 ws ping: \`${this.client.ws.ping}ms\` \n`;
      const embedMessage = new MessageEmbed()
        .setTitle('🏓 Ping via message')
        .setDescription(pingMessage)
        .setColor('#ACF6CA');
  
      message.channel.send(embedMessage);
    });
  }
  
  private setLoop(message: Message, conn: BotConnection, type: LoopType) {
    const voiceState = message.guild.me.voice;
    const voiceChannel = voiceState?.channel;
    if (!conn.queue || conn.queue.songs.length === 0) {
      return;
      // return message.channel.send("There is no song that I could stop!");
    }
    // ignore if user is not in my voice channel
    if (message.member.voice.channel?.id !== voiceChannel.id) {
      return;
    }
  
    if (conn.loopFlag === type) {
      conn.loopFlag = LoopType.NONE;
      return message.channel.send('➡ `반복 해제`');
    }
    else {
      conn.loopFlag = type;
      switch (conn.loopFlag) {
        case LoopType.NONE:
          return message.channel.send('➡ `반복 해제`');  // may not reach to this line
  
        case LoopType.SINGLE:
          return message.channel.send('🔂 `한곡 반복 설정`');
    
        case LoopType.LIST:
          return message.channel.send('🔁 `현재 리스트 반복 설정`');
    
        default:
          break;
      }
    }
  }
  
  // --- internal
  
  private onDisconnect(conn: BotConnection) {
    const serverId = conn.joinedVoiceConnection.channel.guild.id;
    const serverName = conn.joinedVoiceConnection.channel.guild.name;
    if (conn.joinedVoiceConnection && conn.joinedVoiceConnection.dispatcher) {
      conn.joinedVoiceConnection.dispatcher.end();
    }
    conn.queue.songs = [];
    conn.joinedVoiceConnection = null;
    conn.channelJoinRequestMember = null;
    conn.recentNowPlayingMessage = null;
    conn.loopFlag = LoopType.NONE;
    conn.skipFlag = false;
    // client.user.setActivity();
    clearInterval(conn.intervalHandler);
    conn.searchResultMsgs.clear();
    conn.moveRequestList.clear();
    conn.leaveRequestList.clear();
    conn.addPlaylistConfirmList.clear();
    if (this.connections.has(serverId)) {
      this.connections.delete(serverId);
    }
    console.log(`[${serverName}] ` + '음성 채널 연결 종료됨');
  }
  
  private resolveSongSource(urlstr: string): SongSource {
    try {
      let url = new URL(urlstr);
  
      switch (url.host) {
        case 'www.youtube.com':
        case 'youtube.com':
        case 'm.youtube.com':
        case 'www.youtu.be':
        case 'youtu.be':
          return SongSource.YOUTUBE;
        
        case 'soundcloud.app.goo.gl':
        case 'soundcloud.com':
        case 'www.soundcloud.com':
        case 'm.soundcloud.com':
          return SongSource.SOUNDCLOUD;
    
        default:
          return SongSource.NONE;
      }
    } catch (err: any) {
      console.log('URL parse failed - ' + err.message);
    }
    return SongSource.NONE;
  }
  
  private async addToPlaylist(song: Song, conn: BotConnection) {
    const guild = conn.joinedVoiceConnection.channel.guild;  // voice connection 전제상황
    console.log(`[${guild.name}] ` + '대기열 전송 중...'); // 음성연결 된 상황이 전제
    conn.queue.songs.push(song);
  
    // db check
    const exist = await this.db.checkSongRegistered(song, guild.id);
    if (!exist) {
      await this.db.addSong(song, guild.id); // include incresing pick count
      console.log(`[${guild.name}] Add song to DB: ${song.id}`);  
    }
    else {
      this.db.increasePickCount(song, guild.id);
    }
  }
  
  private async addSongListToPlaylist(songs: Song[], conn: BotConnection) {
    const guild = conn.joinedVoiceConnection.channel.guild;  // voice connection 전제상황
    console.log(`[${conn.joinedVoiceConnection.channel.guild.name}] ` + '대기열 전송 중...'); // 음성연결 된 상황이 전제
    let dbAddedSongsStr = '';
    let dbAddedSongsCnt = 0;
    for (const song of songs) {
      conn.queue.songs.push(song);
      // db check
      const exist = await this.db.checkSongRegistered(song, guild.id);
      if (!exist) {
        await this.db.addSong(song, guild.id); // include incresing pick count
        dbAddedSongsStr += `${song.id} `;
        ++dbAddedSongsCnt;
      }
      else {
        this.db.increasePickCount(song, guild.id);
      }
    }
    if (dbAddedSongsCnt) {
      console.info(`[${guild.name}] Add ${dbAddedSongsCnt} song(s) to DB: ${dbAddedSongsStr}`);
    }
  }
  
  private async play(guild: Guild, song: Song, conn: BotConnection) {  
    // Yurika Random
    if (!song) {
      song = await this.selectRandomSong(guild);
      conn.queue.songs.push(song);
      console.log(`[${guild.name}] ` + `랜덤 선곡: ${song.title} (${song.id})`);
    }
  
    const dispatcher = conn.joinedVoiceConnection;

    try {
      switch (song.source) {
        case SongSource.YOUTUBE:
          dispatcher.play(await ytdl(song.url), { type: 'opus' })
          .on("finish", () => {
            console.log(`[${guild.name}] ` + `재생 끝: ${song.title}`);
            const playedTime = Math.round((Date.now() - conn.songStartTimestamp)/1000);
            if (song.duration > (playedTime + 3) && !conn.skipFlag) { // ignore at most 3sec
              console.warn(`[${guild.name}] ` + `Play finished unexpectedly: ${playedTime}/${song.duration}`);
              (guild.channels.cache.get(this.serverConfigs.get(guild.id).commandChannelID) as TextChannel).send(
                `⚠ Stream finished unexpectedly: \`${playedTime}\` sec out of \`${song.duration}\` sec`
              );
            }
            conn.skipFlag = false;  // reset flag
            conn.recentNowPlayingMessage = null;
            switch (conn.loopFlag) {
              case LoopType.LIST:
                conn.queue.songs.push(conn.queue.songs[0]); // no break here, do shift
                console.info(`[${guild.name}] ` + `리스트 반복 설정 중`);
              case LoopType.NONE:
                conn.queue.songs.shift();
                break;
              
              case LoopType.SINGLE:
                console.info(`[${guild.name}] ` + `한곡 반복 설정 중`);
                break;
            }
            this.play(guild, conn.queue.songs[0], conn);
          })
          .on("error", error => {
            conn.queue.textChannel.send('```cs\n'+
            '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
            `Error: ${error.message}`+
            '```');
            console.error(error);
          })
          .setVolumeLogarithmic(conn.config.volume / 100);
          break;
        case SongSource.SOUNDCLOUD:
          dispatcher.play(await scdl.download(song.url))
          .on("finish", () => {
            console.log(`[${guild.name}] ` + `재생 끝: ${song.title}`);
            const playedTime = Math.round((Date.now() - conn.songStartTimestamp)/1000);
            if (song.duration > (playedTime + 3) && !conn.skipFlag) { // ignore at most 3sec
              console.warn(`[${guild.name}] ` + `Play finished unexpectedly: ${playedTime}/${song.duration}`);
              conn.queue.textChannel.send(
                `⚠ Stream finished unexpectedly: \`${playedTime}\` sec out of \`${song.duration}\` sec`
              );
            }
            conn.skipFlag = false;  // reset flag
            
            conn.recentNowPlayingMessage = null;
            clearInterval(conn.intervalHandler);  // force stop, 비동기라서 명령들이 빠르게 겹치면 인터벌 안죽음
            delete conn.intervalHandler;
            
            switch (conn.loopFlag) {
              case LoopType.LIST:
                conn.queue.songs.push(conn.queue.songs[0]); // no break here, do shift
                console.info(`[${guild.name}] ` + `리스트 반복 설정 중`);
              case LoopType.NONE:
                conn.queue.songs.shift();
                break;
              
              case LoopType.SINGLE:
                console.info(`[${guild.name}] ` + `한곡 반복 설정 중`);
                break;
            }
            this.play(guild, conn.queue.songs[0], conn);
          })
          .on("error", error => {
            conn.queue.textChannel.send('```cs\n'+
            '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
            `Error: ${error.message}`+
            '```');
            console.error(error);
          })
          .setVolumeLogarithmic(conn.config.volume / 100);
          break;
      }
      this.db.increasePlayCount(song, guild.id);
      this.db.fillEmptySongInfo(song);
  
      conn.songStartTimestamp = Date.now();
      console.log(`[${guild.name}] ` + `재생: ${song.title}`);
      // client.user.setActivity(song.title, { type: 'LISTENING' });
      conn.queue.textChannel.send(`🎶 \`재생: ${song.title}\``);
    }
    catch (err: any) {
      console.error(err);
      console.info('Song url was ' + song.url)
      // conn.queue.textChannel.send(`⚠ Error: ${err.message}. Skip \`${song.url}\`.`);
      if (dispatcher) {
        conn.queue.songs.shift();
        this.play(guild, conn.queue.songs[0], conn);
      }
      else {
        console.error('Voice connection dispatcher is gone');
      }
    }
  }
  
  private async selectRandomSong(guild: Guild): Promise<Song> {
    try {
      const randRes = await this.db.getRandomSongID(guild.id);
      try {
        let randSong: videoInfo | TrackInfo;
        let song: Song;
        switch (randRes.source) {
          case SongSource.YOUTUBE:
            if (randRes.url) {
              randSong = await this.getYoutubeVideoInfo(randRes.url);
            }
            else {
              randSong = await this.getYoutubeVideoInfo('https://www.youtube.com/watch?v=' + randRes.id);
            }
            song = new Song(
              randSong.videoDetails.videoId,
              randSong.videoDetails.title,
              randSong.videoDetails.video_url,
              randSong.videoDetails.ownerChannelName,
              randSong.videoDetails.thumbnails.slice(-1)[0].url,
              parseInt(randSong.videoDetails.lengthSeconds),
              this.client.user.id,
              SongSource.YOUTUBE,
            );
            break;
          case SongSource.SOUNDCLOUD:
            if (randRes.url) {
              randSong = await this.getSoundcloudSongInfo(randRes.url);
            }
            else {
              randSong = await this.getSoundcloudSongInfoByID(parseInt(randRes.id));
            }
            song = new Song(
              randSong.id.toString(),
              randSong.title,
              randSong.permalink_url,
              randSong.user.username,
              randSong.artwork_url,
              Math.round(randSong.full_duration / 1000),
              this.client.user.id,
              SongSource.SOUNDCLOUD,
            );
            break;
        }
        return song;
      }
      catch (err) {
        // const errMsg = err.toString().split('\n')[0];
        // console.error(errMsg);
        console.error(err);
        console.error('Song id is: ' + randRes.id);
        console.log('Get another random pick');
        return this.selectRandomSong(guild);
      }
    }
    catch (err) {
      throw err;
    }
  }
  
  private async keywordSearch(message: Message, msgId: string, conn: BotConnection) {
    const keyword = message.content.split(' ').slice(1).join(' ');
    
    let ytRes: YoutubeSearch;
    let scRes: SearchResponseAll;
    try {
      [ytRes, scRes] = await Promise.all([
        getYoutubeSearchList(encodeURIComponent(keyword)),
        this.getSoundcloudSearchList(keyword)
      ]);
    }
    catch (err) {
      const error = JSON.parse(err).error as SearchError;
      console.error(error);
      message.channel.send('```cs\n'+
      '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
      `Error: ${error.code} - ${error.message}`+
      '```');
      return;
    }
  
    const searchResult = new SearchResult();
    searchResult.songUrls = [];
    searchResult.reqUser = message.author;
  
    let fields = [];
    // let description = '';
  
    let indexOffset = 0;
    ytRes.items.map((item, index) => {
      // description += `**${index+1}. [${item.snippet.title}](https://www.youtube.com/watch?v=${item.id.videoId})** (${item.snippet.channelTitle})\n\n`;
      fields.push({ name: `[YT] ${index+1}. ${item.snippet.title}`, value: `${item.snippet.channelTitle} ([see video](https://www.youtube.com/watch?v=${item.id.videoId}))` });
      searchResult.songUrls.push([SongSource.YOUTUBE, `https://www.youtube.com/watch?v=${item.id.videoId}`]);
      indexOffset++;
    });
    scRes.collection.map((item: TrackInfo, index) => {
      fields.push({ name: `[SC] ${indexOffset+index+1}. ${item.title}`, value: `${item.user.username} ([see track](${item.permalink_url}))` });
      searchResult.songUrls.push([SongSource.SOUNDCLOUD, item.permalink_url]);
    });
    
    const embedMessage = new MessageEmbed()
      .setAuthor('DJ Yurika', message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
      .setTitle('Search result [YT: YouTube, SC: SoundCloud]')
      .setDescription(`Requested by <@${message.member.id}>`)
      .setColor('#FFC0CB')
      .addFields(fields);
    
    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    let msg = await message.channel.send(embedMessage);
    searchResult.message = msg;
  
    conn.searchResultMsgs.set(msg.id, searchResult);
  
    for (let index = 0; index < fields.length; index++) {
      msg.react(this.selectionEmojis[index]).catch(err => null);
    }
    msg.react(this.cancelEmoji).catch(err => console.error(`(${err.name}: ${err.message}) - Search message deleted already`));
  }
  
  private async getYoutubePlaylistInfo(url: string) {
    return await ytpl(url);
  }
  
  private async getYoutubeVideoInfo(url: string) {
    return await ytdl.getInfo(url);
  }
  
  private async getSoundcloudSongInfo(url: string) {
    return await scdl.getInfo(url);
  }
  
  private async getSoundcloudSongInfoByID(id: number) {
    return (await scdl.getTrackInfoByID([id]))[0];
  }
  
  private async getSoundcloudPlaylistInfo(url: string) {
    return await scdl.getSetInfo(url);
  }

  private async getSoundcloudSearchList(query: string) {
    return await scdl.search({
      limit: environment.maxSearchResults,
      resourceType: 'tracks',
      query: query,
    });
  }
  
  private async playSoundcloudRequest(conn: BotConnection, message: Message, user: User, url: string, msgId: string) {
    let reqMember = message.guild.members.cache.get(user.id);
    let voiceChannel = message.member.voice.channel;
    // cannot get channel when message passed via reaction, so use below
    if (!voiceChannel) {
      voiceChannel = reqMember.voice.channel;
    }
  
    let songInfo: TrackInfo;
    try {
      songInfo = await this.getSoundcloudSongInfo(url);
    }
    catch (err) {
      const errMsg = err.toString().split('\n')[0];
      console.error(`[${message.guild.name}] ${errMsg}`);
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
      message.channel.send("```cs\n"+
      "# 검색결과가 없습니다.\n"+
      "```");
      return;
    }
  
    // Make song instance
    const song = new Song(
      songInfo.id.toString(),
      songInfo.title,
      songInfo.permalink_url,
      songInfo.user.username,
      songInfo.artwork_url || songInfo.user.avatar_url,
      Math.round(songInfo.full_duration / 1000),
      user.id,
      SongSource.SOUNDCLOUD,
      );
    console.log(`검색된 SoundCloud 영상: ${song.title} (${song.id}) (${song.duration}초)`);
  
    this.playProcess(conn, message, user, song, msgId);
  }
  
  private async playYoutubeRequest(conn: BotConnection, message: Message, user: User, url: string, msgId: string) {
    // get song info
    let songInfo: ytdlc.videoInfo;
    try {
      songInfo = await this.getYoutubeVideoInfo(url);
    }
    catch (err) {
      const errMsg = err.toString().split('\n')[0];
      console.error(`[${message.guild.name}] ${errMsg}`);
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
      message.channel.send("```cs\n"+
      "# 검색결과가 없습니다.\n"+
      "```");
      return;
    }
  
    // Make song instance
    const song = new Song(
      songInfo.videoDetails.videoId,
      songInfo.videoDetails.title,
      songInfo.videoDetails.video_url,
      songInfo.videoDetails.ownerChannelName,
      songInfo.videoDetails.thumbnails.slice(-1)[0].url,
      parseInt(songInfo.videoDetails.lengthSeconds),
      user.id,
      SongSource.YOUTUBE,
      );
    console.log(`검색된 YouTube 영상: ${song.title} (${song.id}) (${song.duration}초)`);
  
    this.playProcess(conn, message, user, song, msgId);
  }
  
  private async playProcess(conn: BotConnection, message: Message, user: User, song: Song, msgId: string) {
    let reqMember = message.guild.members.cache.get(user.id);
    let voiceChannel = message.member.voice.channel;
    // cannot get channel when message passed via reaction, so use below
    if (!voiceChannel) {
      voiceChannel = reqMember.voice.channel;
    }
    
    if (!conn.queue || conn.joinedVoiceConnection === null) {
      conn.queue = new SongQueue(message.channel, []);
  
      try {
        // Voice connection
        console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
        message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
        
        var connection = await voiceChannel.join();
        connection.on('disconnect', () => {
          this.onDisconnect(conn);
        });
        console.info(`[${message.guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${reqMember.displayName})`);
        conn.joinedVoiceConnection = connection;
        conn.channelJoinRequestMember = reqMember;
  
        if (!this.connections.has(message.guild.id)) {
          this.connections.set(message.guild.id, conn);
        }
  
        this.addToPlaylist(song, conn);
        this.play(message.guild, conn.queue.songs[0], conn);
      }
      catch (err) {
        console.log(err);
        conn.queue = null;
        return message.channel.send('```cs\n'+
        '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
        `${err}`+
        '```');
      }
      finally {
        if (msgId) {
          message.channel.messages.fetch(msgId).then(msg => msg.delete());
        }
      }
    } else {
      this.addToPlaylist(song, conn);
  
      // 최초 부른 사용자가 나가면 채워넣기
      if (!conn.channelJoinRequestMember) {
        conn.channelJoinRequestMember = reqMember;
        console.info(`[${message.guild.name}] ` + reqMember.displayName + ' is new summoner');
      }
  
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
      
      if (conn.joinedVoiceConnection.channel.members.size === 1) { // no one
        // if moderator, developer without voice channel, then ignore
        if (reqMember.voice.channel) {
          this.moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
        }
      }
  
      const embedMessage = new MessageEmbed()
      .setAuthor('재생목록 추가', user.avatarURL(), song.url)
      .setColor('#0000ff')
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields(
        {
          name: '음성채널',
          value:  conn.joinedVoiceConnection.channel.name,
          inline: false,
        },
        {
          name: '채널',
          value:  song.channel,
          inline: true,
        },
        {
          name:   '길이',
          value:  `${fillZeroPad(song.durationH, 2)}:${fillZeroPad(song.durationM, 2)}:${fillZeroPad(song.durationS, 2)}`,
          inline: true,
        },
        {
          name:   '대기열',
          value:  conn.queue.songs.length - 1,
          inline: true,
        },
      );
  
      switch (song.source) {
        case SongSource.YOUTUBE:
          embedMessage.setFooter('Youtube', 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png');
          break;
        case SongSource.SOUNDCLOUD:
          embedMessage.setFooter('SoundCloud', 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png');
          break;
      }
    
      message.channel.send(embedMessage);
      
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel && (reqMember.voice.channel?.id !== conn.joinedVoiceConnection.channel.id)) {
        message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
      }
      return;
    }
  }
  
  private async parseSoundcloudPlaylist(conn: BotConnection, message: Message, user: User, url: string, msgId: string) {
    let playlist: SetInfo;
    try {
      playlist = await this.getSoundcloudPlaylistInfo(url);
    }
    catch (err) {
      console.error(`[${message.guild.name}] ${err.message}`);
      message.channel.send(`⚠ \`${err.message}\``);
      console.log(`[${message.guild.name}] Failed parse SoundCloud playlist, try parse as link`)
      this.playSoundcloudRequest(conn, message, user, url, msgId); // pass if parse failed
      return;
    }
  
    if (!playlist) {
      return message.channel.send('```cs\n'+
        '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
        `Error: Parsed playlist is empty`+
        '```');
    }
  
    const embedMessage = new MessageEmbed()
    .setAuthor('사운드클라우드 플레이리스트 감지됨', playlist.user.avatar_url, playlist.permalink_url)
    .setFooter('SoundCloud', 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png')
    .setColor('#FF5500')
    .setThumbnail(playlist.artwork_url ? playlist.artwork_url : playlist.tracks[0].artwork_url)
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields(
      {
        name: '플레이리스트',
        value: (playlist as any).title, // type에 정의 안되어있어서 any강제캐스팅
        inline: false
      },
      {
        name: '채널',
        value: playlist.user.username,
        inline: true
      },
      {
        name: '곡수',
        value: playlist.track_count,
        inline: true
      },
    );
    
    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    const msg = await message.channel.send(embedMessage);
    const confirmList = new AddPlaylistConfirmList();
    confirmList.message = msg;
    confirmList.reqUser = message.member;
    confirmList.playlist = playlist;
    confirmList.provider = SongSource.SOUNDCLOUD;
    conn.addPlaylistConfirmList.set(msg.id, confirmList);
  
    msg.react(this.acceptEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Search message deleted already`);
    });
    msg.react(this.cancelEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Search message deleted already`);
    });
  }
  
  private async parseYoutubePlaylist(conn: BotConnection, message: Message, user: User, url: string, msgId: string) {
    // get playlist info
    let playlist: ytpl.Result;
    try {
      playlist = await this.getYoutubePlaylistInfo(url);
    }
    catch (err) {
      console.error(`[${message.guild.name}] ${err.message}`);
      message.channel.send(`⚠ \`${err.message}\``);
      console.log(`[${message.guild.name}] Failed parse YouTube playlist, try parse as link`)
      this.playYoutubeRequest(conn, message, user, url, msgId); // pass if parse failed
      return;
    }
  
    if (!playlist) {
      return message.channel.send('```cs\n'+
        '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
        `Error: Parsed playlist is empty`+
        '```');
    }
  
    const embedMessage = new MessageEmbed()
    .setAuthor('유튜브 플레이리스트 감지됨', playlist.author?.bestAvatar.url, playlist.url)
    .setFooter('Youtube', 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png')
    .setColor('#FFC0CB')
    .setThumbnail(playlist.bestThumbnail.url)
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields(
      {
        name: '플레이리스트',
        value: playlist.title,
        inline: false
      },
      {
        name: '채널',
        value: playlist.author ? playlist.author.name : playlist.items[0].author.name,
        inline: true
      },
      {
        name: '곡수',
        value: playlist.estimatedItemCount,
        inline: true
      },
    );
    
    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    const msg = await message.channel.send(embedMessage);
    const confirmList = new AddPlaylistConfirmList();
    confirmList.message = msg;
    confirmList.reqUser = message.member;
    confirmList.playlist = playlist;
    confirmList.provider = SongSource.YOUTUBE;
    conn.addPlaylistConfirmList.set(msg.id, confirmList);
  
    msg.react(this.acceptEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Search message deleted already`);
    });
    msg.react(this.cancelEmoji).catch((err) => {
      console.error(`(${err.name}: ${err.message}) - Search message deleted already`);
    });
  }
  
  private async playYoutubeRequestList(conn: BotConnection, message: Message, user: User, playlist: ytpl.Result, msgId: string) {
    let reqMember = message.guild.members.cache.get(user.id);
    let voiceChannel = message.member.voice.channel;
    // cannot get channel when message passed via reaction, so use below
    if (!voiceChannel) {
      voiceChannel = reqMember.voice.channel;
    }
    
    const songs: Song[] = [];
    let totalDuration = 0;
    for (const item of playlist.items) {
      const song = new Song(
        item.id,
        item.title,
        item.shortUrl,
        item.author.name,
        item.bestThumbnail.url,
        item.durationSec,
        user.id,
        SongSource.YOUTUBE,
      );
      totalDuration += item.durationSec;
      songs.push(song);
    }
  
    console.log(`[${message.guild.name}] 플레이리스트 추가: ${playlist.title}(${playlist.author ? playlist.author.name : playlist.items[0].author.name}) - ${playlist.estimatedItemCount}곡`);
  
    if (!conn.queue || conn.joinedVoiceConnection === null) {
      conn.queue = new SongQueue(message.channel, []);
  
      try {
        // Voice connection
        console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
        message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
        
        var connection = await voiceChannel.join();
        connection.on('disconnect', () => {
          this.onDisconnect(conn);
        });
        console.info(`[${message.guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${reqMember.displayName})`);
        conn.joinedVoiceConnection = connection;
        conn.channelJoinRequestMember = reqMember;
  
        if (!this.connections.has(message.guild.id)) {
          this.connections.set(message.guild.id, conn);
        }
  
        await this.addSongListToPlaylist(songs, conn);
  
        // notice multiple song add
        const embedMessage = new MessageEmbed()
        .setAuthor('재생목록 추가', user.avatarURL(), playlist.url)
        .setFooter('Youtube', 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png')
        .setColor('#0000ff')
        .setThumbnail(playlist.bestThumbnail.url)
        .addFields(
          {
            name: '플레이리스트',
            value: playlist.title,
            inline: false
          },
          {
            name: '채널',
            value: playlist.author ? playlist.author.name : playlist.items[0].author.name,
            inline: true
          },
          {
            name: '곡수',
            value: playlist.estimatedItemCount,
            inline: true
          },
          {
            name:   '추가된 시간',
            value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
            inline: true,
          },
        );
        message.channel.send(embedMessage);
  
        this.play(message.guild, conn.queue.songs[0], conn);
      }
      catch (err) {
        console.log(err);
        conn.queue = null;
        return message.channel.send('```cs\n'+
        '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
        `${err}`+
        '```');
      }
      finally {
        message.channel.messages.fetch(msgId).then(msg => msg.delete());
      }
    } else {
      await this.addSongListToPlaylist(songs, conn);
  
      // 최초 부른 사용자가 나가면 채워넣기
      if (!conn.channelJoinRequestMember) {
        conn.channelJoinRequestMember = reqMember;
        console.info(`[${message.guild.name}] ` + reqMember.displayName + ' is new summoner');
      }
  
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
      
      if (conn.joinedVoiceConnection.channel.members.size === 1) { // no one
        // if moderator, developer without voice channel, then ignore
        if (reqMember.voice.channel) {
          this.moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
        }
      }
  
      const embedMessage = new MessageEmbed()
      .setAuthor('재생목록 추가', user.avatarURL(), playlist.url)
      .setFooter('Youtube', 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png')
      .setColor('#0000ff')
      .setThumbnail(playlist.bestThumbnail.url)
      .addFields(
        {
          name: '플레이리스트',
          value: playlist.title,
          inline: false
        },
        {
          name: '채널',
          value: playlist.author ? playlist.author.name : playlist.items[0].author.name,
          inline: true
        },
        {
          name: '곡수',
          value: playlist.estimatedItemCount,
          inline: true
        },
        {
          name:   '추가된 시간',
          value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
          inline: true,
        },
        {
          name:   '대기열 (첫번째 곡)',
          value:  conn.queue.songs.length - playlist.estimatedItemCount,
          inline: true,
        },
      );
    
      message.channel.send(embedMessage);
      
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel && (reqMember.voice.channel?.id !== conn.joinedVoiceConnection.channel.id)) {
        message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
      }
      return;
    }
  }
  
  private async playSoundcloudRequestList(conn: BotConnection, message: Message, user: User, playlist: SetInfo, msgId: string) {
    let reqMember = message.guild.members.cache.get(user.id);
    let voiceChannel = message.member.voice.channel;
    // cannot get channel when message passed via reaction, so use below
    if (!voiceChannel) {
      voiceChannel = reqMember.voice.channel;
    }
    
    const songs: Song[] = [];
    let totalDuration = 0;
    for (const item of playlist.tracks) {
      const song = new Song(
        item.id.toString(),
        item.title,
        item.permalink_url,
        item.user.username,
        item.artwork_url,
        Math.round(item.full_duration / 1000),
        user.id,
        SongSource.SOUNDCLOUD,
      );
      totalDuration += Math.round(item.full_duration / 1000);
      songs.push(song);
    }
  
    console.log(`[${message.guild.name}] 플레이리스트 추가: ${(playlist as any).title}(${playlist.user.username}) - ${playlist.track_count}곡`);
  
    if (!conn.queue || conn.joinedVoiceConnection === null) {
      conn.queue = new SongQueue(message.channel, []);
  
      try {
        // Voice connection
        console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
        message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
        
        var connection = await voiceChannel.join();
        connection.on('disconnect', () => {
          this.onDisconnect(conn);
        });
        console.info(`[${message.guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${reqMember.displayName})`);
        conn.joinedVoiceConnection = connection;
        conn.channelJoinRequestMember = reqMember;
  
        if (!this.connections.has(message.guild.id)) {
          this.connections.set(message.guild.id, conn);
        }
  
        await this.addSongListToPlaylist(songs, conn);
  
        // notice multiple song add
        const embedMessage = new MessageEmbed()
        .setAuthor('재생목록 추가', user.avatarURL(), playlist.permalink_url)
        .setFooter('SoundCloud', 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png')
        .setColor('#0000ff')
        .setThumbnail(playlist.artwork_url ? playlist.artwork_url : playlist.tracks[0].artwork_url)
        .addFields(
          {
            name: '플레이리스트',
            value: (playlist as any).title,
            inline: false
          },
          {
            name: '채널',
            value: playlist.user.username,
            inline: true
          },
          {
            name: '곡수',
            value: playlist.track_count,
            inline: true
          },
          {
            name:   '추가된 시간',
            value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
            inline: true,
          },
        );
        message.channel.send(embedMessage);
  
        this.play(message.guild, conn.queue.songs[0], conn);
      }
      catch (err) {
        console.log(err);
        conn.queue = null;
        return message.channel.send('```cs\n'+
        '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
        `${err}`+
        '```');
      }
      finally {
        message.channel.messages.fetch(msgId).then(msg => msg.delete());
      }
    } else {
      await this.addSongListToPlaylist(songs, conn);
  
      // 최초 부른 사용자가 나가면 채워넣기
      if (!conn.channelJoinRequestMember) {
        conn.channelJoinRequestMember = reqMember;
        console.info(`[${message.guild.name}] ` + reqMember.displayName + ' is new summoner');
      }
  
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
      
      if (conn.joinedVoiceConnection.channel.members.size === 1) { // no one
        // if moderator, developer without voice channel, then ignore
        if (reqMember.voice.channel) {
          this.moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
        }
      }
  
      const embedMessage = new MessageEmbed()
      .setAuthor('재생목록 추가', user.avatarURL(), playlist.permalink_url)
      .setFooter('SoundCloud', 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png')
      .setColor('#0000ff')
      .setThumbnail(playlist.artwork_url)
      .addFields(
        {
          name: '플레이리스트',
          value: (playlist as any).title,
          inline: false
        },
        {
          name: '채널',
          value: playlist.user.username,
          inline: true
        },
        {
          name: '곡수',
          value: playlist.track_count,
          inline: true
        },
        {
          name:   '추가된 시간',
          value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
          inline: true,
        },
        {
          name:   '대기열 (첫번째 곡)',
          value:  conn.queue.songs.length - playlist.track_count,
          inline: true,
        },
      );
    
      message.channel.send(embedMessage);
      
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel && (reqMember.voice.channel?.id !== conn.joinedVoiceConnection.channel.id)) {
        message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
      }
      return;
    }  
  }
  
  private async moveVoiceChannel(conn: BotConnection, message: Message, triggeredMember: GuildMember, commandChannel: TextChannel | DMChannel | NewsChannel, voiceChannel: VoiceChannel) {
    try {
      console.log(`[${message.guild.name}] ` + '음성 채널 이동 중...');
      commandChannel.send(`🔗 \`연결: ${voiceChannel.name}\``);
      var connection = await voiceChannel.join();
      connection.on('disconnect', () => {
        this.onDisconnect(conn);
      });
      console.info(`[${message.guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${triggeredMember.displayName})`);
      conn.joinedVoiceConnection = connection;
      conn.channelJoinRequestMember = triggeredMember;
      // delete message
      if (message) {
        conn.moveRequestList.delete(message.id);
        message.delete();  
      }
    }
    catch (err) {
      console.error(err.message);
      return commandChannel.send('```cs\n'+
      '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
      `${err.message}`+
      '```');
    }
  }
  
  private updateNowPlayingProgrssbar(conn: BotConnection) {
    if (conn.intervalHandler) {
      // double check
      clearInterval(conn.intervalHandler);
      delete conn.intervalHandler;
    }
  
    conn.intervalHandler = setInterval(() => {
      try {
        if (!conn.recentNowPlayingMessage) {
          throw Error('Now playing message ref is changed to null, stop update');
        }
        else {
          const song = conn.queue.songs[0];
          if (!song) throw Error('Song object not defined');  // prevent error
          
          // calculate current playtime. 1/3 scale
          var playtime: number | string = conn.joinedVoiceConnection.dispatcher.streamTime / 1000;
          const currentPoint = Math.round(playtime / song.duration * 100 / 4);
          var playbar: string[] | string = Array(26).fill('▬');
          playbar[currentPoint] = '🔘';
          playbar = playbar.join('');
          var remaintime: number | string = song.duration - playtime;
          if (song.duration >= 3600) {
            playtime = `${Math.trunc(playtime / 3600), 2}:${fillZeroPad(Math.trunc((playtime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(playtime % 60), 2)}`;
            remaintime = `-${Math.trunc(remaintime / 3600), 2}:${fillZeroPad(Math.trunc((remaintime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(remaintime % 60), 2)}`;
          } else {
            playtime = `${fillZeroPad(Math.trunc((playtime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(playtime % 60), 2)}`;
            remaintime = `-${fillZeroPad(Math.trunc((remaintime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(remaintime % 60), 2)}`;
          }
  
          const embedMessage = new MessageEmbed()
          .setAuthor(`${conn.joinedVoiceConnection.channel.name} 에서 재생 중`, this.client.user.avatarURL(), song.url)
          .setColor('#0000ff')
          .setDescription(`[${song.title}](${song.url})`)
          .setThumbnail(song.thumbnail)
          .addFields(
            {
              name: '\u200B', // invisible zero width space
              value:  `**선곡: <@${song.requestUserId}>**\n\n\`${playtime}\` \`${playbar}\` \`${remaintime}\``, // playbar
              inline: false,
            },
            {
              name: '채널',
              value:  song.channel,
              inline: true,
            },
            {
              name:   '길이',
              value:  `${fillZeroPad(song.durationH, 2)}:${fillZeroPad(song.durationM, 2)}:${fillZeroPad(song.durationS, 2)}`,
              inline: true,
            }
          );
  
          switch (song.source) {
            case SongSource.YOUTUBE:
              embedMessage.setFooter('Youtube', 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png');
              break;
            case SongSource.SOUNDCLOUD:
              embedMessage.setFooter('SoundCloud', 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png');
              break;
          }
  
          if (conn.recentNowPlayingMessage.deleted) throw Error('Now playing message is deleted');
          else conn.recentNowPlayingMessage.edit(embedMessage);
        }
      }
      catch (err) {
        // cannot catch DiscordAPIError (api issue)
        console.info(`[${conn.joinedVoiceConnection.channel.guild.name}] ${err.message}`);
        clearInterval(conn.intervalHandler);
        delete conn.intervalHandler;
      }
    }, this.interval);
  }
  

}

export default DJYurika;
