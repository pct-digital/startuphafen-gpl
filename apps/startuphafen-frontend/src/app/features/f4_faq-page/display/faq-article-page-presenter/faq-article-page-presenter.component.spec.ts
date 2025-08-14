import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { FaqArticlePagePresenterComponent } from './faq-article-page-presenter.component';

describe('FaqArticlePagePresenterComponent', () => {
  let spectator: Spectator<FaqArticlePagePresenterComponent>;
  const createComponent = createComponentFactory(
    FaqArticlePagePresenterComponent
  );

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  it('should have a title', () => {
    spectator = createComponent();

    expect(spectator.query(byTestId('faq-article-page-title'))).toExist();
  });

  it('should emit backButtonClicked when the back button is clicked', () => {
    spectator = createComponent();

    const emitSpy = jest.spyOn(spectator.component.backButtonClicked, 'emit');

    const articleBackButton = spectator.query(
      byTestId('faq-article-page-back-button')
    );

    expect(articleBackButton).toBeTruthy();

    if (articleBackButton) {
      spectator.click(articleBackButton);
      expect(emitSpy).toHaveBeenCalled();
    }
  });
});
