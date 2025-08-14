import { Injectable } from '@angular/core';
const MOBILE_MAX_SIZE = 1279;
@Injectable({
  providedIn: 'root',
})
export class DeviceTypeService {
  private _isMobile = false;

  constructor() {
    const mediaQueryList = window.matchMedia(
      `(max-width: ${MOBILE_MAX_SIZE}px)`
    );
    const listener = (event: any) => {
      this._isMobile = event.matches;
    };
    listener(mediaQueryList);
    mediaQueryList.addEventListener('change', listener);
  }

  public get isMobile() {
    return this._isMobile;
  }

  public get isDesktop() {
    return !this._isMobile;
  }
}
