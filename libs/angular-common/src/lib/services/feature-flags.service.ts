import { Injectable, inject } from '@angular/core';
import { TrpcService } from './trpc.service';

@Injectable({
  providedIn: 'root',
})
export class FeatureFlagsService {
  private trpcService = inject(TrpcService);
  private featureFlags = new Map<string, boolean>();
  private initialized = false;

  /**
   * Initialize feature flags by fetching them from the backend.
   * This should be called once during app startup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const flags =
        await this.trpcService.client.FeatureFlags.getFeatureFlags.query();
      this.featureFlags.clear();
      for (const flag of flags) {
        this.featureFlags.set(flag.name, flag.enabled);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize feature flags:', error);
      // Set all flags to false on error to fail safely
      this.initialized = true;
    }
  }

  /**
   * Check if a feature flag is enabled.
   * @param flagName The name of the feature flag to check
   * @returns true if the flag exists and is enabled, false otherwise
   */
  isEnabled(flagName: string): boolean {
    if (!this.initialized) {
      console.warn(
        `Feature flags not initialized yet. Returning false for flag: ${flagName}`
      );
      return false;
    }
    return this.featureFlags.get(flagName) ?? false;
  }
}
