import { PermissionString } from 'discord.js';
import { Config } from '../types';

export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  developerID: '368764722717392917',
  githubRepoUrl: 'https://github.com/iSwanGit/djyurika_js',
  inviteUrl: 'https://discord.com/api/oauth2/authorize?client_id=810426389836464148&permissions=120612928&scope=bot%20applications.commands',
  supportServerUrl: 'https://discord.gg/JX6u8ZmdEX',
  supportServerID: '938391207535599646',
  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 3,
  refreshInterval: 13000,
  timeCounterTickInterval: 100,
  maxQueueTextRows: 50,
  queueGroupRowSize: 5, // 약수로 입력하기

  textChannelPermissionStrings: [
    'ADD_REACTIONS',
    'EMBED_LINKS',
    'SEND_MESSAGES', 
    'MANAGE_MESSAGES',
  ] as PermissionString[],
  voiceChannelPermissionStrings: [
    'CONNECT',
    'SPEAK',
    'MOVE_MEMBERS',
    'USE_VAD',
  ] as PermissionString[],
  
  // for debug
  overrideConfigs: [
    
  ] as Config[],
}
