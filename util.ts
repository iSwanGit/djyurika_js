import { APIInteractionGuildMember } from 'discord-api-types';
import { Collection, GuildMember, Role } from 'discord.js';
import request from 'request-promise-native';
import { environment, keys } from './config';
import { Config, YoutubeSearch } from './types';

export function fillZeroPad(num: number, width: number) {
  const n = num + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

export function checkDeveloperRole(memberRoles: Collection<string, Role>, cfg: Config) {
  return memberRoles.find(role => {    
    if (!cfg?.developerRoleID) return true;  // undefined always pass
    return role?.id === cfg.developerRoleID;
  });
}

export function checkModeratorRole(memberRoles: Collection<string, Role>, cfg: Config) {
  return memberRoles.find(role => {
    if (!cfg?.moderatorRoleID) return true;  // undefined always pass
    return role?.id === cfg.moderatorRoleID;
  });
}

export async function getYoutubeSearchList(keyword: string): Promise<YoutubeSearch> {
  const apiUrl = `${environment.searchApiUrl}?key=${keys.youtubeApiKey}`
    + `&part=snippet&type=video&maxResults=${environment.maxSearchResults}&videoEmbeddable=true`
    + `&q=${keyword}`;
  
  const res = await request(apiUrl).catch((err) => {throw err.error});
  const searchResult: YoutubeSearch = JSON.parse(res);
  return searchResult;
}

// min <= x < max  
export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}
