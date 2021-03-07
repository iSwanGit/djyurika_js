export class ServerOption {
  serverID: string;
  developerRoleID: string;
  moderatorRoleID: string;
  commandChannelID: string;

  constructor(s?: string, d?: string, m?: string, c?: string) {
    this.serverID = s;
    this.developerRoleID = d;
    this.moderatorRoleID = m;
    this.commandChannelID = c;
  }
}
