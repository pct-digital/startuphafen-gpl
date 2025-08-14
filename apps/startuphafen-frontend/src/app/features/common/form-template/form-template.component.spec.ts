import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import { FormTemplateComponent } from './form-template.component';

describe('FormTemplateComponent', () => {
  let spectator: Spectator<FormTemplateComponent>;

  const createComponent = createComponentFactory({
    component: FormTemplateComponent,
    imports: [
      FormlyModule.forRoot({
        types: [],
      }),
    ],
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  it('should emit saveClicked when the save button is clicked', () => {
    spectator = createComponent();

    const emitSpy = jest.spyOn(spectator.component.saveClicked, 'emit');

    const saveButton = spectator.query(byTestId('save-button'));

    expect(saveButton).toBeTruthy();

    if (saveButton) {
      spectator.click(saveButton);
    }

    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit nextClicked when the next button is clicked', () => {
    spectator = createComponent();

    const emitSpy = jest.spyOn(spectator.component.nextClicked, 'emit');

    const nextButton = spectator.query(byTestId('next-button'));

    expect(nextButton).toBeTruthy();

    if (nextButton) {
      spectator.click(nextButton);
    }

    expect(emitSpy).toHaveBeenCalled();
  });
});
