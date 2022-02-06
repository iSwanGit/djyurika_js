import { SlashCommandBuilder } from '@discordjs/builders'

export const defaultCommands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show command list and description'),
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Show command list and description')
    .addStringOption(option => option
      .setName('channel_id')
      .setRequired(true)
      .setDescription('Register text command channel')),
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
