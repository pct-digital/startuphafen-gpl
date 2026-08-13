import * as fs from 'fs';
import * as path from 'path';
import { FileSystemLike } from '../lib/hooks/helpers/keycloak/realm-merge';

/**
 * Fake implementation of FileSystemLike for testing.
 * Uses local temp directories instead of remote SSH operations.
 */
export class FakeRemoteFileSystem implements FileSystemLike {
  constructor(private readonly baseDir: string) {}

  pathExists(remotePath: string): boolean {
    const localPath = this.toLocalPath(remotePath);
    return fs.existsSync(localPath);
  }

  readFile(remotePath: string): string {
    const localPath = this.toLocalPath(remotePath);
    return fs.readFileSync(localPath, 'utf-8');
  }

  writeFile(remotePath: string, content: string): void {
    const localPath = this.toLocalPath(remotePath);
    fs.writeFileSync(localPath, content, 'utf-8');
  }

  mkdir(remotePath: string): void {
    const localPath = this.toLocalPath(remotePath);
    fs.mkdirSync(localPath, { recursive: true });
  }

  /**
   * Convert a "remote" path to a local path within the test directory.
   * This allows tests to use paths like "/opt/app/keycloak/templates/realm.json"
   * which get mapped to "{baseDir}/opt/app/keycloak/templates/realm.json".
   */
  private toLocalPath(remotePath: string): string {
    // Strip leading slash for path.join to work correctly
    const relativePath = remotePath.startsWith('/')
      ? remotePath.slice(1)
      : remotePath;
    return path.join(this.baseDir, relativePath);
  }

  /**
   * Helper to set up a file in the fake filesystem.
   * Creates parent directories as needed.
   */
  setupFile(remotePath: string, content: string): void {
    const localPath = this.toLocalPath(remotePath);
    const dir = path.dirname(localPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, content, 'utf-8');
  }

  /**
   * Helper to set up a JSON file in the fake filesystem.
   */
  setupJson(remotePath: string, data: object): void {
    this.setupFile(remotePath, JSON.stringify(data, null, 2));
  }

  /**
   * Helper to read a file that was written (for test assertions).
   */
  readWrittenFile(remotePath: string): string {
    return this.readFile(remotePath);
  }

  /**
   * Helper to read a JSON file that was written (for test assertions).
   */
  readWrittenJson(remotePath: string): object {
    return JSON.parse(this.readFile(remotePath));
  }
}
