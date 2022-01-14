import { SlashCommandBuilder } from '@discordjs/builders'

export const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show command list and description'),
].map(command => command.toJSON());
