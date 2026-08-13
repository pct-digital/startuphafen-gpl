import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AgCharts } from 'ag-charts-angular';
import { AgChartOptions } from 'ag-charts-community';
@Component({
  selector: 'sh-admin-page-presenter',
  standalone: true,
  imports: [CommonModule, AgCharts],
  templateUrl: './admin-page-presenter.component.html',
  styles: ``,
})
export class AdminPagePresenterComponent {
  @Input() topCards: {
    title: string;
    iconUrl: string;
    value: string | number;
  }[] = [];
  @Input() userChartOptions: AgChartOptions | null = null;
  @Input() errorMessage: string | null = null;

  @Output() kcRouteClicked = new EventEmitter<void>();
  @Output() strapiRouteClicked = new EventEmitter<void>();
  @Output() featureFlagRouteClicked = new EventEmitter<void>();
}
