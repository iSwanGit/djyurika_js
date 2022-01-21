import { Client, Collection, CommandInteraction, DMChannel, EmbedFieldData, Guild, GuildMember, GuildMemberRoleManager, Intents, InteractionType, Message, MessageEmbed, MessageReaction, NewsChannel, PartialDMChannel, PartialMessage, Role, TextChannel, ThreadChannel, User, VoiceBasedChannel } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, DiscordGatewayAdapterCreator, VoiceConnectionStatus, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';

import playDl from 'play-dl';
import ytdl from 'ytdl-core-discord';
import ytdlc, { videoInfo } from 'ytdl-core';  // for using type declaration
import ytpl from 'ytpl';
import scdl from 'soundcloud-downloader';
import { SetInfo, TrackInfo } from 'soundcloud-downloader/src/info';
import { SearchResponseAll } from 'soundcloud-downloader/src/search';

import { commands, environment, keys } from './config';
import { AddPlaylistConfirmList, BotConnection, Config, LeaveRequest, LoopType, MoveRequest, PlayHistory, SearchError, SearchResult, Song, SongQueue, SongSource, UpdatedVoiceState, YoutubeSearch } from './types';
import { checkDeveloperRole, checkModeratorRole, fillZeroPad, getYoutubeSearchList } from './util';
import { DJYurikaDB } from './DJYurikaDB';

export class DJYurika {
  private readonly client: Client;
  private readonly rest: REST;
  private readonly db: DJYurikaDB;

  private readonly selectionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  private readonly cancelEmoji = '❌';
  private readonly acceptEmoji = '⭕';
  private readonly denyEmoji = '❌';
  private readonly helpCmd = '`~p`: 노래 검색/재생\n' +
  '`~q`: 대기열 정보\n' +
  '`~np`: 현재 곡 정보\n' +
  '`~s`: 건너뛰기\n' +
  '`~r`: 현재 곡 재시작\n' +
  '`~l`: 채널에서 봇 퇴장\n' + 
  '`~shuffle`: 대기열 뒤섞기\n' + 
  '`~pause`: 곡 일시정지 / 재개\n' + 
  '`~history`: 최근 재생한 곡\n' + 
  '`~loop`: 현재 곡 반복/해제\n' + 
  '`~loopq`: 현재 재생목록 반복/해제\n' + 
  '`~move`: 음성 채널 이동 요청\n' +
  '`~ping`: 지연시간 측정(메시지)\n';
  private readonly helpCmdMod = '`~p`: 노래 검색/재생\n' +
  '`~q`: 대기열 정보\n' +
  '`~np`: 현재 곡 정보\n' +
  '`~s`: 건너뛰기\n' +
  '`~r`: 현재 곡 재시작\n' +
  '`~l`: 채널에서 봇 퇴장\n' + 
  '`~shuffle`: 대기열 뒤섞기\n' + 
  '`~pause`: 곡 일시정지 / 재개\n' + 
  '`~history`: 최근 재생한 곡\n' + 
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
  '`~r`: 현재 곡 재시작\n' +
  '`~l`: 채널에서 봇 퇴장\n' + 
  '`~shuffle`: 대기열 뒤섞기\n' + 
  '`~pause`: 곡 일시정지 / 재개\n' + 
  '`~history`: 최근 재생한 곡\n' + 
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
    this.rest = new REST({ version: '9' }).setToken(keys.botToken);
    this.client = new Client({ intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_INVITES,
      // Intents.FLAGS.GUILD_PRESENCES,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,      
      Intents.FLAGS.GUILD_VOICE_STATES,
    ]});
    // this.client = new Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
    this.defaultConfig = environment.defaultConfig as Config;
    this.serverConfigs = new Map<string, Config>();
    this.overrideConfigs = new Map<string, Config>();
    this.connections = new Map<string, BotConnection>();
    this.interval = environment.refreshInterval;
    this.maxQueueTextRowSize = environment.maxQueueTextRows;

    // playDl.setToken({
    //   soundcloud: {
    //     client_id: keys.soundcloudClientId,
    //   },
    // });
  }

  // ------- Client Initialization -------

  public async start() {
    try {
      this.registerSlashCommandInteraction();
      this.registerConnectionHandler();
      this.registerVoiceStateUpdateHandler();
      this.registerMessageHandler();
      this.registerMessageReactionAddHandler();
      this.registerMessageReactionRemoveHandler();
      this.registerGuildUpdateHandler();
      this.registerGuildJoinHandler();
      
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

  private async refreshSlashCommand() {
    const guilds = this.client.guilds.cache;

    console.log('Start refreshing application (/) commands...');
    
    for (const [id, guild] of guilds) {
      try {
        await this.rest.put(
          Routes.applicationGuildCommands(keys.clientId, id),
          { body: commands }
        );
      }
      catch (err) {
        console.error(`[${guild.name}] ${err}`);
      }
    }
    
    console.log('refresh end');
  }

  private registerSlashCommandInteraction() {
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;
    
      const { commandName } = interaction;

      switch (commandName) {
        case 'help':
          await this.sendHelp(interaction);
          break;
        
        case 'queue':
          await interaction.reply('Server info.');
          break;
      }
    });
  }

  private registerConnectionHandler() {
    this.client.once('ready', async () => {
      this.refreshSlashCommand();
      this.refreshServerName();
      this.client.user.setActivity('Help: ~h', { type: 'PLAYING' })
      setInterval(() => {
        this.client.user.setActivity('Help: ~h', { type: 'PLAYING' })
      }, 3600000);
      console.log('Ready!');
    });
    this.client.once('reconnecting', () => {
      console.log('Reconnecting!');
    });
    this.client.once('disconnect', () => {
      console.log('Disconnect!');
    });
  }

  private registerGuildUpdateHandler() {
    this.client.on('guildUpdate', (oldGuild, newGuild) => {
      // 채널 및 역할 검증
      // 서버 이름 변경 확인
    });
  }

  private registerGuildJoinHandler() {
    this.client.on('guildCreate', guild => {
      console.log('guild add');
      // 서버 추가시 안내할것
      // 명령어채널 및 역할 등록 유도
    });
  }

  private registerMessageHandler() {
    this.client.on('messageCreate', async (message) => {
      // load config
      const cfg = this.overrideConfigs.get(message.guild.id) ?? this.serverConfigs.get(message.guild.id);
      
      // load bot connection
      let conn = this.connections.get(message.guild.id);
      if (!conn) {
        conn = new BotConnection();
        conn.config = cfg;
        this.connections.set(message.guild.id, conn);
      }
    
      if (message.author.bot) return;   // ignore self message
      if (!message.content.startsWith(environment.prefix)) return;  // ignore not including prefix
      if (message.content.startsWith('~~')) return;   // ignore markdown syntax
    
      // ignore messages from another channel
      if (message.channel.id !== cfg?.commandChannelID) return;
    
      // need help?
      const cmd = message.content.split(' ')[0].replace(`${environment.prefix}`, '');
      if (cmd === 'h') {
        this.sendHelp(message);
        return;
      }
    
      // check sender is in voice channel (except moderator and developer)
      const voiceChannel = message.member.voice.channel;
      if (!(checkDeveloperRole(message.member.roles.cache, cfg) || checkModeratorRole(message.member.roles.cache, cfg))) {
        if (!voiceChannel) {
          message.reply('음성 채널에 들어와서 다시 요청해 주세요.');
          return;
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

        case 'r':
        case 'ㄱ':
          this.restartSong(message, conn);
          break;
    
        case 'loop':
          this.setLoop(message, conn, LoopType.SINGLE);
          break;
        
        case 'loopq':
          this.setLoop(message, conn, LoopType.LIST);
          break;
    
        case 'npid':
          if (checkDeveloperRole(message.member.roles.cache, cfg)) {
            if (conn.queue && conn.queue.songs.length > 0) {
              message.channel.send(`🎵 id: \`${conn.queue.songs[0]?.id}\``)
            }
          }
          break;

        case 'shuffle':
          // role check 보류
          this.shuffleQueue(message, conn);
          break;
        
        case 'pause':
          this.pauseAndResume(message, conn);
          break;

        case 'history':
          this.getHistory(message, conn);
          break;
    
        case 'd':
          if (checkModeratorRole(message.member.roles.cache, cfg) || checkDeveloperRole(message.member.roles.cache, cfg)) {
            this.deleteSong(message, conn);
          }
          break;
    
        case 'm':
          if (checkModeratorRole(message.member.roles.cache, cfg) || checkDeveloperRole(message.member.roles.cache, cfg)) {
            this.modifyOrder(message, conn);
          }
          break;
    
        case 'c':
          if (checkModeratorRole(message.member.roles.cache, cfg) || checkDeveloperRole(message.member.roles.cache, cfg)) {
            this.clearQueue(message, conn);
          }
          break;
    
        case 'move':
          this.requestMove(message, conn, cfg);
          break;
    
        case 'v':
          if (checkModeratorRole(message.member.roles.cache, cfg) || checkDeveloperRole(message.member.roles.cache, cfg)) {
            this.changeVolume(message, conn);
          }
          break;
    
        case 'cl':
          if (checkDeveloperRole(message.member.roles.cache, cfg)) {
            this.loadConfig(message, conn);
          }
          break;
    
        case 'cs':
          if (checkDeveloperRole(message.member.roles.cache, cfg)) {
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
      const conn = this.connections.get(reaction.message.guild.id);
      const servOpt = conn.config;
    
      const reactedUser = reaction.message.guild.members.cache.get(user.id);
      var selectedMsg: SearchResult | MoveRequest | LeaveRequest | AddPlaylistConfirmList;
    
      if (!conn) return;  // ignore message which is created before bot is initialized
      // 아무 명령도 받지 않은 초기 상태 && 기존에 쌓인 메시지 인 경우 무시

      if (user.id === this.client.user.id) return; // ignore self reaction
      if (!conn.searchResultMsgs.has(reaction.message.id) && !conn.moveRequestList.has(reaction.message.id) && !conn.leaveRequestList.has(reaction.message.id) && !conn.addPlaylistConfirmList.has(reaction.message.id)) return; // ignore reactions from other messages
    
      // Search result
      selectedMsg = conn.searchResultMsgs.get(reaction.message.id);
      if (selectedMsg) {
        //  except developer or moderator
        if (!(checkDeveloperRole(reactedUser.roles.cache, servOpt) || checkModeratorRole(reactedUser.roles.cache, servOpt))) {
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

        // ignore reaction not provided
        const selected = this.selectionEmojis.indexOf(reaction.emoji.name);
        if (selected < 0 || selected >= environment.maxSearchResults * 2) return;
    
        // check bot or requested user is in voice channel
        const voiceChannel = conn.joinedVoiceChannel ?? reaction.message.guild.members.cache.get(user.id).voice.channel;
        if (!voiceChannel) {
          reaction.message.reply(`<@${user.id}> 재생을 원하는 음성채널에 들어와서 다시 요청해 주세요.`);
          return;
        }

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
    
      // Move request
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
        const currentJoinedUsers = conn.joinedVoiceChannel.members;
        if (reaction.emoji.name === this.acceptEmoji) {
          // check accept emoji only
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
    
      // Leave request
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
        const currentJoinedUsers = conn.joinedVoiceChannel.members;
        if (reaction.emoji.name === this.acceptEmoji) {
          // check accept emoji only
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
            this.stop(reaction.message, reaction.message.id, conn);
          }
        }
        return;
      }
    
      // Add playlist confirm
      selectedMsg = conn.addPlaylistConfirmList.get(reaction.message.id);
      if (selectedMsg) {
    
        //  except developer or moderator
        if (!(checkDeveloperRole(reactedUser.roles.cache, servOpt) || checkModeratorRole(reactedUser.roles.cache, servOpt))) {
          // requested user only
          if (user.id !== selectedMsg.reqUser.id) return;
        }

        // ignore reaction not provided
        if (![this.acceptEmoji, this.denyEmoji].includes(reaction.emoji.name)) return;
      
        // cancel
        if (reaction.emoji.name === this.cancelEmoji) {
          reaction.message.edit('⚠ `추가 취소됨`');
          reaction.message.suppressEmbeds();
          reaction.message.reactions.removeAll();
          conn.searchResultMsgs.delete(reaction.message.id);
          return;
        }
        
        // check requested user is in voice channel
        const voiceChannel = conn.joinedVoiceChannel ?? reaction.message.guild.members.cache.get(user.id).voice.channel;
        if (!voiceChannel) {
          reaction.message.reply(`<@${user.id}> 재생을 원하는 음성채널에 들어와서 다시 요청해 주세요.`);
          return;
        }

        // accept
        if (reaction.emoji.name === this.acceptEmoji) {
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
    
      // nothing of all
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
      
      if (!conn?.joinedVoiceChannel) return;

      // if bot (disconnected by discord(guild admin))
      // 바로 연결끊기 해버린 경우 여기서 잡아내야함
      if (oldState.member.id === this.client.user.id && !newState.channel) {
        // 봇이 나가진 경우
        getVoiceConnection(oldState.guild.id).destroy();
        return;
      }
    
      let state: UpdatedVoiceState;
      // discriminate voice state
      if (oldState.channel?.id === conn.joinedVoiceChannel.id && newState.channel?.id !== conn.joinedVoiceChannel.id) {
        // 나감
        state = UpdatedVoiceState.OUT;
        console.log(`[${oldState.guild.name}] ` + oldState.member.displayName + ' leaved ' + conn.joinedVoiceChannel.name);
        if (oldState.member.id === conn.channelJoinRequestMember?.id) {
          conn.channelJoinRequestMember = null;
          console.info(oldState.member.displayName + ' was summoner');
        }
      }
      else if (!oldState.channel && newState.channel?.id === conn.joinedVoiceChannel.id) {
        state = UpdatedVoiceState.IN;
        console.log(`[${oldState.guild.name}] ` + oldState.member.displayName + ' joined ' + conn.joinedVoiceChannel.name);
      }
      else {
        state = UpdatedVoiceState.NONE;
      }
    
      // vote re-calculate
      const currentJoinedUsers = conn.joinedVoiceChannel.members;
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
        else if (conn.joinedVoiceChannel.id !== req.voiceChannel.id) {
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
            this.stop(req.message, req.message.id, conn);
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

  // TODO: 명령어 분기 함수화
  private commandSwitchHandler(cmd: string) {

  }

  private sendHelp(sourceObj: Message | CommandInteraction) {
    const roles = (sourceObj.member.roles as GuildMemberRoleManager).cache;

    const opt = this.overrideConfigs.get(sourceObj.guildId) ?? this.serverConfigs.get(sourceObj.guildId);
    const cmdName = '명령어';
    let cmdValue: string;
    if (checkDeveloperRole(roles, opt)) {
      cmdValue = this.helpCmdDev;
    }
    else if (checkModeratorRole(roles, opt)) {
      cmdValue = this.helpCmdMod;
    }
    else {
      cmdValue = this.helpCmd;
    }
  
    const embedMessage = new MessageEmbed()
      .setAuthor({
        name: '사용법',
        iconURL: sourceObj.guild.me.user.avatarURL(),
        url: environment.githubRepoUrl
      })
      .setColor('#ffff00')
      .addFields(
        {
          name: cmdName,
          value: cmdValue,
        },
      );
  
      return sourceObj.reply({ embeds: [embedMessage] });
  }

  private async execute(message: Message | PartialMessage, conn: BotConnection) {
    const args = message.content.split(' ');
  
    if (args.length < 2 && conn.joinedVoiceChannel) {
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
      if (!conn.joinedVoiceChannel && !(permissions.has('CONNECT') && permissions.has('SPEAK'))) {
        return message.channel.send('```cs\n'+
        '# Error: 요청 음성채널 권한 없음\n'+
        '```');
      }
    }

    // first ~p, then random pick
    if (args.length === 1 && !conn.joinedVoiceChannel) {
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

  private skip(message: Message | PartialMessage, conn: BotConnection) {
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
    if (conn.joinedVoiceChannel && conn.subscription.player) {
      // conn.subscription.unsubscribe();
      conn.subscription.player.stop();
    }
  }
  
  private async nowPlaying(message: Message | PartialMessage, conn: BotConnection) {
    if (!conn.queue || conn.queue.songs.length === 0 || !conn.joinedVoiceChannel || !conn.subscription?.player) {
      return;
    }
    try {
      const embedMessage = this.createNowPlayingEmbed(conn);
      
      conn.recentNowPlayingMessage = await message.channel.send({ embeds: [embedMessage] });
      this.updateNowPlayingProgrssbar(conn);
    }
    catch (err) {
      message.channel.send(`\`Error: ${err.message}\``);
    }
  }
  
  private async getQueue(message: Message | PartialMessage, conn: BotConnection) {
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
      .setAuthor({
        name: `${guildName}의 재생목록`,
        iconURL: message.guild.me.user.avatarURL(),
        url: message.guild.me.user.avatarURL()
      })
      .setColor('#FFC0CB')
      .addFields(
        {
          name: '지금 재생 중: ' + conn.joinedVoiceChannel.name + (conn.subscription.player.state.status === AudioPlayerStatus.Paused ? ' (일시 정지됨)' : ''),
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
  
    return message.channel.send({ embeds: [embedMessage] });
  }
  
  private stop(message: Message | PartialMessage, delMsgId: string, conn: BotConnection) {
    const voiceState = message.guild.me.voice;
    // onDisconnect callback will do clear queue
    if (voiceState !== undefined) {
      try {
        // conn.subscription.unsubscribe();
        getVoiceConnection(message.guild.id).destroy();
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

  /**
   * 대기열 노래 다시 섞기
   * @param message 
   * @param conn 
   */
  private shuffleQueue(message: Message | PartialMessage, conn: BotConnection) {
    if (!conn.queue || conn.queue.songs.length < 2) return;
  
    const currentSong = conn.queue.songs[0];
    const newQueue = conn.queue.songs.slice(1).sort(() => Math.random() - 0.5);
    conn.queue.songs = [currentSong, ...newQueue];

    message.channel.send('🔀 `대기열 섞기 완료`');
  }

  /**
   * 일시정지 및 재개
   * @param message 
   * @param conn 
   */
  private pauseAndResume(message: Message | PartialMessage, conn: BotConnection) {
    const player = conn.subscription.player;
    if (!player) {
      return message.channel.send('⚠ `재생 중이 아님`');
    }

    switch (player.state.status) {
      case AudioPlayerStatus.Playing:
        player.pause();
        message.channel.send(`⏸ \`일시 정지\``);
        break;
      case AudioPlayerStatus.Paused:
        player.unpause();
        message.channel.send(`▶ \`재생\``);
        break;
    }
  }

  /**
   * 최근 재생한 곡 (음성 채널에 연결한 동안, 최대 5곡으로 제한됨)
   * @param message 
   * @param conn 
   */
  private getHistory(message: Message | PartialMessage, conn: BotConnection) {
    if (!conn.history?.length) {
      return message.channel.send('⚠ `최근 재생한 곡 없음`');
    }
  
    const guildName = message.guild.name;
    let queueData = '';
    
    conn.history.forEach((item, index) => {
      queueData += `-${index+1}. [${item.title}](${item.url})\n`;
    });
    
    const embedMessage = new MessageEmbed()
      .setAuthor({
        name: `${guildName}의 최근 재생 곡`,
        iconURL: message.guild.me.user.avatarURL(),
        url: message.guild.me.user.avatarURL()
      })
      .setColor('#FFC0CB')
      .addField('최근 5곡까지만 표시됩니다.', queueData, false);
      // no title : \u200B
  
    return message.channel.send({ embeds: [embedMessage] });
  }

  
  /**
   * 대기열에서 노래 삭제하는 명령 처리 entrypoint
   * @param message 
   * @param conn 
   * @returns 
   */
  private deleteSong(message: Message | PartialMessage, conn: BotConnection) {
    const args = message.content.split(' ');
    if (args.length < 2) {
      return message.channel.send('`~d <queue_index>` or `~d <index_from>~<index_to>`');
    }
    if (!conn.queue || conn.queue.songs.length <= 1) {
      return message.channel.send('⚠ `대기열이 비었음`');
    }
  
    try {
      let indexFrom: number;
      let indexTo: number;
      
      const rangeArg = args[1].split('~');

      // multiple (not range)
      if (args.length > 2) {
        if (rangeArg.length > 1) {  // range
          message.channel.send('⚠ `index and range (mixed) selection are not supported together`');
          throw Error;
        }

        // remove duplication and parse
        const indexList = [...new Set<number>(args.slice(1).map(v => parseInt(v)))];
        if (indexList.some(v => isNaN(v))) {
          throw Error;
        }
        
        // sort desc
        indexList.sort((a, b) => b - a);

        const result = this.deleteMultiplePick(conn, indexList);
        const length = result.length;
        if (length > 0) {
          return message.channel.send(`❎ \`대기열에서 ${length}곡 삭제: ${result[0]?.title} 외 ${length - 1}곡\``);
        }
        else {
          return message.channel.send('⚠ `곡이 삭제되지 않음`');
        }
      }
      
      // range
      if (rangeArg.length === 2) {
        indexFrom = parseInt(rangeArg[0]);
        indexTo = parseInt(rangeArg[1]);
        
        if (isNaN(indexFrom) || isNaN(indexTo) || indexFrom < 1 || indexFrom > indexTo || indexFrom > conn.queue.songs.length) {
          throw Error;
        }
      }
      // single
      else {
        indexFrom = parseInt(args[1]);
        if (isNaN(indexFrom) || indexFrom < 1 || indexFrom > conn.queue.songs.length) {
          throw Error;
        }
      }

      // range, single 모두 대응
      const removedSong = this.deleteRange(conn, indexFrom, indexTo);
      const length = removedSong.length;
      if (!indexTo || length === 1) {
        message.channel.send(`❎ \`대기열 ${indexFrom}번째 삭제: ${removedSong[0]?.title}\``);   
      }
      else if (length > 1) {
        message.channel.send(`❎ \`대기열 ${indexFrom}~${indexTo}번째 삭제: ${removedSong[0]?.title} 외 ${length - 1}곡\``);   
      }
      else {
        return message.channel.send('⚠ `곡이 삭제되지 않음`');
      }
    }
    catch (e) {
      return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
    }
  }
  
  private modifyOrder(message: Message | PartialMessage, conn: BotConnection) {
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
  
  private async requestStop(message: Message | PartialMessage, conn: BotConnection, cfg: Config) {
    const voiceState = message.guild.me.voice;
    const voiceChannel = voiceState?.channel;
    if (!conn.queue || conn.queue.songs.length === 0) {
      return;
      // return message.channel.send("There is no song that I could stop!");
    }
    // if no summoner, channel summoner, moderator or developer, do stop
    if (!conn.channelJoinRequestMember || conn.channelJoinRequestMember?.id === message.member.id
        || checkModeratorRole(message.member.roles.cache, cfg) || checkDeveloperRole(message.member.roles.cache, cfg)) {
      return this.stop(message, null, conn);
    }
    // ignore if user is not in my voice channel
    if (message.member.voice.channel.id !== voiceChannel.id) {
      return;
    }
    // if there are only bot or, bot and user, do stop. 3포함은 과반수때문에 어차피 걸림
    if (voiceChannel.members.size <= 3) {
      return this.stop(message, null, conn);
    }
  
    // 요청한 사람 수가 지금 요청까지 해서 과반수 도달할때, do stop
    const currentJoinedUsers = conn.joinedVoiceChannel.members;
    const minimumAcceptCount = Math.round((currentJoinedUsers.size-1) / 2);  // except bot
    let acceptedVoiceMemberCount = 0;
    conn.leaveRequestList.forEach((req, msgId) => {
      if (req.voiceChannel.id === conn.joinedVoiceChannel.id) {
        acceptedVoiceMemberCount++;
      }
    })
    if (acceptedVoiceMemberCount + 1 >= minimumAcceptCount) {
      return this.stop(message, null, conn);
    }
  
    // request vote
    const embedMessage = new MessageEmbed()
    .setAuthor({
      name: '중지 요청',
      iconURL: message.author.avatarURL()
    })  
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields(
      {
        name: '현재 채널',
        value:  conn.joinedVoiceChannel.name,
        inline: true,
      },
      {
        name: '안내',
        value: '현재 채널의 과반수가 동의해야 합니다.',
        inline: false,
      },
    );  
  
    let msg = await message.channel.send({ embeds: [embedMessage] });
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

  /**
   * 노래 처음부터 다시 시작하는 명령어 처리 entrypoint
   * @param message 
   * @param conn 
   */
  private restartSong(message: Message | PartialMessage, conn: BotConnection) {    
    if (!conn.queue || conn.queue.songs.length === 0 || !conn.joinedVoiceChannel || !conn.subscription?.player) {
      return;
    }

    const serverName = conn.joinedVoiceChannel.guild.name;

    // same as normal finish(end)
    // 재생위치 컨트롤하는 게 없어서 이어붙이는 것으로
    const song = conn.queue.songs[0];
    console.log(`[${serverName}] ` + `노래 재시작: ${song.title} (${song.id})`);

    conn.skipFlag = true;
    conn.queue.songs.unshift(song);

    // conn.subscription.unsubscribe();
    conn.subscription.player.stop();
  }
  
  private async requestMove(message: Message | PartialMessage, conn: BotConnection, cfg: Config) {
    // check DJ Yurika joined voice channel
    if (!conn.joinedVoiceChannel || !conn.queue || conn.queue.songs.length === 0) {
      return;
    }
  
    // check sender joined voice channel
    const userVoiceChannel = message.member.voice.channel;
    if (!userVoiceChannel) {
      // return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');
      return;
    }
  
    // check djyurika and user are in same voice channel
    if (conn.joinedVoiceChannel.id === userVoiceChannel.id) {
      return;
    }
  
    // move if no summoner, summoner's request, or if no one in current voice channel
    if (!conn.channelJoinRequestMember || message.member.id === conn.channelJoinRequestMember?.id
        || conn.joinedVoiceChannel.members.size === 1 || checkModeratorRole(message.member.roles.cache, cfg) || checkDeveloperRole(message.member.roles.cache, cfg)) {
      this.moveVoiceChannel(conn, null, message.member, message.channel, userVoiceChannel);
      return;
    }
  
    const embedMessage = new MessageEmbed()
    .setAuthor({
      name: '음성채널 이동 요청',
      iconURL: message.author.avatarURL()
    })
    .setColor('#39c5bb')
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields(
      {
        name: '현재 채널',
        value:  conn.joinedVoiceChannel.name,
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
  
    let msg = await message.channel.send({ embeds: [embedMessage] });
    
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
  
  private clearQueue(message: Message | PartialMessage, conn: BotConnection) {
    if (!conn.queue || conn.queue.songs.length < 2) return;
  
    conn.queue.songs.length = 1;
    message.channel.send('❎ `모든 대기열 삭제 완료`');
  }
  
  private changeVolume(message: Message | PartialMessage, conn: BotConnection) {
    if (!conn.joinedVoiceChannel || !conn.subscription?.player) return;
  
    const args = message.content.split(' ');
    if (args.length < 2) {
      message.channel.send('`~v <0~100> | default | <0~100> default`');
      message.channel.send(`🔊 volume: \`${conn.config.volume}\`/\`100\``);
      return;
    }
  
    const volume = parseInt(args[1])
    if (args[1] === 'default') {
      conn.currentAudioResource?.volume.setVolumeLogarithmic(conn.config.volume/100);
      return message.channel.send(`✅ \`Set volume to default ${conn.config.volume}\``);
    }
    else if (isNaN(volume) || volume < 0 || volume > 100) {
      return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
    }
    else {
      conn.currentAudioResource?.volume.setVolumeLogarithmic(volume/100);
      if (args[2] === 'default') {  // default update
        conn.config.volume = volume;
        return message.channel.send(`✅ \`Set volume to ${volume} as default\``);
      }
      else {
        return message.channel.send(`✅ \`Set volume to ${volume}\``);
      }
    }
  }
  
  private async loadConfig(message: Message | PartialMessage, conn: BotConnection) {
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
      if (message) {
        message.channel.send(`✅ \`Default config load success\``);
        // apply to current song playing
        conn.currentAudioResource?.volume.setVolumeLogarithmic(conn.config.volume/100);
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
  
  private async saveConfig(message: Message | PartialMessage, conn: BotConnection) {
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
  
      message.channel.send({ embeds: [embedMessage] });
    });
  }
  
  private setLoop(message: Message | PartialMessage, conn: BotConnection, type: LoopType) {
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
  
  /**
   * 삭제할 대기열 인덱스 (1개 이상 선택)
   * @param conn 
   * @param indexList 
   * @returns 
   */
  private deleteMultiplePick(conn: BotConnection, indexList: number[]) {
    const removedSongs: Song[] = [];
    for (const index of indexList) {
      removedSongs.unshift(...conn.queue.songs.splice(index, 1));
    }

    return removedSongs;
  }

  /**
   * 삭제할 대기열 인덱스 범위 (연속된 범위)
   * @param conn 
   * @param from 
   * @param to 
   * @returns 
   */
  private deleteRange(conn: BotConnection, from: number, to?: number) {
    // include this 'to' index!
    const deleteLength = to ? to - from + 1 : 1;
    return conn.queue.songs.splice(from, deleteLength);
  }
  
  private onDisconnect(conn: BotConnection) {
    // if (!conn.joinedVoiceChannel) return;
    const serverId = conn.joinedVoiceChannel.guild.id;
    const serverName = conn.joinedVoiceChannel.guild.name;
    if (conn.joinedVoiceChannel && conn.subscription) {
      // conn.subscription.player.stop();
      conn.subscription.unsubscribe();
    }
    conn.queue.songs = [];
    // conn.history = [];
    conn.joinedVoiceChannel = null;
    conn.subscription = null;
    conn.currentAudioResource = null;
    conn.channelJoinRequestMember = null;
    conn.recentNowPlayingMessage = null;
    conn.loopFlag = LoopType.NONE;
    conn.skipFlag = false;
    // client.user.setActivity();
    clearInterval(conn.npMsgIntervalHandler);
    conn.playTimeCounter = 0;
    clearInterval(conn.playTimeCounterHandler);
    conn.searchResultMsgs.clear();
    conn.moveRequestList.clear();
    conn.leaveRequestList.clear();
    conn.addPlaylistConfirmList.clear();
    // if (this.connections.has(serverId)) {
    //   this.connections.delete(serverId);
    // }
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
        case 'music.youtube.com':
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
    const guild = conn.joinedVoiceChannel.guild;  // voice connection 전제상황
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
    const guild = conn.joinedVoiceChannel.guild;  // voice connection 전제상황
    console.log(`[${conn.joinedVoiceChannel.guild.name}] ` + '대기열 전송 중...'); // 음성연결 된 상황이 전제
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
  
    const voiceConnection = getVoiceConnection(guild.id);
    const subscription = conn.subscription?.player ? conn.subscription : voiceConnection?.subscribe(createAudioPlayer({
      // behaviors: {
      //   noSubscriber: NoSubscriberBehavior.Stop
      // }
    }));
    if (!conn.subscription) {
      conn.subscription = subscription;
    }

    try {
      // use new module play-dl
      // if (playDl.is_expired()) await playDl.refreshToken();  // only works with spotify??

      switch (song.source) {
        case SongSource.YOUTUBE:
          const stream = await playDl.stream(song.url);  // my soundcloud client_id expired...
          conn.currentAudioResource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
          break;
        
        case SongSource.SOUNDCLOUD:
          conn.currentAudioResource = createAudioResource(await scdl.download(song.url), { inlineVolume: true });
          break;
      }

      conn.currentAudioResource.volume.setVolumeLogarithmic(conn.config.volume / 100);

      // play
      conn.playTimeCounter = 0;
      subscription.player.play(conn.currentAudioResource);

      // register eventListener
      // newState 상태에 대한 이벤트임
      subscription.player.once(AudioPlayerStatus.Playing, (oldState, newState) => {
        // 재생 시작 -> buffering, playing
        console.info(`${oldState.status} -> ${newState.status}`);
        // time counter start
        conn.playTimeCounterHandler = setInterval(() => {
          if (subscription.player.state.status === AudioPlayerStatus.Playing) {
            conn.playTimeCounter += environment.timeCounterTickInterval;
          }
        }, environment.timeCounterTickInterval);
      })
      .once(AudioPlayerStatus.Idle, async (oldState, newState) => {
        // 재생 끝: playing -> idle
        console.info(`${oldState.status} -> ${newState.status}`);
        console.log(`[${guild.name}] ` + `재생 끝: ${song.title}`);
        
        // const playedTime = Math.round((Date.now() - conn.songStartTimestamp)/1000);
        // 재생시각 카운터 멈추고 시간 구하기
        clearInterval(conn.playTimeCounterHandler);
        const playedTime = Math.round(conn.playTimeCounter / 1000);

        if (song.duration > (playedTime + 3) && !conn.skipFlag) { // ignore at most 3sec
          console.warn(`[${guild.name}] ` + `Play finished unexpectedly: ${playedTime}/${song.duration}`);
          (guild.channels.cache.get(conn.config.commandChannelID) as TextChannel).send(
            `⚠ Stream finished unexpectedly: \`${playedTime}\` sec out of \`${song.duration}\` sec`
          );
        }

        // if bot is alone and queue is empty, then stop
        if (conn.joinedVoiceChannel?.members.size === 1 && conn.queue.songs.length === 1) {
          const message = await conn.queue.textChannel.send("앗.. 아무도 없네요 👀💦");
          this.stop(message, null, conn);
          return;
        }

        conn.skipFlag = false;  // reset flag

        conn.recentNowPlayingMessage = null;
        clearInterval(conn.npMsgIntervalHandler);  // force stop, 비동기라서 명령들이 빠르게 겹치면 인터벌 안죽음
        delete conn.npMsgIntervalHandler;
        
        switch (conn.loopFlag) {
          case LoopType.SINGLE:
            console.info(`[${guild.name}] ` + `한곡 반복 설정 중`);
            break;
          
          case LoopType.LIST:
            conn.queue.songs.push(conn.queue.songs[0]);
            console.info(`[${guild.name}] ` + `리스트 반복 설정 중`);
            // no break here, do shift
          case LoopType.NONE:
            this.pushPlayHistory(conn.history, conn.queue.songs[0]);
            conn.queue.songs.shift();
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
      });

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
      if (voiceConnection) {
        conn.queue.songs.shift();
        this.play(guild, conn.queue.songs[0], conn);
      }
      else {
        console.error('Voice connection is gone');
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
            randSong = randSong as videoInfo;
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
            randSong = randSong as TrackInfo;
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
  
  private async keywordSearch(message: Message | PartialMessage, msgId: string, conn: BotConnection) {
    const keyword = message.content.split(' ').slice(1).join(' ');

    // play-dl only supports searching via youtube....
    // 유튜브 검색만 됨.. 검색기능은 보류
    // Spotify 재생은 곡정보만 가져오나봄

    // const res = await playDl.search(keyword, {
    //   source: {
    //     youtube: 'video',
    //     // soundcloud: 'tracks',
    //     // spotify: 'track',
    //   },
    //   limit: 10,
    // });
    
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
      .setAuthor({
        name: 'DJ Yurika',
        iconURL: message.guild.me.user.avatarURL(),
        url: message.guild.me.user.avatarURL()
      })
      .setTitle('Search result [YT: YouTube, SC: SoundCloud]')
      .setDescription(`Requested by <@${message.member.id}>`)
      .setColor('#FFC0CB')
      .addFields(fields);
    
    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    let msg = await message.channel.send({ embeds: [embedMessage] });
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
  
  private async playSoundcloudRequest(conn: BotConnection, message: Message | PartialMessage, user: User, url: string, msgId: string) {
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
  
  private async playYoutubeRequest(conn: BotConnection, message: Message | PartialMessage, user: User, url: string, msgId: string) {
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
  
  private async playProcess(conn: BotConnection, message: Message | PartialMessage, user: User, song: Song, msgId: string) {
    const reqMember = message.guild.members.cache.get(user.id);
    // cannot get channel when message passed via reaction, so use reqMember
    let voiceChannel = message.member.voice.channel ?? reqMember.voice.channel;
    
    if (!conn.queue || conn.joinedVoiceChannel === null) {
      conn.queue = new SongQueue(message.channel, []);
  
      try {
        // Voice connection
        console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
        message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
        
        this.connectVoice(message.guild, voiceChannel, conn, reqMember);
        conn.joinedVoiceChannel = voiceChannel;
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
      
      if (conn.joinedVoiceChannel.members.size === 1) { // no one
        // if moderator, developer without voice channel, then ignore
        if (reqMember.voice.channel) {
          this.moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
        }
      }

      const embedMessage = new MessageEmbed()
      .setAuthor({
        name: '재생목록 추가',
        iconURL: user.avatarURL(),
        url: song.url
      })
      .setColor('#0000ff')
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields([
        {
          name: '음성채널',
          value:  conn.joinedVoiceChannel.name,
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
          value:  (conn.queue.songs.length - 1).toString(),
          inline: true,
        },
      ] as EmbedFieldData[]);
  
      switch (song.source) {
        case SongSource.YOUTUBE:
          embedMessage.setFooter({
            text: 'Youtube',
            iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png',
          });
          break;
        case SongSource.SOUNDCLOUD:
          embedMessage.setFooter({
            text: 'SoundCloud',
            iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png',
          });
          break;
      }
    
      message.channel.send({ embeds: [embedMessage] });
      
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel && (reqMember.voice.channel?.id !== conn.joinedVoiceChannel.id)) {
        message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
      }
      return;
    }
  }
  
  private async parseSoundcloudPlaylist(conn: BotConnection, message: Message | PartialMessage, user: User, url: string, msgId: string) {
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
    .setAuthor({
      name: '사운드클라우드 플레이리스트 감지됨',
      iconURL: playlist.user.avatar_url,
      url: playlist.permalink_url
    })
    .setFooter({
      text: 'SoundCloud',
      iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png'
    })
    .setColor('#FF5500')
    .setThumbnail(playlist.artwork_url ? playlist.artwork_url : playlist.tracks[0].artwork_url)
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields([
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
        value: playlist.track_count.toString(),
        inline: true
      },
    ] as EmbedFieldData[]);
    
    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    const msg = await message.channel.send({ embeds: [embedMessage] });
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
  
  private async parseYoutubePlaylist(conn: BotConnection, message: Message | PartialMessage, user: User, url: string, msgId: string) {
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
    .setAuthor({
      name: '유튜브 플레이리스트 감지됨',
      iconURL: playlist.author?.bestAvatar.url,
      url: playlist.url
    })
    .setFooter({
      text: 'Youtube', 
      iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png'
    })
    .setColor('#FFC0CB')
    .setThumbnail(playlist.bestThumbnail.url)
    .setDescription(`Requested by <@${message.member.id}>`)
    .addFields([
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
        value: playlist.estimatedItemCount.toString(),
        inline: true
      },
    ] as EmbedFieldData[]);
    
    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    const msg = await message.channel.send({ embeds: [embedMessage] });
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
  
  private async playYoutubeRequestList(conn: BotConnection, message: Message | PartialMessage, user: User, playlist: ytpl.Result, msgId: string) {
    const reqMember = message.guild.members.cache.get(user.id);
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
  
    if (!conn.queue || conn.joinedVoiceChannel === null) {
      conn.queue = new SongQueue(message.channel, []);
  
      try {
        // Voice connection
        console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
        message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
        
        this.connectVoice(message.guild, voiceChannel, conn, reqMember);

        conn.joinedVoiceChannel = voiceChannel;
        conn.channelJoinRequestMember = reqMember;
  
        if (!this.connections.has(message.guild.id)) {
          this.connections.set(message.guild.id, conn);
        }
  
        await this.addSongListToPlaylist(songs, conn);
  
        // notice multiple song add
        const embedMessage = new MessageEmbed()
        .setAuthor({
          name: '재생목록 추가',
          iconURL: user.avatarURL(),
          url: playlist.url
        })
        .setFooter({
          text: 'Youtube', 
          iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png'
        })
        .setColor('#0000ff')
        .setThumbnail(playlist.bestThumbnail.url)
        .addFields([
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
            value: playlist.estimatedItemCount.toString(),
            inline: true
          },
          {
            name:   '추가된 시간',
            value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
            inline: true,
          },
        ] as EmbedFieldData[]);
        message.channel.send({ embeds: [embedMessage] });
  
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
      
      if (conn.joinedVoiceChannel.members.size === 1) { // no one
        // if moderator, developer without voice channel, then ignore
        if (reqMember.voice.channel) {
          this.moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
        }
      }
  
      const embedMessage = new MessageEmbed()
      .setAuthor({
        name: '재생목록 추가',
        iconURL: user.avatarURL(),
        url: playlist.url
      })
      .setFooter({
        text: 'Youtube', 
        iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png'
      })
      .setColor('#0000ff')
      .setThumbnail(playlist.bestThumbnail.url)
      .addFields([
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
          value: playlist.estimatedItemCount.toString(),
          inline: true
        },
        {
          name:   '추가된 시간',
          value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
          inline: true,
        },
        {
          name:   '대기열 (첫번째 곡)',
          value:  (conn.queue.songs.length - playlist.estimatedItemCount).toString(),
          inline: true,
        },
      ] as EmbedFieldData[]);
    
      message.channel.send({ embeds: [embedMessage] });
      
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel && (reqMember.voice.channel?.id !== conn.joinedVoiceChannel.id)) {
        message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
      }
      return;
    }
  }
  
  private async playSoundcloudRequestList(conn: BotConnection, message: Message | PartialMessage, user: User, playlist: SetInfo, msgId: string) {
    const reqMember = message.guild.members.cache.get(user.id);
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
  
    if (!conn.queue || conn.joinedVoiceChannel === null) {
      conn.queue = new SongQueue(message.channel, []);
  
      try {
        // Voice connection
        console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
        message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
        
        this.connectVoice(message.guild, voiceChannel, conn, reqMember);

        conn.joinedVoiceChannel = voiceChannel;
        conn.channelJoinRequestMember = reqMember;
  
        if (!this.connections.has(message.guild.id)) {
          this.connections.set(message.guild.id, conn);
        }
  
        await this.addSongListToPlaylist(songs, conn);
  
        // notice multiple song add
        const embedMessage = new MessageEmbed()
        .setAuthor({
          name: '재생목록 추가',
          iconURL: user.avatarURL(),
          url: playlist.permalink_url
        })
        .setFooter({
          text: 'SoundCloud',
          iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png'
        })
        .setColor('#0000ff')
        .setThumbnail(playlist.artwork_url ? playlist.artwork_url : playlist.tracks[0].artwork_url)
        .addFields([
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
            value: playlist.track_count.toString(),
            inline: true
          },
          {
            name:   '추가된 시간',
            value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
            inline: true,
          },
        ] as EmbedFieldData[]);
        message.channel.send({ embeds: [embedMessage] });
  
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
      
      if (conn.joinedVoiceChannel.members.size === 1) { // no one
        // if moderator, developer without voice channel, then ignore
        if (reqMember.voice.channel) {
          this.moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
        }
      }
  
      const embedMessage = new MessageEmbed()
      .setAuthor({
        name: '재생목록 추가',
        iconURL: user.avatarURL(),
        url: playlist.permalink_url
      })
      .setFooter({
        text: 'SoundCloud',
        iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png'
      })
      .setColor('#0000ff')
      .setThumbnail(playlist.artwork_url)
      .addFields([
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
          value: playlist.track_count.toString(),
          inline: true
        },
        {
          name:   '추가된 시간',
          value:  `${fillZeroPad(Math.trunc(totalDuration / 3600), 2)}:${fillZeroPad(Math.trunc((totalDuration % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(totalDuration % 60), 2)}`,
          inline: true,
        },
        {
          name:   '대기열 (첫번째 곡)',
          value:  (conn.queue.songs.length - playlist.track_count).toString(),
          inline: true,
        },
      ] as EmbedFieldData[]);
    
      message.channel.send({ embeds: [embedMessage] });
      
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel && (reqMember.voice.channel?.id !== conn.joinedVoiceChannel.id)) {
        message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
      }
      return;
    }  
  }
  
  private async moveVoiceChannel(conn: BotConnection, message: Message | PartialMessage, triggeredMember: GuildMember, commandChannel: DMChannel | PartialDMChannel | NewsChannel | TextChannel | ThreadChannel, voiceChannel: VoiceBasedChannel) {
    try {
      console.log(`[${voiceChannel.guild.name}] ` + '음성 채널 이동 중...');
      commandChannel.send(`🔗 \`연결: ${voiceChannel.name}\``);

      // change channel
      await voiceChannel.guild.me.voice.setChannel(voiceChannel);
      console.info(`[${voiceChannel.guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${triggeredMember.displayName})`);

      conn.joinedVoiceChannel = voiceChannel;
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
    if (conn.npMsgIntervalHandler) {
      // double check
      clearInterval(conn.npMsgIntervalHandler);
      delete conn.npMsgIntervalHandler;
    }
  
    conn.npMsgIntervalHandler = setInterval(() => {
      try {
        if (!conn.recentNowPlayingMessage) {
          throw Error('Now playing message ref is changed to null, stop update');
        }
        else {
          try {
            const embedMessage = this.createNowPlayingEmbed(conn);
            
            if (conn.recentNowPlayingMessage.editable) {
              conn.recentNowPlayingMessage.edit({ embeds: [embedMessage] });
            }
            else throw Error('Now playing message is deleted');
          }
          catch (err) {
            conn.recentNowPlayingMessage.channel.send(`\`Error: ${err.message}\``);
          }
        }
      }
      catch (err) {
        // cannot catch DiscordAPIError (api issue)
        console.info(`[${conn.joinedVoiceChannel.guild.name}] ${err.message}`);
        clearInterval(conn.npMsgIntervalHandler);
        delete conn.npMsgIntervalHandler;
      }
    }, this.interval);
  }

  /**
   * 최근 플레이 리스트에 추가
   * @param history 
   * @param song 
   */
  private pushPlayHistory(history: PlayHistory[], song: Song) {
    // history, 최근순
    history.unshift({
      title: song.title,
      url: song.url,
    });
    // length limit
    if (history.length > 5) {
      history.length = 5;
    }
  }

  /**
   * 음성 채널 연결 (커넥션 수립)
   * @param guild 
   * @param voiceChannel 
   * @param conn 
   * @returns voice connection object
   */
  private connectVoice(guild: Guild, voiceChannel: VoiceBasedChannel, conn: BotConnection, reqMember: GuildMember) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      // .d.ts type issue
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
    });
    
    connection.once(VoiceConnectionStatus.Ready, () => {
      console.info(`[${guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${reqMember.displayName})`);
    })
    .on(VoiceConnectionStatus.Disconnected, (oldState, newState) => {
      // console.log(oldState.status, newState.status);
    })
    .once(VoiceConnectionStatus.Destroyed, (oldState, newState) => {
      this.pushPlayHistory(conn.history, conn.queue.songs[0]);
      this.onDisconnect(conn);
    });

    return connection;
  }

  private createNowPlayingEmbed(conn: BotConnection): MessageEmbed {
    const song = conn.queue.songs[0];
    if (!song) throw Error('song object not defined');  // prevent error
    // calculate current playtime. 1/3 scale

    let playTime: number | string = conn.playTimeCounter / 1000;
    const currentPoint = Math.round(playTime / song.duration * 100 / 4);
    let playBar: string[] | string = Array(26).fill('▬');
    playBar[currentPoint] = '🔘';
    playBar = playBar.join('');
    var remainTime: number | string = song.duration - playTime;
    if (song.duration >= 3600) {
      playTime = `${Math.trunc(playTime / 3600)}:${fillZeroPad(Math.trunc((playTime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(playTime % 60), 2)}`;
      remainTime = `-${Math.trunc(remainTime / 3600)}:${fillZeroPad(Math.trunc((remainTime % 3600) / 60), 2)}:${fillZeroPad(Math.floor(remainTime % 60), 2)}`;
    } else {
      playTime = `${fillZeroPad(Math.trunc((playTime % 3600) / 60), 2)}:${fillZeroPad(Math.trunc(playTime % 60), 2)}`;
      remainTime = `-${fillZeroPad(Math.trunc((remainTime % 3600) / 60), 2)}:${fillZeroPad(Math.floor(remainTime % 60), 2)}`;
    }
  
    const embedMessage = new MessageEmbed()
      .setAuthor({
        name: `${conn.joinedVoiceChannel.name} 에서 재생 중 ${conn.subscription.player.state.status === AudioPlayerStatus.Paused ? '(일시 정지됨)' : ''}`,
        iconURL: this.client.user.avatarURL(),
        url: song.url
      })
      .setColor('#0000ff')
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields(
        {
          name: '\u200B', // invisible zero width space
          // value:  `**선곡: <@${song.requestUserId}>**`, // playbar
          value:  `**선곡: <@${song.requestUserId}>**\n\n\`${playTime}\` \`${playBar}\` \`${remainTime}\``, // playbar
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
        embedMessage.setFooter({
          text: 'Youtube', 
          iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/youtube_social_circle_red.png'
        });
        break;
      case SongSource.SOUNDCLOUD:
        embedMessage.setFooter({
          text: 'SoundCloud',
          iconURL: 'https://discord.hatsunemiku.kr/files/djyurika_icon/soundcloud.png'
        });
        break;
    }

    return embedMessage;
  }

}

export default DJYurika;
