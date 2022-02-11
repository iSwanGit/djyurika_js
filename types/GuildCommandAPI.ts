export interface GuildCommandAPI {
  id: string;
  application_id: string;
  version: string;
  default_permission: boolean;
  default_member_permissions: any;
  type: number;
  name: string;
  name_localizations: any;
  description: string;
  description_localizations: any;
  guild_id: string;
}
