import Discord, { DMChannel, Message, NewsChannel, TextChannel } from 'discord.js';
import ytdl from 'ytdl-core-discord';
import ytdlc from 'ytdl-core';  // for using type declaration
import consoleStamp from 'console-stamp';

import { environment, keys } from './config';
import { BotConnection, Config, LeaveRequest, MoveRequest, SearchError, SearchResult, ServerOption, Song, SongQueue, UpdatedVoiceState, YoutubeSearch } from './types';
import { checkDeveloperRole, checkModeratorRole, fillZeroPad, getYoutubeSearchList } from './util';
import DJYurikaDB from './DJYurikaDB';

consoleStamp(console, {
  pattern: 'yyyy/mm/dd HH:MM:ss.l',
});

const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const db = new DJYurikaDB();
let defaultConfig = environment.defaultConfig as Config;  // default setting for situation that config is not loaded

const selectionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const cancelEmoji = '❌';
const acceptEmoji = '⭕';
const denyEmoji = '❌';
const helpCmd = '`~p 음악`: 유튜브에서 영상 재생\n' +
'`~q`: 대기열 정보\n' +
'`~np`: 현재 곡 정보\n' +
'`~s`: 건너뛰기\n' +
'`~l`: 채널에서 봇 퇴장\n' + 
'`~move`: 음성 채널 이동 요청\n' +
'`~ping`: 지연시간 측정(메시지)\n';
const helpCmdMod = '`~p 음악`: 유튜브에서 영상 재생\n' +
'`~q`: 대기열 정보\n' +
'`~np`: 현재 곡 정보\n' +
'`~s`: 건너뛰기\n' +
'`~l`: 채널에서 봇 퇴장\n' + 
'`~m`: 재생목록 순서 변경\n' + 
'`~d`: 재생목록에서 곡 삭제\n' + 
'`~c`: 재생목록 비우기\n' + 
'`~move`: 음성 채널 이동 요청\n' +
'`~ping`: 지연시간 측정(메시지)\n' +
'`~v`: 음량 조정\n';
const helpCmdDev = '`~p 음악`: 유튜브에서 영상 재생\n' +
'`~q`: 대기열 정보\n' +
'`~np`: 현재 곡 정보\n' +
'`~npid`: 현재 곡 ID\n' + 
'`~s`: 건너뛰기\n' +
'`~l`: 채널에서 봇 퇴장\n' + 
'`~m`: 재생목록 순서 변경\n' + 
'`~d`: 재생목록에서 곡 삭제\n' + 
'`~c`: 재생목록 비우기\n' + 
'`~move`: 음성 채널 이동 요청\n' +
'`~ping`: 지연시간 측정(메시지)\n' +
'`~v`: 음량 조정\n' + 
'`~cl`: 기본 설정값 로드\n' + 
'`~cs`: 설정값 저장\n';

const serverOptions = new Map<string, ServerOption>();
const connections = new Map<string, BotConnection>();
const interval = 13000;

// load server option
environment.serverOptions.forEach(opt => {
  serverOptions.set(opt.serverID, new ServerOption(opt.serverID, opt.developerRoleID, opt.moderatorRoleID, opt.commandChannelID));
});

process.setMaxListeners(0); // release limit (for voicestatechange event handler)

// init
client.once('ready', async () => {
  // TODO: Reset voice state and activity 
  // cannot force remove activity from here
  console.log('Ready!');
});
client.once('reconnecting', () => {
  console.log('Reconnecting!');
});
client.once('disconnect', () => {
  console.log('Disconnect!');
});
// ---

// register handler
client.on('message', async message => {
  const opt = serverOptions.get(message.guild.id);
  let conn = connections.get(message.guild.id);
  if (!conn) {
    conn = new BotConnection();
    connections.set(message.guild.id, conn);
  }

  if (message.author.bot) return;   // ignore self message
  if (!message.content.startsWith(environment.prefix)) return;  // ignore not including prefix

  // ignore messages from another channel
  if (message.channel.id !== opt.commandChannelID) return;

  // need help?
  const cmd = message.content.split(' ')[0].replace(`${environment.prefix}`, '');
  if (cmd === 'h') {
    return sendHelp(message);
  }

  // check sender is in voice channel (except moderator and developer)
  const voiceChannel = message.member.voice.channel;
  if (!(checkDeveloperRole(message.member, opt) || checkModeratorRole(message.member, opt))) {
    if (!voiceChannel) {
      return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');
    }
  }


  switch (cmd) {
    case 'p':
      execute(message, conn);
      break;

    case 'np':
      nowPlaying(message, conn);
      break;

    case 'q':
      getQueue(message, conn);
      break;

    case 's':
      skip(message, conn);
      break;

    case 'l':
      requestStop(message, conn, opt);
      break;

    case 'npid':
      if (checkDeveloperRole(message.member, opt)) {
        if (conn.queue && conn.queue.songs.length > 0) {
          message.channel.send(`🎵 id: \`${conn.queue.songs[0]?.id}\``)
        }
      }
      break;

    case 'd':
      if (checkModeratorRole(message.member, opt) || checkDeveloperRole(message.member, opt)) {
        deleteSong(message, conn);
      }
      break;

    case 'm':
      if (checkModeratorRole(message.member, opt) || checkDeveloperRole(message.member, opt)) {
        modifyOrder(message, conn);
      }
      break;

    case 'c':
      if (checkModeratorRole(message.member, opt) || checkDeveloperRole(message.member, opt)) {
        clearQueue(message, conn);
      }
      break;

    case 'move':
      requestMove(message, conn, opt);
      break;

    case 'v':
      if (checkModeratorRole(message.member, opt) || checkDeveloperRole(message.member, opt)) {
        changeVolume(message, conn);
      }
      break;

    case 'cl':
      if (checkDeveloperRole(message.member, opt)) {
        loadConfig(message, conn);
      }
      break;

    case 'cs':
      if (checkDeveloperRole(message.member, opt)) {
        saveConfig(message, conn);
      }
      break;

    case 'ping':
      calculatePing(message);
      break;

    default:
      message.channel.send('사용법: `~h`');
      break;
  }

});

client.on('messageReactionRemove', async (reaction: Discord.MessageReaction, user: Discord.User) => {
  const conn = connections.get(reaction.message.guild.id);

  var selectedMsg: SearchResult | MoveRequest | LeaveRequest;

  if (user.id === client.user.id) return; // ignore self reaction
  if (!conn.searchResultMsgs.has(reaction.message.id) && !conn.moveRequestList.has(reaction.message.id) && !conn.leaveRequestList.has(reaction.message.id)) return; // ignore reactions from other messages

  // vote re-calculate
  selectedMsg = conn.moveRequestList.get(reaction.message.id);
  if (selectedMsg) {
    if (reaction.emoji.name === acceptEmoji) {
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
    if (reaction.emoji.name === acceptEmoji) {
      // undo vote
      const index = selectedMsg.acceptedMemberIds.indexOf(user.id);
      if (index !== undefined) {
        selectedMsg.acceptedMemberIds.splice(index, 1);
      }
    }
    return;
  }

});

client.on('messageReactionAdd', async (reaction: Discord.MessageReaction, user: Discord.User) => {
  const servOpt = serverOptions.get(reaction.message.guild.id);
  const conn = connections.get(reaction.message.guild.id);

  const reactedUser = reaction.message.guild.members.cache.get(user.id);
  var selectedMsg: SearchResult | MoveRequest | LeaveRequest;

  if (user.id === client.user.id) return; // ignore self reaction
  if (!conn.searchResultMsgs.has(reaction.message.id) && !conn.moveRequestList.has(reaction.message.id) && !conn.leaveRequestList.has(reaction.message.id)) return; // ignore reactions from other messages

  selectedMsg = conn.searchResultMsgs.get(reaction.message.id);
  if (selectedMsg) {
    // music select

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
    if (reaction.emoji.name === cancelEmoji) {
      reaction.message.edit('⚠ `검색 취소됨`');
      reaction.message.suppressEmbeds();
      reaction.message.reactions.removeAll();
      conn.searchResultMsgs.delete(reaction.message.id);
      return;
    }
  
    const selected = selectionEmojis.indexOf(reaction.emoji.name);
    const songid = selectedMsg.songIds[selected];
    
    const url = environment.youtubeUrlPrefix + songid;
    playRequest(conn, reaction.message, user, url, reaction.message.id);
  
    conn.searchResultMsgs.delete(reaction.message.id);
    return;
  }

  selectedMsg = conn.moveRequestList.get(reaction.message.id);
  if (selectedMsg) {
    // channel move vote
    
    // self vote - ok: nothing, deny: cancel
    if (reactedUser.id === selectedMsg.reqUser.id) {
      if (reaction.emoji.name === denyEmoji) {
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
    if (reaction.emoji.name === acceptEmoji) {
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
        moveVoiceChannel(conn, reaction.message, reactedUser, reaction.message.channel, selectedMsg.targetChannel);
      }
    }
    return;
  }
  
  selectedMsg = conn.leaveRequestList.get(reaction.message.id);
  if (selectedMsg) {
    // self vote - ok: **include**, deny: cancel
    if (reactedUser.id === selectedMsg.reqUser.id) {
      if (reaction.emoji.name === denyEmoji) {
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
    if (reaction.emoji.name === acceptEmoji) {
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
        stop(reaction.message, reaction.message.id);
      }
    }
    return;
  }

  // nothing of both
  return;
});

// Event가 발생한 Member의 State
client.on('voiceStateUpdate', (oldState, newState) => {
  const conn = connections.get(oldState.guild.id);
  
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
        moveVoiceChannel(conn, req.message, req.reqUser, req.message.channel, req.targetChannel);
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
        stop(req.message, req.message.id);
        conn.leaveRequestList.clear();
        break;
      }
    }
  }
});

client.login(keys.botToken)
  .catch(err => { console.error(err) });


// -------- function definition -------

function sendHelp(message: Discord.Message) {
  const opt = serverOptions.get(message.guild.id);
  let cmdName: string, cmdValue: string;
  if (checkDeveloperRole(message.member, opt)) {
    cmdName = '명령어 (Developer)';
    cmdValue = helpCmdDev;
  }
  else if (checkModeratorRole(message.member, opt)) {
    cmdName = '명령어 (Moderator)';
    cmdValue = helpCmdMod;
  }
  else {
    cmdName = '명령어';
    cmdValue = helpCmd;
  }

  const embedMessage = new Discord.MessageEmbed()
    .setAuthor('사용법', message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setColor('#ffff00')
    .addFields(
      {
        name: 'Version 2 새 기능',
        value: '1. 특정 음성채널로 소환\n' +
        '2. 키워드 검색\n'
      },
      {
        name: cmdName,
        value: cmdValue,
      },
    );

  return message.channel.send(embedMessage);
}

async function execute(message: Discord.Message, conn: BotConnection) {
  const args = message.content.split(' ');

  if (args.length < 2) {
    return message.channel.send('`~p <song_link>` or `~p <exact_keyword>`');
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

  const arg = message.content.split(' ').slice(1).join(' ');
  // search (this message will be removed after found)
  let id = (await message.channel.send(`🎵 \`검색 중: ${arg}\``)).id;
  console.log(`[${message.guild.name}] ` + `검색 중: ${arg}`);

  // determine link or keyword
  let url: URL;
  try {
    url = new URL(arg);
  }
  catch (err) { }

  if (url) { playRequest(conn, message, message.author, args[1], id); }
  else { keywordSearch(message, id, conn); }

}

function skip(message: Discord.Message, conn: BotConnection) {
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
  if (conn.joinedVoiceConnection && conn.joinedVoiceConnection.dispatcher) {
    conn.joinedVoiceConnection.dispatcher.end();
  }
}

async function nowPlaying(message: Discord.Message, conn: BotConnection) {
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

  const embedMessage = new Discord.MessageEmbed()
    .setAuthor(`${conn.joinedVoiceConnection.channel.name} 에서 재생 중`, message.guild.me.user.avatarURL(), song.url)
    .setFooter('Youtube', 'https://disk.tmi.tips/web_images/youtube_social_circle_red.png')
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
        name:   '영상 시간',
        value:  `${fillZeroPad(song.durationH, 2)}:${fillZeroPad(song.durationM, 2)}:${fillZeroPad(song.durationS, 2)}`,
        inline: true,
      }
    );
  
  conn.recentNowPlayingMessage = await message.channel.send(embedMessage);
  updateNowPlayingProgrssbar(conn);
}

function getQueue(message: Discord.Message, conn: BotConnection) {
  if (!conn.queue || conn.queue.songs.length === 0) {
    return;
  }

  const guildName = message.guild.name;
  let queueData: string[] = [];
  const currentSong = conn.queue.songs[0];
  conn.queue.songs.slice(1).forEach((song, index) => {
    if (!queueData[Math.trunc(index / 10)]) {
      queueData[Math.trunc(index / 10)] = '';
    }
    queueData[Math.trunc(index / 10)] += `${index+1}. [${song?.title}](${song?.url})\n`;
  });

  const embedMessage = new Discord.MessageEmbed()
    .setAuthor(`${guildName}의 재생목록`, message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setFooter('Youtube', 'https://disk.tmi.tips/web_images/youtube_social_circle_red.png')
    .setColor('#FFC0CB')
    .addFields(
      {
        name: '지금 재생 중: ' + conn.joinedVoiceConnection.channel.name,
        value: `[${currentSong?.title}](${currentSong?.url})`,
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

function stop(message: Discord.Message, delMsgId: string) {
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

function deleteSong(message: Discord.Message, conn: BotConnection) {
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

function modifyOrder(message: Discord.Message, conn: BotConnection) {
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

async function requestStop(message: Discord.Message, conn: BotConnection, opt: ServerOption) {
  const voiceState = message.guild.me.voice;
  const voiceChannel = voiceState?.channel;
  if (!conn.queue || conn.queue.songs.length === 0) {
    return;
    // return message.channel.send("There is no song that I could stop!");
  }
  // if no summoner, channel summoner, moderator or developer, do stop
  if (!conn.channelJoinRequestMember || conn.channelJoinRequestMember?.id === message.member.id
      || checkModeratorRole(message.member, opt) || checkDeveloperRole(message.member, opt)) {
    return stop(message, null);
  }
  // ignore if user is not in my voice channel
  if (message.member.voice.channel.id !== voiceChannel.id) {
    return;
  }
  // if there are only bot or, bot and user, do stop. 3포함은 과반수때문에 어차피 걸림
  if (voiceChannel.members.size <= 3) {
    return stop(message, null);
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
    return stop(message, null);
  }

  // request vote
  const embedMessage = new Discord.MessageEmbed()
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
  try {
    if (msg.deleted) throw Error();
    else msg.react(acceptEmoji);
    if (msg.deleted) throw Error();
    else msg.react(denyEmoji);
  }
  catch (err) {
    // const error = err as DiscordAPIError;
    // console.error(`[Error ${error.code}] (HTTP ${error.httpStatus}) ${error.name}: ${error.message}`);
    console.error('Reaction Error: Stop request message deleted already');
  }
  

  const req = new LeaveRequest();
  req.message = msg;
  req.reqUser = message.member;
  req.voiceChannel = voiceChannel;

  conn.leaveRequestList.set(msg.id, req);
}

async function requestMove(message: Discord.Message, conn: BotConnection, opt: ServerOption) {
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
      || conn.joinedVoiceConnection.channel.members.size === 1 || checkModeratorRole(message.member, opt) || checkDeveloperRole(message.member, opt)) {
    moveVoiceChannel(conn, null, message.member, message.channel, userVoiceChannel);
    return;
  }

  const embedMessage = new Discord.MessageEmbed()
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
  try {
    if (msg.deleted) throw Error();
    else msg.react(acceptEmoji);
    if (msg.deleted) throw Error();
    else msg.react(denyEmoji);
  }
  catch (err) {
    // const error = err as DiscordAPIError;
    // console.error(`[Error ${error.code}] (HTTP ${error.httpStatus}) ${error.name}: ${error.message}`);
    console.error('Reaction Error: Move request message deleted already');
  }

  const req = new MoveRequest();
  req.message = msg;
  req.reqUser = message.member;
  req.targetChannel = userVoiceChannel;

  conn.moveRequestList.set(msg.id, req);
}

function clearQueue(message: Message, conn: BotConnection) {
  if (!conn.queue || conn.queue.songs.length < 2) return;

  conn.queue.songs.length = 1;
  message.channel.send('❎ `모든 대기열 삭제 완료`');
}

function changeVolume(message: Message, conn: BotConnection) {
  if (!conn.joinedVoiceConnection || !conn.joinedVoiceConnection.dispatcher) return;

  const args = message.content.split(' ');
  if (args.length < 2) {
    return message.channel.send('`~v <0~100> | default | <0~100> default`');
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

async function loadConfig(message: Message, conn: BotConnection) {
  try {
    const config = await db.loadConfig(message.guild.id);
    if (config) {
      conn.config = config;
      console.info(`Load config of ${message.guild.name} from DB successfully`);
    }
    else {
      conn.config = defaultConfig;
      db.saveConfig(defaultConfig, message.guild.id);
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

async function saveConfig(message: Message, conn: BotConnection) {
  try {
    db.saveConfig(conn.config, message.guild.id);
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

function calculatePing(message: Message) {
  const receiveLatency = Date.now() - message.createdTimestamp;
  
  message.channel.send('🏓 `Calculating...`').then(msg => {
    const totalLatency = msg.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    msg.delete();
    const pingMessage = `⌛ response: \`${totalLatency}ms\` \n`
      + `⏱ receive: \`${receiveLatency}ms\` \n`
      + `💓 API heartbeat: \`${apiLatency}ms\` \n`;
    const embedMessage = new Discord.MessageEmbed()
      .setTitle('🏓 Ping via message')
      .setDescription(pingMessage)
      .setColor('#ACF6CA');

    message.channel.send(embedMessage);
  });
}

// --- internal

function onDisconnect(conn: BotConnection) {
  const serverId = conn.joinedVoiceConnection.channel.guild.id;
  const serverName = conn.joinedVoiceConnection.channel.guild.name;
  if (conn.joinedVoiceConnection && conn.joinedVoiceConnection.dispatcher) {
    conn.joinedVoiceConnection.dispatcher.end();
  }
  conn.queue.songs = [];
  conn.joinedVoiceConnection = null;
  conn.channelJoinRequestMember = null;
  conn.recentNowPlayingMessage = null;
  // client.user.setActivity();
  conn.searchResultMsgs.clear();
  conn.moveRequestList.clear();
  conn.leaveRequestList.clear();
  if (connections.has(serverId)) {
    connections.delete(serverId);
  }
  console.log(`[${serverName}] ` + '음성 채널 연결 종료됨');
}

async function addToPlaylist(song: Song, conn: BotConnection) {
  console.log(`[${conn.joinedVoiceConnection.channel.guild.name}] ` + '대기열 전송 중...'); // 음성연결 된 상황이 전제
  conn.queue.songs.push(song);

  // db check
  const exist = await db.checkSongRegistered(song.id);
  if (!exist) {
    await db.addSong(song); // include incresing pick count
    console.info('Add song to DB: ' + song.id);  
  }
  else {
    db.increasePickCount(song.id);
  }
}

async function getYoutubeSongInfo(url: string) {
  return await ytdl.getInfo(url);
}

async function play(guild: Discord.Guild, song: Song, conn: BotConnection) {  
  // Yurika Random
  if (!song) {
    song = await selectRandomSong();
    conn.queue.songs.push(song);
    console.log(`[${guild.name}] ` + `랜덤 선곡: ${song.title} (${song.id})`);
  }

  const dispatcher = conn.joinedVoiceConnection
    .play(await ytdl(song.url), { type: 'opus' })
    .on("finish", () => {
      console.log(`[${guild.name}] ` + `재생 끝: ${song.title}`);
      const playedTime = Math.round((Date.now() - conn.songStartTimestamp)/1000);
      if (song.duration > playedTime && !conn.skipFlag) {
        console.warn(`[${guild.name}] ` + `Play finished unexpectedly: ${playedTime}/${song.duration}`);
      }
      conn.skipFlag = false;  // reset flag
      conn.recentNowPlayingMessage = null;
      conn.queue.songs.shift();
      play(guild, conn.queue.songs[0], conn);
    })
    .on("error", error => {
      conn.queue.textChannel.send('```cs\n'+
      '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
      `Error: ${error.message}`+
      '```');
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(conn.config.volume / 100);

  db.increasePlayCount(song.id);
  db.fillEmptySongInfo(song.id, song.title);

  conn.songStartTimestamp = Date.now();
  console.log(`[${guild.name}] ` + `재생: ${song.title}`);
  // client.user.setActivity(song.title, { type: 'LISTENING' });
  conn.queue.textChannel.send(`🎶 \`재생: ${song.title}\``);
}

async function selectRandomSong(): Promise<Song> {
  const randId = await db.getRandomSongID();
  try {
    const randSong = await getYoutubeSongInfo('https://www.youtube.com/watch?v=' + randId);
    const song = new Song(
      randSong.videoDetails.videoId,
      randSong.videoDetails.title,
      randSong.videoDetails.video_url,
      randSong.videoDetails.ownerChannelName,
      randSong.videoDetails.thumbnails.slice(-1)[0].url,
      parseInt(randSong.videoDetails.lengthSeconds),
      client.user.id,
    );

    return song;
  }
  catch (err) {
    const errMsg = err.toString().split('\n')[0];
    console.error(errMsg);
    console.error('Song id is: ' + randId);
    console.log('Get another random pick');
    return selectRandomSong();
  }
}

async function keywordSearch(message: Discord.Message, msgId: string, conn: BotConnection) {
  const keyword = message.content.split(' ').slice(1).join(' ');
  // console.log(encodeURIComponent(keyword));
  let res: YoutubeSearch;
  try {
    res = await getYoutubeSearchList(encodeURIComponent(keyword));
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
  searchResult.songIds = [];
  searchResult.reqUser = message.author;

  let fields = [];
  // let description = '';

  res.items.map((item, index) => {
    // description += `**${index+1}. [${item.snippet.title}](https://www.youtube.com/watch?v=${item.id.videoId})** (${item.snippet.channelTitle})\n\n`;
    fields.push({ name: `${index+1}. ${item.snippet.title}`, value: `${item.snippet.channelTitle} ([see video](https://www.youtube.com/watch?v=${item.id.videoId}))` });
    searchResult.songIds.push(item.id.videoId);
  });
  
  const embedMessage = new Discord.MessageEmbed()
    .setAuthor('DJ Yurika', message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setTitle('Search result')
    .setDescription(`Requested by <@${message.member.id}>`)
    .setColor('#FFC0CB')
    .addFields(fields);
  
  message.channel.messages.fetch(msgId).then(msg => msg.delete());
  let msg = await message.channel.send(embedMessage);
  searchResult.message = msg;

  conn.searchResultMsgs.set(msg.id, searchResult);

  try {
    for (let index = 0; index < fields.length; index++) {
      if (msg.deleted) throw Error();
      else msg.react(selectionEmojis[index]);
    }
    if (msg.deleted) throw Error();
    else msg.react(cancelEmoji);
  }
  catch (err) {
    // const error = err as DiscordAPIError;
    // console.error(`[Error ${error.code}] (HTTP ${error.httpStatus}) ${error.name}: ${error.message}`);
    console.error('Reaction Error: Search message deleted already');
  }  

}

async function playRequest(conn: BotConnection, message: Discord.Message, user: Discord.User, url: string, msgId: string) {
  let reqMember = message.guild.members.cache.get(user.id);
  let voiceChannel = message.member.voice.channel;
  // cannot get channel when message passed via reaction, so use below
  if (!voiceChannel) {
    voiceChannel = reqMember.voice.channel;
  }

  // get song info
  let songInfo: ytdlc.videoInfo;
  try {
    songInfo = await getYoutubeSongInfo(url);
  }
  catch (err) {
    const errMsg = err.toString().split('\n')[0];
    console.error(errMsg);
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
    );
  console.log(`검색된 영상: ${song.title} (${song.id}) (${song.duration}초)`);

  if (!conn.queue || conn.joinedVoiceConnection === null) {
    conn.queue = new SongQueue(message.channel, []);


    try {
      // Voice connection
      loadConfig(message, conn);

      console.log(`[${message.guild.name}] ` + '음성 채널 연결 중...');
      message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
      
      var connection = await voiceChannel.join();
      connection.on('disconnect', () => {
        onDisconnect(conn);
      });
      console.info(`[${message.guild.name}] ` + `연결 됨: ${voiceChannel.name} (by ${reqMember.displayName})`);
      conn.joinedVoiceConnection = connection;
      conn.channelJoinRequestMember = reqMember;

      if (!connections.has(message.guild.id)) {
        connections.set(message.guild.id, conn);
      }

      addToPlaylist(song, conn);
      play(message.guild, conn.queue.songs[0], conn);
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
    addToPlaylist(song, conn);

    // 최초 부른 사용자가 나가면 채워넣기
    if (!conn.channelJoinRequestMember) {
      conn.channelJoinRequestMember = reqMember;
      console.info(`[${message.guild.name}] ` + reqMember.displayName + ' is new summoner');
    }

    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    
    if (conn.joinedVoiceConnection.channel.members.size === 1) { // no one
      // if moderator, developer without voice channel, then ignore
      if (reqMember.voice.channel) {
        moveVoiceChannel(conn, null, reqMember, message.channel, reqMember.voice.channel);
      }
    }

    const embedMessage = new Discord.MessageEmbed()
    .setAuthor('재생목록 추가', user.avatarURL(), song.url)
    .setFooter('Youtube', 'https://disk.tmi.tips/web_images/youtube_social_circle_red.png')
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
        name:   '영상 시간',
        value:  `${fillZeroPad(song.durationH, 2)}:${fillZeroPad(song.durationM, 2)}:${fillZeroPad(song.durationS, 2)}`,
        inline: true,
      },
      {
        name:   '대기열',
        value:  conn.queue.songs.length - 1,
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

async function moveVoiceChannel(conn: BotConnection, message: Discord.Message, triggeredMember: Discord.GuildMember, commandChannel: TextChannel | DMChannel | NewsChannel, voiceChannel: Discord.VoiceChannel) {
  try {
    console.log(`[${message.guild.name}] ` + '음성 채널 이동 중...');
    commandChannel.send(`🔗 \`연결: ${voiceChannel.name}\``);
    var connection = await voiceChannel.join();
    connection.on('disconnect', () => {
      onDisconnect(conn);
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

function updateNowPlayingProgrssbar(conn: BotConnection) {
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

        const embedMessage = new Discord.MessageEmbed()
        .setAuthor(`${conn.joinedVoiceConnection.channel.name} 에서 재생 중`, client.user.avatarURL(), song.url)
        .setFooter('Youtube', 'https://disk.tmi.tips/web_images/youtube_social_circle_red.png')
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
            name:   '영상 시간',
            value:  `${fillZeroPad(song.durationH, 2)}:${fillZeroPad(song.durationM, 2)}:${fillZeroPad(song.durationS, 2)}`,
            inline: true,
          }
        );
        if (conn.recentNowPlayingMessage.deleted) throw Error('Now playing message is deleted');
        else conn.recentNowPlayingMessage.edit(embedMessage);
      }
    }
    catch (err) {
      // cannot catch DiscordAPIError (api issue)
      console.error(err.message);
      clearInterval(conn.intervalHandler);
    }
  }, interval);
}
