// Things that should happen at the start of every server main

import os from 'os';
import util from 'util';
import { importPgForWebpack } from './database/depend-pg';

export function prepServerStart(VERSION: any) {
  util.inspect.defaultOptions = {
    depth: 20,
    numericSeparator: true,
  };

  importPgForWebpack();

  console.log('Environment: ', process.env);
  console.log('Node process user', os.userInfo());
  console.log(
    'Starting server ' + VERSION.timeVersion + ' with pid ' + process.pid
  );
  console.log('Package version: ' + VERSION.versionCode);
  console.log('Working directory is ' + process.cwd());
  console.log('This file name is ' + __filename);
  console.log(
    'Running node ' + process.version + ' with command',
    process.argv.join(' ')
  );
}
