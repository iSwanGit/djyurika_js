export class Config {
  server: string;
  name: string;
  volume: number;
  commandChannelID: string;
  developerRoleID: string;
  moderatorRoleID: string;

  constructor(
    server?: string,
    name?: string,
    volume?: number,
    commandChannelID?: string,
    developerRoleID?: string,
    moderatorRoleID?: string
  ) {
    this.server = server;
    this.name = name;    
    this.volume = volume;
    this.commandChannelID = commandChannelID;
    this.developerRoleID = developerRoleID;
    this.moderatorRoleID = moderatorRoleID;
  }
}
