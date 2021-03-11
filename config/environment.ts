export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  
  serverOptions: [
    {
      serverID: '759404553451601920', // mmk
      developerRoleID: '760741584492298251',
      moderatorRoleID: '760806219509137418',
      commandChannelID: '810524606812651520',
      // commandChannelID: '762474528840351774',  // bot-command
    },
    {
      serverID: '706826945010204743', // mikuwallets
      developerRoleID: '757615133412425850',  // admin
      moderatorRoleID: null,
      commandChannelID: '818104757822029865', // dj-yurika-command
    },
  ],

  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 5,
}
