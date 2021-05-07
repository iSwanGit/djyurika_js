import { Config } from '../types';

export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  githubRepoUrl: 'https://github.com/MikuWallets/djyurika_js',
  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 3,
  refreshInterval: 13000,
  maxQueueTextRows: 50,

  // for debug
  overrideConfigs: [
    
  ] as Config[],
}
