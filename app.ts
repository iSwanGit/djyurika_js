import consoleStamp from 'console-stamp';
import { DJYurika } from './djyurika';

consoleStamp(console, {
  pattern: 'yyyy/mm/dd HH:MM:ss.l',
});

process.setMaxListeners(0); // release limit (for voicestatechange event handler)

const djyurika = new DJYurika();
djyurika.start();
