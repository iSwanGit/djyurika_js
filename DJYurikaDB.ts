import { createPool, Pool } from 'mariadb';
import { keys } from './config';
import { Config, DBSong, Song } from './types';
import { getRandomInt } from './util';

export class DJYurikaDB {
  private pool: Pool;
  // private songList: Array<DBSong>;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      this.pool = await createPool(keys.dbServer);
      console.log('DB pool created')
      // const conn = await this.pool.getConnection();
      // this.songList = await conn.query("SELECT * FROM playlist");
      // conn.end();
    }
    catch (err) { console.error(err); }
  }

  public async waitAndCheckPoolCreated() {
    if (!this.pool) {
      setTimeout(() => {
        this.waitAndCheckPoolCreated();
      }, 100);
    }
  }

  public async loadConfig(server: string): Promise<Config> {
    try {
      const conn = await this.pool.getConnection();
      const config = (await conn.query(`SELECT server, name, volume, command_channel as commandChannelID, developer_role as developerRoleID, moderator_role as moderatorRoleID FROM config WHERE server = ?`, server))[0] as Config;
      
      conn.end();
      return config;
    }
    catch (err) { console.error(err); throw err; }
  }

  public async loadAllConfig(): Promise<Config[]> {    
    try {
      const conn = await this.pool.getConnection();
      const configs = (await conn.query(`SELECT server, name, volume, command_channel as commandChannelID, developer_role as developerRoleID, moderator_role as moderatorRoleID FROM config`)) as Config[];
      
      conn.end();
      return configs;
    }
    catch (err) { console.error(err); throw err; }
  }

  public async saveConfig(config: Config) {

    try {
      const conn = await this.pool.getConnection();
      const exist = (await conn.query(`SELECT COUNT(*) as exist FROM config WHERE server = ?`, config.server))[0].exist;
      if (exist) {
        // update each attribute of DBConfig
        conn.query('UPDATE config SET name = ?, volume = ?, command_channel = ?, developer_role = ?, moderator_role = ? WHERE server = ?',
        [config.name, config.volume, config.commandChannelID, config.developerRoleID, config.moderatorRoleID, config.server])
        .then(() => conn.end());
      }
      else {
        // create
        conn.query('INSERT INTO config (server, name, volume, command_channel, developer_role, moderator_role) VALUES (?, ?, ?, ?, ?, ?)',
        [config.server, config.name, config.volume, config.commandChannelID, config.developerRoleID, config.moderatorRoleID])
        .then(() => conn.end());
      }
    }
    catch (err) {
      console.error(err);
      throw err;
    }
  }

  public async checkSongRegistered(song: Song, server: string): Promise<boolean> {
    try {
      const conn = await this.pool.getConnection();
      const exist = (await conn.query(`SELECT COUNT(id) as exist FROM playlist WHERE id = ? AND source = ? AND guild = ?`, [song.id, song.source, server]))[0].exist;
      
      conn.end();
      // console.log(rows);
      if (exist) {  // already registered
        return true;
      }
      else {
        return false;
      }
    }
    catch (err) { console.error(err); }
  }

  public async addSong(song: Song, server: string) {
    try {
      const conn = await this.pool.getConnection();
      conn.query('INSERT INTO playlist (id, title, createdat, source, url, guild) VALUES (?, ?, (SELECT NOW()), ?, ?, ?)', [song.id, song.title, song.source, song.url, server])
        .then(async () => await this.increasePickCount(song, server))
        .catch(err => console.error(err))
        .finally(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async getRandomSongID(server: string): Promise<Song> {
    try {
      const conn = await this.pool.getConnection();
      let idRows: any = (await conn.query('SELECT id, url, source FROM playlist WHERE guild = ? ORDER BY RAND()', server));
      idRows = idRows.sort(() => 0.5 - Math.random());  // shuffle one more
      const res = idRows[getRandomInt(0, idRows.length)] as Song;
      const song = new Song(res.id, null, res.url, null, null, null, null, res.source);
      conn.end();
      return song;
    }
    catch (err) { console.error(err); }
  }

  public async increasePlayCount(song: Song, server: string) {
    try {
      const conn = await this.pool.getConnection();

      const count = (await conn.query('SELECT playcount FROM playlist WHERE id = ? AND source = ? AND guild = ?', [song.id, song.source, server]))[0].playcount;
      conn.query('UPDATE playlist SET playcount = ?, lastplayedat = (SELECT NOW()) WHERE id = ? AND source = ? AND guild = ?', [count+1, song.id, song.source, server])
        .then(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async increasePickCount(song: Song, server: string) {
    try {
      const conn = await this.pool.getConnection();

      const count = (await conn.query('SELECT pickcount FROM playlist WHERE id = ? AND source = ? AND guild = ?', [song.id, song.source, server]))[0].pickcount;
      conn.query('UPDATE playlist SET pickcount = ? WHERE id = ? AND source = ? AND guild = ?', [count+1, song.id, song.source, server])
        .then(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async fillEmptySongInfo(song: Song) {
    try {
      const conn = await this.pool.getConnection();

      const entity: DBSong = (await conn.query('SELECT title, url FROM playlist WHERE id = ? AND source = ?', [song.id, song.source]))[0];
      const dbTitle: string = entity.title;
      const dbPermalink: string = entity.url;

      if (!dbTitle.length || dbTitle !== song.title) {
        conn.query('UPDATE playlist SET title = ? WHERE id = ? AND source = ?', [song.title, song.id, song.source]);
        console.log('Update song title to DB column');
      }
      if (!dbPermalink || dbPermalink !== song.url) {
        conn.query('UPDATE playlist SET url = ? WHERE id = ? AND source = ?', [song.url, song.id, song.source]);
        console.log('Update permalink to DB column');
      }
      conn.end();
    }
    catch (err) { console.error(err); }
  }

}

export default DJYurikaDB;