import { AIMessage } from '@langchain/core/messages';
import { HwkAiResultSchema } from '@startuphafen/startuphafen-common';
import { ERROR_MESSAGES, LLM_CONFIG } from './constants';
import { HwkAiService } from './hwk-ai-service';

jest.setTimeout(60_000);

const mockStructuredOutputInvoke = jest.fn();
const mockWithStructuredOutput = jest.fn(() => ({
  invoke: mockStructuredOutputInvoke,
}));
const mockChatMistralAiInstance = {
  withStructuredOutput: mockWithStructuredOutput,
};

jest.mock('@langchain/mistralai', () => ({
  ChatMistralAI: jest.fn(() => mockChatMistralAiInstance),
}));

const mockSemanticSearchDocuments = jest.fn();
const mockVectorStoreService = {
  semanticSearchDocuments: mockSemanticSearchDocuments,
};

const mockDocuments = [
  {
    pageContent: 'Doc content',
    metadata: {
      title: 'Doc',
      author: null,
      source: 'doc.pdf',
      numPages: 1,
      processedAt: '2024-01-01T00:00:00.000Z',
      creationDate: '2024-01-01T00:00:00.000Z',
      paragraphIndex: 0,
      dataset: 'hwk',
    },
    id: 1,
  },
];

const validResult = {
  classification: 'Handwerksrolle',
  branch: 'Handwerk',
  requiresPermit: true,
  shortDescription: 'Test short description',
  trades: ['Elektrotechniker (Anlage A)'],
  reasoning:
    'Die elektrotechnische Tätigkeit ist dem zulassungspflichtigen Handwerk zuzuordnen.',
};

describe('HwkAiService', () => {
  let service: HwkAiService;
  const mockApiKey = 'test-api-key';
  const mockTopK = 4;
  const mockThreshold = 0.8;
  const description = 'This is a long enough description';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSemanticSearchDocuments.mockResolvedValue(mockDocuments);
    mockStructuredOutputInvoke.mockResolvedValue({
      raw: new AIMessage(''),
      parsed: validResult,
    });
    service = new HwkAiService(
      mockApiKey,
      mockVectorStoreService,
      mockThreshold,
      mockTopK
    );
  });

  it('should initialize ChatMistralAI and the structured output client', () => {
    const { ChatMistralAI } = require('@langchain/mistralai');

    new HwkAiService(
      mockApiKey,
      mockVectorStoreService,
      mockThreshold,
      mockTopK
    );

    expect(ChatMistralAI).toHaveBeenCalledWith({
      apiKey: mockApiKey,
      model: LLM_CONFIG.model,
      temperature: LLM_CONFIG.temperature,
    });
    expect(mockWithStructuredOutput).toHaveBeenCalledWith(HwkAiResultSchema, {
      includeRaw: true,
    });
  });

  it('should retrieve context once and classify in a single structured call', async () => {
    const result = await service.analyze(description);

    expect(mockSemanticSearchDocuments).toHaveBeenCalledTimes(1);
    expect(mockSemanticSearchDocuments).toHaveBeenCalledWith(
      description,
      mockThreshold,
      {},
      mockTopK
    );
    expect(mockStructuredOutputInvoke).toHaveBeenCalledTimes(1);

    const messages = mockStructuredOutputInvoke.mock.calls[0][0];
    // the human message carries both the description and the retrieved context
    expect(messages[1].content).toContain(description);
    expect(messages[1].content).toContain('[Treffer 1]');
    expect(messages[1].content).toContain('Doc content');
    expect(result).toEqual(validResult);
  });

  it('should pass the "no relevant context" notice into the prompt when the store returns nothing', async () => {
    mockSemanticSearchDocuments.mockResolvedValue([]);

    await service.analyze(description);

    const messages = mockStructuredOutputInvoke.mock.calls[0][0];
    expect(messages[1].content).toContain(ERROR_MESSAGES.noRelevantContext);
  });

  it('should retry the structured output and return fallback only after all attempts stay invalid', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockStructuredOutputInvoke.mockResolvedValue({
      raw: new AIMessage(''),
      parsed: null,
    });

    const result = await service.analyze(description);

    expect(result.classification).toBe('kein Handwerksrolle');
    // retried up to the configured maximum before falling back
    expect(mockStructuredOutputInvoke).toHaveBeenCalledTimes(3);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[HwkAiService] Invalid structured response'),
      expect.objectContaining({ issues: expect.any(Array) })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[HwkAiService] Structured response invalid after retries, using fallback',
      expect.objectContaining({ issues: expect.any(Array) })
    );
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should recover on a retry when the first structured output is invalid', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockStructuredOutputInvoke
      .mockResolvedValueOnce({ raw: new AIMessage(''), parsed: null })
      .mockResolvedValueOnce({ raw: new AIMessage(''), parsed: validResult });

    const result = await service.analyze(description);

    expect(result).toEqual(validResult);
    expect(mockStructuredOutputInvoke).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });

  it('should return fallback result when the structuring invocation throws', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockStructuredOutputInvoke.mockRejectedValueOnce(
      new Error('Structuring failed')
    );

    const result = await service.analyze(description);

    expect(result.classification).toBe('kein Handwerksrolle');
    expect(result.reasoning).toContain('Fallback-Einordnung');
    consoleErrorSpy.mockRestore();
  });

  it('should return fallback result when description is empty', async () => {
    const result = await service.analyze('   ');

    expect(mockSemanticSearchDocuments).not.toHaveBeenCalled();
    expect(mockStructuredOutputInvoke).not.toHaveBeenCalled();
    expect(result.classification).toBe('kein Handwerksrolle');
    expect(result.branch).toBeNull();
  });

  it('should normalize abbreviated known trades from raw structured output', async () => {
    mockStructuredOutputInvoke.mockResolvedValue({
      raw: new AIMessage({
        content: '',
        tool_calls: [
          {
            id: 'tool-call-1',
            name: 'extract',
            type: 'tool_call',
            args: {
              classification: 'handwerksähnlichen Gewerbebetriebe',
              branch: 'Tourismus, Gastronomie & Gastgewerbe',
              requiresPermit: true,
              shortDescription:
                'Betrieb eines Eisladens mit Herstellung und Vertrieb von Speiseeis sowie ueblichem Zubehoer an mehreren Standorten.',
              trades: ['Speiseeishersteller (Anlage B2)'],
              reasoning:
                'Die Taetigkeit betrifft die Herstellung und den Vertrieb von Speiseeis.',
            },
          },
        ],
      }),
      parsed: null,
    });

    const result = await service.analyze(description);

    expect(result.trades).toEqual([
      'Speiseeishersteller (mit Vertrieb von Speiseeis mit üblichem Zubehör) (Anlage B2)',
    ]);
  });
});
