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

  public async checkSongRegistered(id: string): Promise<boolean> {
    try {
      const conn = await this.pool.getConnection();
      const exist = (await conn.query(`SELECT COUNT(id) as exist FROM playlist WHERE id = ?`, id))[0].exist;
      
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

  public async addSong(song: Song) {
    try {
      const conn = await this.pool.getConnection();
      conn.query('INSERT INTO playlist (id, title, createdat) VALUES (?, ?, (SELECT NOW()))', [song.id, song.title])
        .then(async () => await this.increasePickCount(song.id))
        .catch(err => console.error(err))
        .finally(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async getRandomSongID(): Promise<string> {
    try {
      const conn = await this.pool.getConnection();
      let idRows: string[] = (await conn.query('SELECT id FROM playlist ORDER BY RAND()')).map(value => value.id);
      idRows = idRows.sort(() => 0.5 - Math.random());  // shuffle one more
      const id = idRows[getRandomInt(0, idRows.length)];
      conn.end();
      return id;
    }
    catch (err) { console.error(err); }    
  }

  public async increasePlayCount(id: string) {
    try {
      const conn = await this.pool.getConnection();

      const count = (await conn.query('SELECT playcount FROM playlist WHERE id = ?', id))[0].playcount;
      conn.query('UPDATE playlist SET playcount = ?, lastplayedat = (SELECT NOW()) WHERE id = ?', [count+1, id])
        .then(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async increasePickCount(id: string) {
    try {
      const conn = await this.pool.getConnection();

      const count = (await conn.query('SELECT pickcount FROM playlist WHERE id = ?', id))[0].pickcount;
      conn.query('UPDATE playlist SET pickcount = ? WHERE id = ?', [count+1, id])
        .then(() => conn.end());
    }
    catch (err) { console.error(err); }
  }

  public async fillEmptySongInfo(id: string, title: string) {
    try {
      const conn = await this.pool.getConnection();

      const dbTitle: string = (await conn.query('SELECT title FROM playlist WHERE id = ?', id))[0].title;
      if (!dbTitle.length) {
        conn.query('UPDATE playlist SET title = ? WHERE id = ?', [title, id])
          .then(() => conn.end());
        console.info('Fill song title to DB column');
      }
      else {
        conn.end();
      }
    }
    catch (err) { console.error(err); }
  }

}

export default DJYurikaDB;