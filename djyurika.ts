import Discord from 'discord.js';
import ytdl from 'ytdl-core-discord';
import ytdlc from 'ytdl-core';  // for using type declaration
import consoleStamp from 'console-stamp';

import { environment, keys } from './config';
import { MoveRequest, SearchError, SearchResult, Song, SongQueue, YoutubeSearch } from './types';
import * as MyUtil from './util';
import DJYurikaDB from './DJYurikaDB';

consoleStamp(console, {
  pattern: 'yyyy/mm/dd HH:MM:ss.l',
});

const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const db = new DJYurikaDB();

const selectionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const cancelEmoji = '❌';
const searchResultMsgs = new Map<string, SearchResult>(); // string: message id
const moveVoteList = new Map<string, MoveRequest>();  // string: message id

var queue: SongQueue;
let joinedVoiceConnection: Discord.VoiceConnection;

// init
client.once('ready', () => {
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
  if (message.author.bot) return;   // ignore self message
  if (!message.content.startsWith(environment.prefix)) return;  // ignore not including prefix

  // ignore messages from another channel
  if (message.channel.id !== environment.commandChannelID) return;

  // check sender is in voice channel (except moderator and developer)
  const voiceChannel = message.member.voice.channel;
  if (!(MyUtil.checkDeveloperRole(message.member) || MyUtil.checkModeratorRole(message.member))) {
    if (!voiceChannel) {
      return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');
    }
  }

  const cmd = message.content.split(' ')[0].replace(`${environment.prefix}`, '');

  switch (cmd) {
    case 'h':
      sendHelp(message);
      break;

    case 'p':
      execute(message);
      break;

    case 'np':
      nowPlaying(message);
      break;

    case 'q':
      getQueue(message);
      break;

    case 's':
      skip(message);
      break;

    case 'l':
      stop(message);
      break;

    case 'npid':
      if (MyUtil.checkDeveloperRole(message.member)) {
        if (queue && queue.songs.length > 0) {
          message.channel.send(`🎵 id: \`${queue.songs[0].id}\``)
        }
      }
      break;

    case 'd':
      if (MyUtil.checkModeratorRole(message.member)) {
        deleteSong(message);
      }
      break;

    case 'm':
      if (MyUtil.checkModeratorRole(message.member)) {
        modifyOrder(message);
      }
      break;

    case 'move':
      message.channel.send('Work in progress');
      break;

    default:
      message.channel.send('사용법: `~h`');
      break;
  }

});

client.on('messageReactionAdd', async (reaction: Discord.MessageReaction, user: Discord.User) => {
  const reactedUser = reaction.message.guild.members.cache.get(user.id);
  
  if (user.id === client.user.id) return; // ignore self reaction
  if (!searchResultMsgs.has(reaction.message.id)) return; // ignore reactions from other messages
  
  const selectedMsg = searchResultMsgs.get(reaction.message.id);
  //  except developer or moderator
  if (!(MyUtil.checkDeveloperRole(reactedUser) || MyUtil.checkModeratorRole(reactedUser))) {
    const voiceChannel = reaction.message.guild.members.cache.get(user.id).voice.channel;
    const allowedVoiceChannel = reaction.message.guild.channels.cache.get(environment.voiceChannelID);
    // requested user only
    if (user.id !== selectedMsg.reqUser.id) return;
    // check requested user is in voice channel
    if (!voiceChannel) {
      reaction.message.reply(`<@${user.id}> \`${allowedVoiceChannel.name}\`로 들어와서 다시 요청해 주세요.`);
      return;
    }
    // ignore messages if sender is not in proper voice channel 
    else if (voiceChannel.id !== environment.voiceChannelID) {
      reaction.message.reply(`<@${user.id}> \`${voiceChannel.name}\` 말고 \`${allowedVoiceChannel.name}\`로 들어와서 다시 요청해 주세요.`);
      return;
    }
  }

  // cancel
  if (reaction.emoji.name === cancelEmoji) {
    reaction.message.delete();
    searchResultMsgs.delete(reaction.message.id);
    return;
  }

  const selected = selectionEmojis.indexOf(reaction.emoji.name);
  const songid = selectedMsg.songIds[selected];
  
  const url = environment.youtubeUrlPrefix + songid;
  playRequest(reaction.message, user, url, reaction.message.id);

  searchResultMsgs.delete(reaction.message.id);
});

client.login(keys.botToken)
  .catch(err => { console.error(err) });


// -------- function definition -------

function sendHelp(message: Discord.Message) {
  const embedMessage = new Discord.MessageEmbed()
    .setAuthor('사용법', message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setColor('#ffff00')
    .setDescription('`~p 음악`: 유튜브에서 영상 재생\n\n' +
    '`~q`: 대기열 정보\n\n' +
    '`~np`: 현재 곡 정보\n\n' +
    '`~s`: 건너뛰기\n\n' +
    '`~l`: 채널에서 봇 퇴장\n\n');

  return message.channel.send(embedMessage);
}

async function execute(message: Discord.Message) {
  const args = message.content.split(' ');

  if (args.length < 2) {
    return message.channel.send('`~p <song_link>` or `~p <exact_keyword>`');
  }

  // check sender is in voice channel
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply('음성 채널에 들어와서 다시 요청해 주세요.');    
  }

  // check permission of voice channel
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!joinedVoiceConnection && !(permissions.has('CONNECT') && permissions.has('SPEAK'))) {
    return message.channel.send('Error: 요청 음성채널 권한 없음');
  }

  const arg = message.content.split(' ').slice(1).join(' ');
  // search (this message will be removed after found)
  let id = (await message.channel.send(`🎵 \`검색 중: ${arg}\``)).id;
  console.log(`검색 중: ${arg}`);

  // determine link or keyword
  let url: URL;
  try {
    url = new URL(arg);
  }
  catch (err) { }

  if (url) { playRequest(message, message.author, args[1], id); }
  else { keywordSearch(message, id); }

}

function skip(message: Discord.Message) {
  if (!message.member.voice.channel)
    return message.channel.send(
      'You have to be in a voice channel to stop the music!'
    );
  if (!queue)
    return message.channel.send('There is no song that I could skip!');
  
  console.log(`건너 뜀: ${queue.songs[0].title}`);
  message.channel.send(`⏭ \`건너뛰기: ${queue.songs[0].title}\``);
  if (joinedVoiceConnection.dispatcher) {
    joinedVoiceConnection.dispatcher.end();
  }
}

function nowPlaying(message: Discord.Message) {
  if (!queue || queue.songs.length === 0 || !queue.playing) {
    return;
  }

  const song = queue.songs[0];
  const embedMessage = new Discord.MessageEmbed()
    .setAuthor('현재 재생 중', message.guild.me.user.avatarURL(), song.url)
    .setFooter('Youtube', 'http://mokky.ipdisk.co.kr:8000/list/HDD1/icon/youtube_logo.png')
    .setColor('#0000ff')
    .setDescription(`[${song.title}](${song.url})`)
    .setThumbnail(song.thumbnail)
    .addFields(
      {
        name: '채널',
        value:  song.channel,
        inline: true,
      },
      {
        name:   '영상 시간',
        value:  `${MyUtil.fillZeroPad(song.durationH, 2)}:${MyUtil.fillZeroPad(song.durationM, 2)}:${MyUtil.fillZeroPad(song.durationS, 2)}`,
        inline: true,
      }
    );
  
  return message.channel.send(embedMessage);
}

function getQueue(message: Discord.Message) {
  if (!queue || queue.songs.length === 0) {
    return;
  }

  const guildName = message.guild.name;
  let queueData = "";
  queue.songs.map((song, index) => {
    queueData += `${index+1}. [${song.title}](${song.url})\n`;
  });

  const embedMessage = new Discord.MessageEmbed()
    .setAuthor(`${guildName}의 재생목록`, message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setFooter('Youtube', 'http://mokky.ipdisk.co.kr:8000/list/HDD1/icon/youtube_logo.png')
    .setColor('#FFC0CB')
    .addFields(
      {
        name: '재생 채널: ' + joinedVoiceConnection.channel.name,
        value: queueData,
      },
    );
  
  return message.channel.send(embedMessage);
}

function stop(message: Discord.Message) {
  const voiceState = message.guild.me.voice;
  const voiceChannel = voiceState?.channel;
  if (!queue) {
    return;
    // return message.channel.send("There is no song that I could stop!");
  }
  // serverQueue.songs = [];
  // if (serverQueue.connection.dispatcher) {
  //   serverQueue.connection.dispatcher.end();
  // }
  //// onDisconnect callback will do this
  if (voiceState !== undefined) {
    try {
      voiceChannel.leave();
      message.channel.send('👋 또 봐요~ 음성채널에 없더라도 명령어로 부르면 달려올게요. 혹시 제가 돌아오지 않는다면 관리자를 불러주세요..!');
    }
    catch (err) {
      console.error(err);
    }
  }
 
}

function deleteSong(message: Discord.Message) {
  const args = message.content.split(' ');
  if (args.length < 2) {
    return message.channel.send('`~d <queue_index>`');
  }
  if (!queue || queue.songs.length === 0) {
    return message.channel.send('대기열이 비었음');
  }
  if (args[1] === '1') {
    return skip(message);    
  }
  const index = parseInt(args[1]);
  if (isNaN(index) || index < 1 || index > queue.songs.length) {
    return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
  }

  const removedSong = queue.songs.splice(index-1, 1);
  message.channel.send(`❎ \`재생목록 ${index}번째 삭제: ${removedSong[0].title}\``);
}

function modifyOrder(message: Discord.Message) {
  const args = message.content.split(' ');
  if (args.length < 3) {
    return message.channel.send('`~m <target_index> <new_index>`');
  }
  if (!queue || queue.songs.length === 0) {
    return message.channel.send('대기열이 비었음');
  }
  const targetIndex = parseInt(args[1]);
  const newIndex = parseInt(args[2]);
  if (isNaN(targetIndex) || isNaN(newIndex)) {
    return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
  }
  if (targetIndex === 1 || newIndex === 1) {
    return message.channel.send('앗 그건 좀... 맨 앞은 이미 재생중인데..');
  }
  if (targetIndex === newIndex) {
    return message.channel.send('`Ignored: same index`');
  }
  const size = queue.songs.length;
  if (targetIndex < 1 || targetIndex > size || newIndex < 1 || newIndex > size) {
    return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
  }

  // shift order
  const targetSong = queue.songs.splice(targetIndex-1, 1)[0];
  queue.songs.splice(newIndex-1, 0, targetSong);
  message.channel.send('✅ `순서 변경 완료`');
}

// --- internal

function onDisconnect() {
  if (joinedVoiceConnection.dispatcher) {
    joinedVoiceConnection.dispatcher.end();
  }
  queue.songs = [];
  joinedVoiceConnection = null;
  console.log('음성 채널 연결 종료됨');
}

async function addToPlaylist(song: Song) {
  console.log('대기열 전송 중...');
  queue.songs.push(song);

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

async function play(guild: Discord.Guild, song: Song) {
  // Yurika Random
  if (!song) {
    song = await selectRandomSong();
    queue.songs.push(song);
    console.log(`랜덤 선곡: ${song.title} (${song.id})`);
  }

  const dispatcher = joinedVoiceConnection
    .play(await ytdl(song.url), { type: 'opus' })
    .on("finish", () => {
      console.log(`재생 끝: ${song.title}`);
      queue.songs.shift();
      play(guild, queue.songs[0]);
    })
    .on("error", error => {
      queue.textChannel.send('```cs\n'+
      '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
      `Error: ${error.message}`+
      '```');
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(queue.volume / 5);

  db.increasePlayCount(song.id);
  db.fillEmptySongInfo(song.id, song.title);

  console.log(`재생: ${song.title}`);
  client.user.setActivity(song.title, { type: 'LISTENING' });
  queue.textChannel.send(`🎶 \`재생: ${song.title}\``);
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

async function keywordSearch(message: Discord.Message, msgId: string) {
  const keyword = message.content.split(' ').slice(1).join(' ');
  // console.log(encodeURIComponent(keyword));
  let res: YoutubeSearch;
  try {
    res = await MyUtil.getYoutubeSearchList(encodeURIComponent(keyword));
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
    .setColor('#FFC0CB')
    .addFields(fields);
    // .setDescription(description);
  
  message.channel.messages.fetch(msgId).then(msg => msg.delete());
  let msg = await message.channel.send(embedMessage);
  searchResult.message = msg;

  searchResultMsgs.set(msg.id, searchResult);

  for (let index = 0; index < fields.length; index++) {
    msg.react(selectionEmojis[index]);
  }
  msg.react(cancelEmoji);

}

async function playRequest(message: Discord.Message, user: Discord.User, url: string, msgId: string) {
  let voiceChannel = message.member.voice.channel;
  // cannot get channel when message passed via reaction, so use below
  if (!voiceChannel) {
    voiceChannel = message.guild.members.cache.get(user.id).voice.channel;
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
    );
  console.log(`검색된 영상: ${song.title} (${song.id}) (${song.duration}초)`);

  if (!queue || joinedVoiceConnection === null) {
    queue = new SongQueue(message.channel, [], 5, true);

    addToPlaylist(song);

    try {
      // Voice connection
      console.log('음성 채널 연결 중...');
      message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
      
      var connection = await voiceChannel.join();
      connection.on('disconnect', () => {
        onDisconnect();
      });
      joinedVoiceConnection = connection;
      play(message.guild, queue.songs[0]);
    }
    catch (err) {
      console.log(err);
      queue = null;
      return message.channel.send(`\`\`\`${err}\`\`\``);
    }
    finally {
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
    }
  } else {
    addToPlaylist(song);

    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    
    const embedMessage = new Discord.MessageEmbed()
    .setAuthor('재생목록 추가', user.avatarURL(), song.url)
    .setFooter('Youtube', 'http://mokky.ipdisk.co.kr:8000/list/HDD1/icon/youtube_logo.png')
    .setColor('#0000ff')
    .setDescription(`[${song.title}](${song.url})`)
    .setThumbnail(song.thumbnail)
    .addFields(
      {
        name: '음성채널',
        value:  joinedVoiceConnection.channel.name,
        inline: false,
      },
      {
        name: '채널',
        value:  song.channel,
        inline: true,
      },
      {
        name:   '영상 시간',
        value:  `${MyUtil.fillZeroPad(song.durationH, 2)}:${MyUtil.fillZeroPad(song.durationM, 2)}:${MyUtil.fillZeroPad(song.durationS, 2)}`,
        inline: true,
      },
      {
        name:   '대기열',
        value:  queue.songs.length,
        inline: true,
      },
    );
  
    message.channel.send(embedMessage);
    if (message.guild.members.cache.get(user.id).voice.channel.id !== joinedVoiceConnection.channel.id) {
      message.channel.send(`<@${user.id}> 음성채널 위치가 다릅니다. 옮기려면 \`~move\` 로 이동 요청하세요.`);
    }
    return;
  }
}