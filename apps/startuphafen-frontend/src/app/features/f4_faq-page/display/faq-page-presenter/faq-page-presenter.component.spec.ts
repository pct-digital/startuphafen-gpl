import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Artikel } from '@startuphafen/startuphafen-common';
import { FaqPagePresenterComponent } from './faq-page-presenter.component';

describe('FaqPagePresenterComponent', () => {
  let spectator: Spectator<FaqPagePresenterComponent>;

  const createComponent = createComponentFactory({
    component: FaqPagePresenterComponent,
    imports: [ReactiveFormsModule, NgSelectModule],
  });

  const mockArticle: Artikel = {
    id: 1,
    title: 'testArticle',
    documentId: '1',
    subtitle: 'subtest',
    articleCategory: { categoryName: 'Test', documentId: '1.1', id: 10 },
  };

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  it('should have a title', () => {
    spectator = createComponent();

    expect(spectator.query(byTestId('faq-page-title'))).toExist();
  });

  it('should emit articleClicked when an article is clicked', () => {
    spectator = createComponent();
    spectator.setInput('articles', [mockArticle]);
    spectator.setInput('categories', [
      { categoryName: 'Test', documentId: '1.1', id: 10 },
    ]);

    const emitSpy = jest.spyOn(spectator.component.articleClicked, 'emit');

    const articleItem = spectator.component.articles[0];

    const articleButton = spectator.query(
      byTestId(`article-item-${articleItem.title}`)
    );

    expect(articleButton).toBeTruthy();

    if (articleButton) {
      spectator.click(articleButton);
      expect(emitSpy).toHaveBeenCalledWith(mockArticle.documentId);
    }
  });
  it('should bind input value correctly', () => {
    spectator = createComponent();
    const testInput = 'Test input value';

    const input = spectator.query(byTestId('search-input')) as HTMLInputElement;

    spectator.typeInElement(testInput, input);

    expect(input.value).toBe(testInput);
  });
});
