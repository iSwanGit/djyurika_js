import Discord from 'discord.js';
import ytdl from 'ytdl-core-discord';
import ytdlc from 'ytdl-core';  // for using type declaration
import consoleStamp from 'console-stamp';

import { environment, keys } from './config';
import { Song, SongQueue } from './types';
import * as MyUtil from './util';

consoleStamp(console, {
  pattern: 'yyyy/mm/dd HH:MM:ss.l',
});

const client = new Discord.Client();
const queueSet = new Map<string, SongQueue>();  // song queue for each channel

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

  const serverQueue = queueSet.get(message.guild.id);

  const cmd = message.content.split(' ')[0].replace(`${environment.prefix}`, '');

  switch (cmd) {
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
      if (MyUtil.checkDeveloperRole(message)) {
        if (serverQueue && serverQueue.songs.length > 0) {
          message.channel.send(`🎵 id: \`${serverQueue.songs[0].id}\``)
        }
      }
      break;

    default:
      message.channel.send("사용법: `~h`");
      break;
  }

})

client.login(keys.botToken)
  .catch(err => { console.error(err) });


// -------- function definition -------

function sendHelp(message: Discord.Message) {
  const embedMessage = new Discord.MessageEmbed()
    .setAuthor('사용법', message.guild.me.user.avatarURL(), message.guild.me.user.avatarURL())
    .setColor('#ffff00')
    .setDescription("`~p 음악`: 유튜브에서 영상 재생\n\n" +
    "`~q`: 대기열 정보\n\n" +
    "`~np`: 현재 곡 정보\n\n" +
    "`~s`: 건너뛰기\n\n" +
    "`~l`: 채널에서 봇 퇴장\n\n");

  message.channel.send(embedMessage);
}

async function execute(message: Discord.Message, serverQueue: SongQueue) {
  const args = message.content.split(" ");

  if (args.length < 2) {
    return message.channel.send("`~p <song_link>` or `~p <exact_keyword>`");
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
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      `Error: I need the permissions to join and speak in your voice channel!"`
    );
  }

  // search text (this message will be removed after found)
  let id = (await message.channel.send(`🎵 \`검색 중: ${args[1]}\``)).id;
  console.log(`검색 중: ${args[1]}`);

  // get song info
  let songInfo: ytdlc.videoInfo;
  try {
    songInfo = await ytdl.getInfo(args[1]);
  }
  catch (err) {
    const errMsg = err.toString().split('\n')[0];
    console.log(errMsg);
    message.channel.messages.fetch(id).then(msg => msg.delete());
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

    console.log("대기열 전송 중...");
    queue.songs.push(song);

    try {
      // Voice connection
      console.log('음성 채널 연결 중...');
      message.channel.send(`🔗 \`연결: ${(message.channel as Discord.TextChannel).name}\``);
      
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
      return message.channel.send(err);
    }
    finally {
      message.channel.messages.fetch(id).then(msg => msg.delete());
    }
  } else {
    console.log("대기열 전송 중...");
    serverQueue.songs.push(song);
    message.channel.messages.fetch(id).then(msg => msg.delete());
    
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

function skip(message: Discord.Message, serverQueue: SongQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  
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
      message.channel.send("👋 또 봐요~ 음성채널에 없더라도 명령어로 부르면 달려올게요. 혹시 제가 돌아오지 않는다면 관리자를 불러주세요..!");
    }
    catch (err) {
      console.log(err);
    }
  }
 
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

async function play(guild: Discord.Guild, song: Song) {
  const serverQueue = queueSet.get(guild.id);
  // TODO: Yurika Random
  if (!song) {
    serverQueue.voiceChannel.leave();
    queueSet.delete(guild.id);
    return;
  }

  console.log(`재생: ${song.title}`);
  const dispatcher = serverQueue.connection
    .play(await ytdl(song.url), { type: 'opus' })
    .on("finish", () => {
      console.log(`재생 끝: ${song.title}`);
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`🎶 \`재생: ${song.title}\``);
}
