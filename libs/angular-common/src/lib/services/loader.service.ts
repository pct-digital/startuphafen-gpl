import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PctLoaderService {
  private loaders = new Set<string>();

  constructor() {}

  startLoading(key: string) {
    if (this.loaders.has(key)) {
      throw new Error(
        'started loader with key ' +
          key +
          ' twice! You must not start the same loader key twice!'
      );
    }
    this.loaders.add(key);
  }

  stopLoading(key: string) {
    this.loaders.delete(key);
  }

  isLoading() {
    return this.loaders.size > 0;
  }

  async doWhileLoading<T>(key: string, work: () => Promise<T>) {
    try {
      this.startLoading(key);
      return await work();
    } finally {
      this.stopLoading(key);
    }
  }
}
