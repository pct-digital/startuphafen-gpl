import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';

import { TrpcService } from '@startuphafen/angular-common';
import { WebsiteText } from '@startuphafen/startuphafen-common';
import { KeycloakService } from 'keycloak-angular';
import { StartPageComponent } from './start-page.component';

describe('StartPageComponent', () => {
  const mockWebsiteText: WebsiteText[] = [
    {
      id: 1,
      title: 'Welcome to Startuphafen',
      placeToPut: 'start-page-title',
    },
  ];

  let spectator: Spectator<StartPageComponent>;
  const createComponent = createComponentFactory({
    component: StartPageComponent,
    mocks: [KeycloakService, TrpcService],
  });

  beforeEach(() => {
    spectator = createComponent({ detectChanges: false });
    const getProjectSpy = jest.spyOn(spectator.component, 'getProjects');
    getProjectSpy.mockResolvedValue([]);
    const getWebsiteTextSpy = jest.spyOn(spectator.component, 'getWebsiteText');
    getWebsiteTextSpy.mockResolvedValue(mockWebsiteText);
  });

  it('should create', () => {
    spectator.detectChanges();

    expect(spectator.component).toBeTruthy();
  });

  it('should have a title', () => {
    spectator.detectChanges();

    expect(spectator.query(byTestId('start-page-title'))).toExist();
  });

  it('should have main-items', () => {
    spectator.detectChanges();

    const mainItems = spectator.query(byTestId('main-items'));

    expect(mainItems).toBeTruthy();
  });

  it('should call clickitem() when an item is clicked', () => {
    const clickSpy = jest.spyOn(spectator.component, 'clickitem');

    spectator.detectChanges();

    const items = spectator.component.getCardItems();
    const contactItem = items[2];

    const contactButton = spectator.query(
      byTestId(`home-button-${contactItem.path}`)
    );

    expect(contactButton).toBeTruthy();

    if (contactButton) {
      spectator.click(contactButton);
    }

    expect(clickSpy).toHaveBeenCalledWith(contactItem);
  });
});
