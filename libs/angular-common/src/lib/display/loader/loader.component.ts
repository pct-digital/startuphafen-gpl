import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PctLoaderService } from '../../services/loader.service';

@Component({
  selector: 'sh-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styles: [
    `
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoaderComponent {
  constructor(private loaderService: PctLoaderService) {}

  get isVisible(): boolean {
    return this.loaderService.isLoading();
  }
}
