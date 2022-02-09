import { SlashCommandBuilder } from '@discordjs/builders'
import { ChannelType } from 'discord-api-types';

export const defaultCommands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show command list and description'),
  new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Register text command channel')
    .addSubcommand(command => command
      .setName('id')
      .setDescription('Select command channel using ID')
      .addStringOption(option => option
        .setName('id')
        .setRequired(true)
        .setDescription('Channel ID')
      )
    )
    .addSubcommand(command => command
      .setName('select')
      .setDescription('Select command channel from channel list')
      .addChannelOption(option => option
        .addChannelType(ChannelType.GuildText)
          .setName('channel')
          .setRequired(false)
          .setDescription('Channel select')
      )
    ),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Serve a link for inviting me'),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Show infos for support'),
].map(command => command.toJSON());

export const supportGuildCommands = [
  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show servers now playing (for admin)')
    .setDefaultPermission(false)
].map(command => command.toJSON());
