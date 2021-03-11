export const environment = {
  prefix: '~',
  defaultConfig: {
    volume: 35,
  },
  githubRepoUrl: 'https://github.com/MikuWallets/djyurika_js',
  
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
    {
      serverID: '478916169340813312', // 고양이월드
      developerRoleID: '819628441838026753',  // Yurika Father
      moderatorRoleID: null,
      commandChannelID: '810144835499065344', // 노래신청방
    },
  ],

  searchApiUrl: 'https://www.googleapis.com/youtube/v3/search',
  youtubeUrlPrefix: 'https://www.youtube.com/watch?v=',
  maxSearchResults: 5,
}
