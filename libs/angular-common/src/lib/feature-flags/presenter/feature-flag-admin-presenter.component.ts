import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { formatGermanDate } from '../../helpers/helpers';
import { FeatureFlagAdminItem } from '../feature-flag.models';

@Component({
  selector: 'sh-feature-flag-admin-presenter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feature-flag-admin-presenter.component.html',
  styleUrls: ['./feature-flag-admin-presenter.component.css'],
})
export class FeatureFlagAdminPresenterComponent {
  @Input() flags: FeatureFlagAdminItem[] = [];
  @Input() isLoading = false;
  @Input() isSaving = false;
  @Input() hasChanges = false;
  @Input() dirtyFlags: Record<string, boolean> = {};
  @Input() loadError: string | null = null;
  @Input() saveError: string | null = null;
  @Input() successMessage: string | null = null;

  @Output() toggleFlag = new EventEmitter<{ name: string; enabled: boolean }>();
  @Output() saveClicked = new EventEmitter<void>();
  @Output() retryClicked = new EventEmitter<void>();

  onToggle(name: string, event: Event) {
    const target = event.target as HTMLInputElement;
    this.toggleFlag.emit({ name, enabled: target.checked });
  }

  formatUpdatedAt(value: Date | string | null | undefined) {
    return formatGermanDate(value, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
}
