import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { ChatSession } from '@startuphafen/startuphafen-common';
import { ChatHistoryComponent } from './chat-history.component';

describe('ChatHistoryPresentationComponent', () => {
  let spectator: Spectator<ChatHistoryComponent>;

  const session: ChatSession = {
    id: 1,
    title: 'Existing chat',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userId: 'user-1',
  };

  const createComponent = createComponentFactory({
    component: ChatHistoryComponent,
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('emits startNewChat when the create button is clicked', () => {
    spectator.detectChanges();
    const emitSpy = jest.spyOn(spectator.component.startNewChat, 'emit');

    spectator.click(byTestId('chat-session-create-button'));

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits selectSession when a session is clicked', () => {
    spectator.setInput('sessions', [session]);
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.selectSession, 'emit');
    spectator.click(byTestId('chat-session-item'));

    expect(emitSpy).toHaveBeenCalledWith(session.id);
  });

  it('emits sessionRenameBegin when the rename button is pressed', () => {
    spectator.setInput('sessions', [session]);
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.sessionRenameBegin, 'emit');
    spectator.click(byTestId('chat-session-rename-button'));

    expect(emitSpy).toHaveBeenCalledWith(session);
  });

  it('emits sessionDeleteRequested when the delete button is pressed', () => {
    spectator.setInput('sessions', [session]);
    spectator.detectChanges();

    const emitSpy = jest.spyOn(
      spectator.component.sessionDeleteRequested,
      'emit'
    );
    spectator.click(byTestId('chat-session-delete-button'));

    expect(emitSpy).toHaveBeenCalledWith(session.id);
  });

  it('emits editedTitleChange when the title input changes', () => {
    spectator.setInput('sessions', [session]);
    spectator.setInput('editingSessionId', session.id);
    spectator.setInput('editedTitle', session.title);
    spectator.detectChanges();

    const emitSpy = jest.spyOn(spectator.component.editedTitleChange, 'emit');
    const input = spectator.query(byTestId('chat-session-rename-input'));

    expect(input).toBeTruthy();

    if (input instanceof HTMLInputElement) {
      spectator.typeInElement('Renamed chat', input);
    }

    expect(emitSpy).toHaveBeenLastCalledWith('Renamed chat');
  });

  it('disables the create button and shows a limit hint when the session cap is reached', () => {
    spectator.setInput('hasReachedSessionLimit', true);
    spectator.setInput('sessionLimit', 10);
    spectator.detectChanges();

    const button = spectator.query(
      byTestId('chat-session-create-button')
    ) as HTMLButtonElement;
    const hint = spectator.query(byTestId('chat-session-limit-indicator'));

    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
    expect(hint?.textContent).toContain('10');
  });
});
