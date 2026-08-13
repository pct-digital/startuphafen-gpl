import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
import {
  HWK_AI_ANSWER_KEY,
  HwkAiResult,
} from '@startuphafen/startuphafen-common';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { HwkAiService } from './hwk-ai.service';

describe('HwkAiService', () => {
  let spectator: SpectatorService<HwkAiService>;
  const createService = createServiceFactory({
    service: HwkAiService,
    mocks: [TrpcService],
  });

  const mockResult: HwkAiResult = {
    classification: 'Handwerksrolle',
    branch: 'Handwerk',
    requiresPermit: true,
    shortDescription: 'Test short description',
    trades: ['Elektrotechniker (Anlage A)'],
    reasoning:
      'Die geplante Tätigkeit umfasst zulassungspflichtige Arbeiten nach Anlage A.',
  };

  beforeEach(() => {
    spectator = createService();
  });

  it('should call analyze via trpc', async () => {
    const mockAnalyze = jest.fn().mockResolvedValue(mockResult);
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      HwkAi: {
        analyze: {
          mutate: mockAnalyze,
        },
      },
    });

    const response = await spectator.service.analyze('Test', 123);

    expect(mockAnalyze).toHaveBeenCalledWith({
      description: 'Test',
      projectId: 123,
    });
    expect(response).toEqual(mockResult);
  });

  it('should return null when stored result is invalid', () => {
    expect(spectator.service.parseStoredResult(null)).toBeNull();
    expect(spectator.service.parseStoredResult('')).toBeNull();
    expect(spectator.service.parseStoredResult('not json')).toBeNull();
  });

  it('should parse stored result when valid', () => {
    const stored = JSON.stringify(mockResult);

    expect(spectator.service.parseStoredResult(stored)).toEqual(mockResult);
  });

  it('should parse stored result including reasoning field', () => {
    const stored = JSON.stringify({
      ...mockResult,
      reasoning: 'Konkrete Begründung aus dem KI-Ergebnis.',
    });

    const parsed = spectator.service.parseStoredResult(stored);

    expect(parsed?.reasoning).toBe('Konkrete Begründung aus dem KI-Ergebnis.');
  });

  it('should create answer when no existing result is found', async () => {
    const mockReadFiltered = jest.fn().mockResolvedValue([]);
    const mockCreate = jest.fn().mockResolvedValue({});
    const mockUpdate = jest.fn();

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        readFiltered: {
          query: mockReadFiltered,
        },
        create: {
          mutate: mockCreate,
        },
        update: {
          mutate: mockUpdate,
        },
      },
    });

    await spectator.service.upsertResult(1, 'St15', mockResult);

    expect(mockReadFiltered).toHaveBeenCalledWith({
      projectId: 1,
      key: HWK_AI_ANSWER_KEY,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      key: HWK_AI_ANSWER_KEY,
      projectId: 1,
      value: JSON.stringify(mockResult),
      stringValue: mockResult.classification,
      componentId: 'St15',
      xmlKey: '/',
      type: 'string',
      questionText: 'KI-Pruefung Handwerk',
      answerText: mockResult.classification,
      headerText: null,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should update answer when existing result is found', async () => {
    const mockReadFiltered = jest.fn().mockResolvedValue([
      {
        id: 12,
        key: HWK_AI_ANSWER_KEY,
        value: JSON.stringify(mockResult),
        type: 'string',
        componentId: 'St15',
        projectId: 1,
        stringValue: mockResult.classification,
        xmlKey: '/',
        questionText: 'KI-Pruefung Handwerk',
        answerText: mockResult.classification,
        headerText: null,
      },
    ]);
    const mockCreate = jest.fn();
    const mockUpdate = jest.fn().mockResolvedValue({});

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        readFiltered: {
          query: mockReadFiltered,
        },
        create: {
          mutate: mockCreate,
        },
        update: {
          mutate: mockUpdate,
        },
      },
    });

    await spectator.service.upsertResult(1, 'St15', mockResult);

    expect(mockUpdate).toHaveBeenCalledWith({
      id: 12,
      updates: {
        value: JSON.stringify(mockResult),
        stringValue: mockResult.classification,
        componentId: 'St15',
        xmlKey: '/',
        type: 'string',
        questionText: 'KI-Pruefung Handwerk',
        answerText: mockResult.classification,
        headerText: null,
      },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should upsert short description answer', async () => {
    const mockReadFiltered = jest.fn().mockResolvedValue([]);
    const mockCreate = jest.fn().mockResolvedValue({});
    const mockUpdate = jest.fn();

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        readFiltered: {
          query: mockReadFiltered,
        },
        create: {
          mutate: mockCreate,
        },
        update: {
          mutate: mockUpdate,
        },
      },
    });

    await spectator.service.upsertShortDescription(1, 'Kurztext', {
      key: 'St25',
      componentId: 'St25',
      xmlKey: 'ArtTaet/GewerbeArt',
      questionText: 'Beschreibung Deiner neuen Tätigkeit',
    });

    expect(mockReadFiltered).toHaveBeenCalledWith({
      projectId: 1,
      key: 'St25',
    });
    expect(mockCreate).toHaveBeenCalledWith({
      key: 'St25',
      projectId: 1,
      value: 'Kurztext',
      stringValue: null,
      componentId: 'St25',
      xmlKey: 'ArtTaet/GewerbeArt',
      type: 'string',
      questionText: 'Beschreibung Deiner neuen Tätigkeit',
      answerText: 'Kurztext',
      headerText: null,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should delete answers by key', async () => {
    const mockReadFiltered = jest
      .fn()
      .mockResolvedValue([{ id: 5 }, { id: 9 }]);
    const mockDelete = jest.fn().mockResolvedValue({});

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Answers: {
        readFiltered: {
          query: mockReadFiltered,
        },
        delete: {
          mutate: mockDelete,
        },
      },
    });

    await spectator.service.deleteAnswerByKey(1, 'HwkAi');

    expect(mockReadFiltered).toHaveBeenCalledWith({
      projectId: 1,
      key: 'HwkAi',
    });
    expect(mockDelete).toHaveBeenCalledWith(5);
    expect(mockDelete).toHaveBeenCalledWith(9);
  });
});
