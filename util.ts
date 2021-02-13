import { Message } from 'discord.js';
import { environment } from './config';

export function fillZeroPad(num: number, width: number) {
  const n = num + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

export function checkDeveloperRole(message: Message) {
  return message.member.roles.cache.find(role => role.id === environment.developerRoleID);
}

export function checkModeratorRole(message: Message) {
  return message.member.roles.cache.find(role => role.id === environment.moderatorRoleID);
}
