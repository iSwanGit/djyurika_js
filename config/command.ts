import { SlashCommandBuilder } from '@discordjs/builders'
import { ChannelType } from 'discord-api-types';

export const defaultCommands = [
  // new SlashCommandBuilder()
  //   .setName('hello')
  //   .setDescription('Hello world!'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show command list and description'),
  new SlashCommandBuilder()
    .setName('channel')
    .setDescription('About command channel')
    .addSubcommand(command => command
      .setName('info')
      .setDescription('Send current command channel')
    )
    .addSubcommand(command => command
      .setName('select')
      .setDescription('Select command channel from channel list (default: this channel)')
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
    .setName('status')
    .setDescription('Show bot usage status'),
  new SlashCommandBuilder()
    .setName('support')
    .setDescription('Show infos for support'),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play or add to queue')
    .addStringOption(option => 
      option.setName('source')
        .setRequired(false)
        .setDescription('youtube link, soundcloud link, or any keyword. Random pick if empty')
    ),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show play queue')
    .addIntegerOption(option => 
      option.setName('page')
        .setDescription('Queue page')
        .setRequired(false)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Stop and disconnect')
].map(command => command.toJSON());

export const supportGuildCommands = [
  new SlashCommandBuilder()
    .setName('dev_active')
    .setDescription('Show active server list (for dev/admin)')
    .setDefaultPermission(false)
].map(command => command.toJSON());
