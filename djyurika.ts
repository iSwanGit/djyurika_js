import Discord from 'discord.js';
import ytdl from 'ytdl-core-discord';
import ytdlc from 'ytdl-core';  // for using type declaration
import consoleStamp from 'console-stamp';

import { environment, keys } from './config';
import { SearchResult, Song, SongQueue } from './types';
import * as MyUtil from './util';
import DJYurikaDB from './DJYurikaDB';

consoleStamp(console, {
  pattern: 'yyyy/mm/dd HH:MM:ss.l',
});

const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const queueSet = new Map<string, SongQueue>();  // song queue for each channel
const searchResultMsgs = new Map<string, SearchResult>();
const selectionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const db = new DJYurikaDB();

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

  // check sender is in voice channel
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return;
  }
  // ignore messages if sender is not in proper voice channel
  if (voiceChannel.id !== environment.voiceChannelID) {
    // const allowedVoiceChannel = message.guild.channels.cache.get(environment.voiceChannelID);
    return;
  }

  const serverQueue = queueSet.get(message.guild.id);

  const cmd = message.content.split(' ')[0].replace(`${environment.prefix}`, '');

  switch (cmd) {
    case 't':
      const keyword = message.content.split(' ').slice(1).join(' ');
      // console.log(encodeURIComponent(keyword));
      const res = await MyUtil.getYoutubeSearchList(encodeURIComponent(keyword));

      const searchResult = new SearchResult();
      searchResult.songIds = [];

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
        
      let msg = await message.channel.send(embedMessage);
      searchResult.message = msg;

      searchResultMsgs.set(msg.id, searchResult);

      for (let index = 0; index < fields.length; index++) {
        msg.react(selectionEmojis[index]);
      }

      break;
    case 'h':
      sendHelp(message);
      break;

    case 'p':
      execute(message, serverQueue);
      break;

    case 'np':
      nowPlaying(message, serverQueue);
      break;

    case 'q':
      getQueue(message, serverQueue);
      break;

    case 's':
      skip(message, serverQueue);
      break;

    case 'l':
      stop(message, serverQueue);
      break;

    case 'npid':
      if (MyUtil.checkDeveloperRole(message.member)) {
        if (serverQueue && serverQueue.songs.length > 0) {
          message.channel.send(`🎵 id: \`${serverQueue.songs[0].id}\``)
        }
      }
      break;

    case 'd':
      if (MyUtil.checkModeratorRole(message.member)) {
        deleteSong(message, serverQueue);
      }
      break;

    case 'm':
      if (MyUtil.checkModeratorRole(message.member)) {
        modifyOrder(message, serverQueue);
      }
      break;

    default:
      message.channel.send('사용법: `~h`');
      break;
  }

});

client.on('messageReactionAdd', async (reaction: Discord.MessageReaction, user: Discord.User) => {
  const serverQueue = queueSet.get(reaction.message.guild.id);
  const reactedUser = reaction.message.guild.members.cache.get(user.id);
  
  if (user.id === client.user.id) return; // ignore self reaction
  if (!searchResultMsgs.has(reaction.message.id)) return; // ignore reactions from other messages
  
  const selectedMsg = searchResultMsgs.get(reaction.message.id);
  // requested only
  if (user.id !== selectedMsg.reqUser.id && !(MyUtil.checkModeratorRole(reactedUser) || MyUtil.checkDeveloperRole(reactedUser))) return;
  
  const selected = selectionEmojis.indexOf(reaction.emoji.name);
  const songid = selectedMsg.songIds[selected];
  
  const url = environment.youtubeUrlPrefix + songid;
  playRequest(reaction.message, user, serverQueue, url, reaction.message.id);

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

async function execute(message: Discord.Message, serverQueue: SongQueue) {
  const args = message.content.split(' ');

  if (args.length < 2) {
    return message.channel.send('`~p <song_link>` or `~p <exact_keyword>`');
  }

  // check sender is in voice channel
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return;
    // return message.channel.send(
    //   "You need to be in a voice channel to play music!"
    // );
  }

  // check permission of voice channel
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
    return message.channel.send(
      `Error: I need the permissions to join and speak in your voice channel!`
    );
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

  if (url) { playRequest(message, message.client.user, serverQueue, args[1], id); }
  else { keywordSearch(message, id); }

}

function skip(message: Discord.Message, serverQueue: SongQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      'You have to be in a voice channel to stop the music!'
    );
  if (!serverQueue)
    return message.channel.send('There is no song that I could skip!');
  
  console.log(`건너 뜀: ${serverQueue.songs[0].title}`);
  message.channel.send(`⏭ \`건너뛰기: ${serverQueue.songs[0].title}\``);
  if (serverQueue.connection.dispatcher) {
    serverQueue.connection.dispatcher.end();
  }
}

function nowPlaying(message: Discord.Message, serverQueue: SongQueue) {
  if (!serverQueue || serverQueue.songs.length === 0 || !serverQueue.playing) {
    return;
  }

  const song = serverQueue.songs[0];
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

function getQueue(message: Discord.Message, serverQueue: SongQueue) {
  if (!serverQueue || serverQueue.songs.length === 0) {
    return;
  }

  const guildName = message.guild.name;
  let queueData = "";
  serverQueue.songs.map((song, index) => {
    queueData += `${index+1}. [${song.title}](${song.url})\n`;
  });

  const embedMessage = new Discord.MessageEmbed()
    .setAuthor(`${guildName}의 재생목록`, message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setFooter('Youtube', 'http://mokky.ipdisk.co.kr:8000/list/HDD1/icon/youtube_logo.png')
    .setColor('#FFC0CB')
    .setDescription(queueData);
  
  return message.channel.send(embedMessage);
}

function stop(message: Discord.Message, serverQueue: SongQueue) {
  const voiceState = message.guild.me.voice;
  const voiceChannel = voiceState?.channel;
  if (!serverQueue) {
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

function deleteSong(message: Discord.Message, serverQueue: SongQueue) {
  const args = message.content.split(' ');
  if (args.length < 2) {
    return message.channel.send('`~d <queue_index>`');
  }
  if (!serverQueue || serverQueue.songs.length === 0) {
    return message.channel.send('대기열이 비었음');
  }
  if (args[1] === '1') {
    return skip(message, serverQueue);    
  }
  const index = parseInt(args[1]);
  if (isNaN(index) || index < 1 || index > serverQueue.songs.length) {
    return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
  }

  const removedSong = serverQueue.songs.splice(index-1, 1);
  message.channel.send(`❎ \`재생목록 ${index}번째 삭제: ${removedSong[0].title}\``);
}

function modifyOrder(message: Discord.Message, serverQueue: SongQueue) {
  const args = message.content.split(' ');
  if (args.length < 3) {
    return message.channel.send('`~m <target_index> <new_index>`');
  }
  if (!serverQueue || serverQueue.songs.length === 0) {
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
  const size = serverQueue.songs.length;
  if (targetIndex < 1 || targetIndex > size || newIndex < 1 || newIndex > size) {
    return message.channel.send('https://item.kakaocdn.net/do/7c321020a65461beb56bc44675acd57282f3bd8c9735553d03f6f982e10ebe70');
  }

  // shift order
  const targetSong = serverQueue.songs.splice(targetIndex-1, 1)[0];
  serverQueue.songs.splice(newIndex-1, 0, targetSong);
  message.channel.send('✅ `순서 변경 완료`');
}

// --- internal

function onDisconnect(serverQueue: SongQueue) {
  if (serverQueue.connection.dispatcher) {
    serverQueue.connection.dispatcher.end();
  }
  serverQueue.songs = [];
  serverQueue.connection = null;
  console.log('음성 채널 연결 종료됨');
}

async function addToPlaylist(song: Song, queue: SongQueue) {
  console.log('대기열 전송 중...');
  queue.songs.push(song);

  // db check
  const exist = await db.checkSongRegistered(song.id);
  if (!exist) {
    await db.addSong(song);
    console.info('Add song to DB: ' + song.id);
  }
  db.increasePickCount(song.id);
}

async function getYoutubeSongInfo(url: string) {
  return await ytdl.getInfo(url);
}

async function play(guild: Discord.Guild, song: Song) {
  const serverQueue = queueSet.get(guild.id);
  
  // Yurika Random
  if (!song) {
    const randId = await db.getRandomSongID();
    const randSong = await getYoutubeSongInfo('https://www.youtube.com/watch?v=' + randId);
    song = new Song(
      randSong.videoDetails.videoId,
      randSong.videoDetails.title,
      randSong.videoDetails.video_url,
      randSong.videoDetails.ownerChannelName,
      randSong.videoDetails.thumbnails.slice(-1)[0].url,
      parseInt(randSong.videoDetails.lengthSeconds),
    );
    serverQueue.songs.push(song);
    console.log(`랜덤 선곡: ${song.title} (${song.id})`);
  }

  const dispatcher = serverQueue.connection
    .play(await ytdl(song.url), { type: 'opus' })
    .on("finish", () => {
      console.log(`재생 끝: ${song.title}`);
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => {
      serverQueue.textChannel.send('```cs\n'+
      '# 에러가 발생했습니다. 잠시 후 다시 사용해주세요.\n'+
      `CODE: ${error.message}`+
      '```');
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

  db.increasePlayCount(song.id);
  db.fillEmptySongInfo(song.id, song.title);

  console.log(`재생: ${song.title}`);
  client.user.setActivity(song.title, { type: 'LISTENING' });
  serverQueue.textChannel.send(`🎶 \`재생: ${song.title}\``);
}

async function keywordSearch(message: Discord.Message, msgId: string) {
  const keyword = message.content.split(' ').slice(1).join(' ');
  // console.log(encodeURIComponent(keyword));
  const res = await MyUtil.getYoutubeSearchList(encodeURIComponent(keyword));

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

}

async function playRequest(message: Discord.Message, user: Discord.User, serverQueue: SongQueue, url: string, msgId: string) {
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
    console.log(errMsg);
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

  if (!serverQueue || serverQueue.connection === null) {
    const queue = new SongQueue(message.channel, voiceChannel, null, [], 5, true);
    queueSet.set(message.guild.id, queue);

    addToPlaylist(song, queue);

    try {
      // Voice connection
      console.log('음성 채널 연결 중...');
      message.channel.send(`🔗 \`연결: ${voiceChannel.name}\``);
      
      var connection = await voiceChannel.join();
      connection.on('disconnect', () => {
        onDisconnect(queue);
      });
      queue.connection = connection;
      play(message.guild, queue.songs[0]);
    }
    catch (err) {
      console.log(err);
      queueSet.delete(message.guild.id);
      return message.channel.send(`\`\`\`${err}\`\`\``);
    }
    finally {
      message.channel.messages.fetch(msgId).then(msg => msg.delete());
    }
  } else {
    addToPlaylist(song, serverQueue);

    message.channel.messages.fetch(msgId).then(msg => msg.delete());
    
    const embedMessage = new Discord.MessageEmbed()
    .setAuthor('재생목록 추가', message.guild.me.user.avatarURL(), song.url)
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
      },
      {
        name:   '대기열',
        value:  serverQueue.songs.length,
        inline: true,
      },
    );
  
    return message.channel.send(embedMessage);
  }
}