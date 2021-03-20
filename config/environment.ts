export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  githubRepoUrl: 'https://github.com/MikuWallets/djyurika_js',
  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 5,
  refreshInterval: 13000,

  // for debug
  overrideConfigs: [
    {
      serverID: '759404553451601920', // mmk
      volume: 40,
      developerRoleID: '760741584492298251',
      moderatorRoleID: '760806219509137418',
      commandChannelID: '762474528840351774',  // bot-command
    },
    {
      serverID: '706826945010204743', // mikuwallets
      volume: 35,
      developerRoleID: '757615133412425850',  // admin
      moderatorRoleID: null,
      commandChannelID: '822370707942014976', // talk
    },
  ],
}
