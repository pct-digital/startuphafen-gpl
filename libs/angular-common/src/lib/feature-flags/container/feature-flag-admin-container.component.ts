import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { LoaderComponent } from '../../display/loader/loader.component';
import { PctLoaderService } from '../../services/loader.service';
import { TrpcService } from '../../services/trpc.service';
import { FeatureFlagAdminItem } from '../feature-flag.models';
import { FeatureFlagAdminPresenterComponent } from '../presenter/feature-flag-admin-presenter.component';

@Component({
  selector: 'sh-feature-flag-admin-container',
  standalone: true,
  imports: [CommonModule, LoaderComponent, FeatureFlagAdminPresenterComponent],
  templateUrl: './feature-flag-admin-container.component.html',
  styles: ``,
})
export class FeatureFlagAdminContainerComponent implements OnInit {
  flags: FeatureFlagAdminItem[] = [];
  dirtyFlags: Record<string, boolean> = {};
  hasChanges = false;
  isLoading = false;
  isSaving = false;
  loadError: string | null = null;
  saveError: string | null = null;
  successMessage: string | null = null;

  private originalFlags = new Map<string, FeatureFlagAdminItem>();

  constructor(
    private trpc: TrpcService,
    private loaderService: PctLoaderService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadFlags();
  }

  async loadFlags() {
    this.isLoading = true;
    this.loadError = null;
    try {
      await this.loaderService.doWhileLoading('featureFlagsLoad', async () => {
        const flags =
          await this.trpc.client.FeatureFlags.getAdminFeatureFlags.query();
        this.originalFlags = new Map(flags.map((flag) => [flag.name, flag]));
        this.flags = flags.map((flag) => ({ ...flag }));
        this.dirtyFlags = {};
        this.computeDirtyState();
      });
    } catch (error) {
      console.error('Failed to load feature flags', error);
      this.flags = [];
      this.loadError =
        'Die Feature Flags konnten nicht geladen werden. Bitte versuchen Sie es erneut.';
    } finally {
      this.isLoading = false;
    }
  }

  onToggleFlag(event: { name: string; enabled: boolean }) {
    const exists = this.flags.some((flag) => flag.name === event.name);
    if (!exists) {
      return;
    }

    const original = this.originalFlags.get(event.name);
    const dirty = (original?.enabled ?? false) !== event.enabled;

    this.flags = this.flags.map((flag) =>
      flag.name === event.name
        ? {
            ...flag,
            enabled: event.enabled,
          }
        : flag
    );

    this.dirtyFlags = {
      ...this.dirtyFlags,
      [event.name]: dirty,
    };

    this.saveError = null;
    this.successMessage = null;
    this.computeDirtyState();
  }

  async onSaveChanges() {
    const changes = this.flags
      .filter((flag) => this.dirtyFlags[flag.name])
      .map((flag) => ({ name: flag.name, enabled: flag.enabled }));

    if (changes.length === 0) {
      return;
    }

    this.saveError = null;
    this.successMessage = null;
    this.isSaving = true;

    try {
      await this.loaderService.doWhileLoading('featureFlagsSave', async () => {
        for (const change of changes) {
          await this.trpc.client.FeatureFlags.setFeatureFlagState.mutate(
            change
          );
        }
      });
      await this.loadFlags();
      this.successMessage = 'Änderungen wurden gespeichert.';
    } catch (error) {
      console.error('Failed to save feature flags', error);
      this.saveError =
        'Die Änderungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.';
    } finally {
      this.isSaving = false;
    }
  }

  async onRetryLoad() {
    await this.loadFlags();
  }

  private computeDirtyState() {
    this.hasChanges = Object.values(this.dirtyFlags).some(Boolean);
  }
}
