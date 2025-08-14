import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { WatermarkDisplayComponent } from './watermark-display/watermark-display.component';

@NgModule({
  imports: [CommonModule],
  declarations: [WatermarkDisplayComponent],
  exports: [WatermarkDisplayComponent],
})
export class WatermarkAngularModule {}
