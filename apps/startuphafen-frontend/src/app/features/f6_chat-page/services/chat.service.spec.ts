import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import {
  ChatAuthor,
  ChatMessage,
  ChatSession,
} from '@startuphafen/startuphafen-common';
import { firstValueFrom } from 'rxjs';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let spectator: SpectatorService<ChatService>;
  let trpcService: jest.Mocked<TrpcService>;
  type ChatBotClientMocks = {
    listSessions: { query: jest.Mock };
    createSession: { mutate: jest.Mock };
    renameSession: { mutate: jest.Mock };
    deleteSession: { mutate: jest.Mock };
    getMessages: { query: jest.Mock };
    sendMessage: { mutate: jest.Mock };
  };
  let chatBotClient: ChatBotClientMocks;

  const createService = createServiceFactory({
    service: ChatService,
    mocks: [TrpcService],
  });

  beforeEach(() => {
    spectator = createService();
    trpcService = spectator.inject(TrpcService) as jest.Mocked<TrpcService>;
    chatBotClient = {
      listSessions: { query: jest.fn() },
      createSession: { mutate: jest.fn() },
      renameSession: { mutate: jest.fn() },
      deleteSession: { mutate: jest.fn() },
      getMessages: { query: jest.fn() },
      sendMessage: { mutate: jest.fn() },
    };
    (trpcService.client as unknown) = { ChatBot: chatBotClient };
  });

  it('should be created', () => {
    expect(spectator.service).toBeTruthy();
  });

  it('should list chat sessions', async () => {
    const mockSessions: ChatSession[] = [
      {
        id: 1,
        title: 'Session A',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        userId: 'user-1',
      },
    ];
    chatBotClient.listSessions.query.mockResolvedValue(mockSessions);

    const result = await firstValueFrom(spectator.service.listSessions());

    expect(result).toEqual(mockSessions);
    expect(chatBotClient.listSessions.query).toHaveBeenCalled();
  });

  it('should create a chat session', async () => {
    const mockSession: ChatSession = {
      id: 5,
      title: 'Neuer Chat',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      userId: 'user-2',
    };
    chatBotClient.createSession.mutate.mockResolvedValue(mockSession);

    const result = await firstValueFrom(spectator.service.createSession());

    expect(result).toEqual(mockSession);
    expect(chatBotClient.createSession.mutate).toHaveBeenCalledWith({});
  });

  it('should rename a chat session', async () => {
    const updatedSession: ChatSession = {
      id: 7,
      title: 'Renamed chat',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      userId: 'user-3',
    };
    chatBotClient.renameSession.mutate.mockResolvedValue(updatedSession);

    const result = await firstValueFrom(
      spectator.service.renameSession(updatedSession.id, updatedSession.title)
    );

    expect(result).toEqual(updatedSession);
    expect(chatBotClient.renameSession.mutate).toHaveBeenCalledWith({
      sessionId: updatedSession.id,
      title: updatedSession.title,
    });
  });

  it('should delete a chat session', async () => {
    chatBotClient.deleteSession.mutate.mockResolvedValue(undefined);

    await firstValueFrom(spectator.service.deleteSession(9));

    expect(chatBotClient.deleteSession.mutate).toHaveBeenCalledWith({
      sessionId: 9,
    });
  });

  it('should load messages and convert timestamps', async () => {
    const now = new Date();
    const mockMessages: ChatMessage[] = [
      {
        id: 1,
        sessionId: 3,
        author: ChatAuthor.agent,
        content: 'Hi',
        createdAt: now,
      },
    ];

    chatBotClient.getMessages.query.mockResolvedValue(mockMessages);

    const result = await firstValueFrom(spectator.service.loadMessages(3));

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hi');
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(chatBotClient.getMessages.query).toHaveBeenCalledWith({
      sessionId: 3,
    });
  });

  it('should send a message and map response payload', async () => {
    const now = new Date().toISOString();
    chatBotClient.sendMessage.mutate.mockResolvedValue({
      session: {
        id: 11,
        title: 'Neuer Chat',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      messages: [
        {
          id: 1,
          sessionId: 11,
          author: 'human',
          content: 'Hello',
          createdAt: now,
        },
        {
          id: 2,
          sessionId: 11,
          author: 'agent',
          content: 'Hi there!',
          createdAt: now,
        },
      ],
    });

    const result = await firstValueFrom(
      spectator.service.sendMessage(null, 'Hello')
    );

    expect(result.session.id).toBe(11);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].author).toBe('agent');
    expect(result.messages[1].createdAt).toBeInstanceOf(Date);
    expect(chatBotClient.sendMessage.mutate).toHaveBeenCalledWith({
      sessionId: undefined,
      message: 'Hello',
    });
  });

  it('should surface errors from sendMessage', async () => {
    const error = new Error('boom');
    chatBotClient.sendMessage.mutate.mockRejectedValue(error);

    await expect(
      firstValueFrom(spectator.service.sendMessage(1, 'Hello'))
    ).rejects.toThrow(error);
  });
});
