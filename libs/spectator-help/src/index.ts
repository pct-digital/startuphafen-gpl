import { phl } from '@angular-extensions/pretty-html-log';
import { By } from '@angular/platform-browser';
import { Spectator } from '@ngneat/spectator/jest';
import { sleep } from '@startuphafen/utility';

export const componentInstanceByTestId = <T>(
  spectator: Spectator<any>,
  selector: string
) => {
  const queryResult = spectator.debugElement.query(
    By.css(`[data-testid="${selector}"]`)
  );
  if (queryResult == null) {
    throw new Error(
      'Failed to get component instance for data-testid ' +
        selector +
        ': selector not found!'
    );
  }

  return queryResult.componentInstance as T;
};

export async function waitForNextTick() {
  // do not use nextTick, it failed me, guess it broke in a recent jest version?!
  await sleep(0);
}

/**
 * The one stop
 * please-wait-for-angular-changes-to-all-be-ready
 * solution
 */
export async function detectAllChanges(spectator: Spectator<any>) {
  spectator.detectChanges();
  await spectator.fixture.whenStable();
  await waitForNextTick();
  spectator.detectChanges();
}

// if you have timer intervals running detectAllChanges will never resolve, since it aways whenStable!
export async function detectNonStableChanges(spectator: Spectator<any>) {
  for (let i = 0; i < 5; i++) {
    spectator.detectChanges();
    await sleep(25);
  }
}

export async function waitForAngularToStabilize(spectator: Spectator<any>) {
  spectator.detectChanges();
  await spectator.fixture.whenStable();
  spectator.detectChanges();
}

export function printPHL(spectator: Spectator<any>) {
  phl(spectator.fixture);
}

export * from './trpc';
