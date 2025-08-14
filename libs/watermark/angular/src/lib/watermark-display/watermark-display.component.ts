import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WatermarkTrpcService } from '../watermark-api';
import { VERSION_STRING } from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sp-watermark-display',
  templateUrl: './watermark-display.component.html',
  styleUrls: ['./watermark-display.component.scss'],
})
export class WatermarkDisplayComponent implements OnInit {
  showWaterMark$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  mark = '';
  version = VERSION_STRING;

  constructor(private trpc: WatermarkTrpcService) {}

  async ngOnInit() {
    const text = await this.trpc.getWatermarkApi().watermark.query();
    if (text && text.trim().length > 0) {
      this.showWaterMark$.next(true);
      this.mark = text;
    }
  }
}
