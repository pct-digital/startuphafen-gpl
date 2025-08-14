// useful in the context of making things more easily testable that need to read/write files

import { promises as fs } from 'fs';
import * as path from 'path';

export type FileWriteType =
  | string
  | NodeJS.ArrayBufferView
  | Iterable<string | NodeJS.ArrayBufferView>
  | AsyncIterable<string | NodeJS.ArrayBufferView>;

export class FileAccess {
  async readTextFile(path: string) {
    const b = await fs.readFile(path);
    return b.toString();
  }

  async readdir(path: string) {
    return await fs.readdir(path);
  }

  async writeFile(fpath: string, data: FileWriteType) {
    await fs.mkdir(path.dirname(fpath), {
      recursive: true,
    });
    return await fs.writeFile(fpath, data);
  }
}

export class NoFileAccess extends FileAccess {
  override async readTextFile(path: string): Promise<string> {
    throw new Error('no file access to ' + path);
  }

  override async readdir(path: string): Promise<string[]> {
    throw new Error('no dir access to ' + path);
  }

  override async writeFile(_path: string, _data: FileWriteType) {}
}
