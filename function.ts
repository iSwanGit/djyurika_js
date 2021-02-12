import * as Discord from 'discord.js';
import ytdl from 'ytdl-core';
import { SongQueue } from './types';

declare const queue: Map<string, SongQueue>;
