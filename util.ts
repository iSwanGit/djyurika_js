import { GuildMember } from 'discord.js';
import request from 'request-promise-native';
import { environment, keys } from './config';
import { YoutubeSearch } from './types/youtube/youtubesearch';

export function fillZeroPad(num: number, width: number) {
  const n = num + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

export function checkDeveloperRole(member: GuildMember) {
  return member.roles.cache.find(role => role.id === environment.developerRoleID);
}

export function checkModeratorRole(member: GuildMember) {
  return member.roles.cache.find(role => role.id === environment.moderatorRoleID);
}

export async function getYoutubeSearchList(keyword: string): Promise<YoutubeSearch> {
  const apiUrl = `${environment.searchApiUrl}?key=${keys.youtubeApiKey}`
    + `&part=snippet&type=video&maxResults=5&videoEmbeddable=true`
    + `&q=${keyword}`;
  
  const res = await request(apiUrl).catch((err) => {throw err.error});
  const searchResult: YoutubeSearch = JSON.parse(res);
  return searchResult;
}
