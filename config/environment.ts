import { Config } from '../types';

export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  developerID: '368764722717392917',
  githubRepoUrl: 'https://github.com/iSwanGit/djyurika_js',
  supportServer: 'https://discord.com/invite/GwS2JJGnXh',
  supportServerID: '938391207535599646',
  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 3,
  refreshInterval: 13000,
  timeCounterTickInterval: 100,
  maxQueueTextRows: 50,

  // for debug
  overrideConfigs: [
    
  ] as Config[],
}
