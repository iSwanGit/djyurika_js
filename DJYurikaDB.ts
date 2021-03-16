import { createPool, Pool } from 'mariadb';
import { keys } from './config';
import { Config, Song } from './types';
import { getRandomInt } from './util';

class DJYurikaDB {
  private pool: Pool;
  // private songList: Array<DBSong>;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      this.pool = await createPool(keys.dbServer);
      // const conn = await this.pool.getConnection();
      // this.songList = await conn.query("SELECT * FROM playlist");
      // conn.end();
    }
    catch (err) { console.error(err); }
  }

  public async loadConfig(server: string) {
    try {
      const conn = await this.pool.getConnection();
      const config = (await conn.query(`SELECT volume FROM config WHERE server = ?`, server))[0] as Config;
      
      conn.end();
      return config;
    }
    catch (err) { console.error(err); throw err; }
  }

  public async saveConfig(config: Config, server: string) {
    try {
      const conn = await this.pool.getConnection();
      const exist = (await conn.query(`SELECT COUNT(*) as exist FROM config WHERE server = ?`, server))[0].exist;
      if (exist) {
        // update each attribute of DBConfig
        conn.query('UPDATE config SET volume = ? WHERE server = ?', [config.volume, server])
          .then(() => conn.end());
      }
      else {
        // create
        conn.query('INSERT INTO config (server, volume) VALUES (?, ?)', [server, config.volume])
          .then(() => conn.end());
      }
    }
    catch (err) { console.error(err); }
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
      conn.query('INSERT INTO playlist (id, title, createdat, source, guild) VALUES (?, ?, (SELECT NOW()), ?, ?)', [song.id, song.title, song.source, server])
        .then(async () => await this.increasePickCount(song, server))
        .catch(err => console.error(err))
        .finally(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async getRandomSongID(server: string): Promise<Song> {
    try {
      const conn = await this.pool.getConnection();
      let idRows: any = (await conn.query('SELECT id, source FROM playlist WHERE guild = ? ORDER BY RAND()', server));
      idRows = idRows.sort(() => 0.5 - Math.random());  // shuffle one more
      const res = idRows[getRandomInt(0, idRows.length)] as Song;
      const song = new Song(res.id, null, null, null, null, null, null, res.source);
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

      const dbTitle: string = (await conn.query('SELECT title FROM playlist WHERE id = ? AND source = ?', [song.id, song.source]))[0].title;
      if (!dbTitle.length || dbTitle !== song.title) {
        conn.query('UPDATE playlist SET title = ? WHERE id = ? AND source = ?', [song.title, song.id, song.source])
          .then(() => conn.end());
        console.info('Update song title to DB column');
      }
      else {
        conn.end();
      }
    }
    catch (err) { console.error(err); }
  }

}

export default DJYurikaDB;