import consoleStamp from 'console-stamp';
import { DJYurika } from './djyurika';

consoleStamp(console, {
  format: ':date(yyyy/mm/dd HH:MM:ss.l)'
});

process.setMaxListeners(0); // release limit (for voicestatechange event handler)

const djyurika = new DJYurika();
djyurika.start();
