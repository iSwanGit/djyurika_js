import { Config } from '../types';

export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  developerID: '368764722717392917',
  githubRepoUrl: 'https://github.com/iSwanGit/djyurika_js',
  inviteUrl: 'https://discord.com/api/oauth2/authorize?client_id=810426389836464148&permissions=36726848&scope=bot%20applications.commands',
  supportServerUrl: 'https://discord.com/invite/GwS2JJGnXh',
  supportServerID: '938391207535599646',
  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 3,
  refreshInterval: 13000,
  timeCounterTickInterval: 100,
  maxQueueTextRows: 50,
  queueGroupRowSize: 5, // 약수로 입력하기

  // for debug
  overrideConfigs: [
    
  ] as Config[],
}
