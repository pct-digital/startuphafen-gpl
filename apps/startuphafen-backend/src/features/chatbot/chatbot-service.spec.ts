import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import {
  ChatAuthor,
  ChatMessage,
  Project,
  ShUser,
} from '@startuphafen/startuphafen-common';
import {
  DEFAULT_HWK_SOURCE_PATHS,
  EMBEDDINGS_CONFIG,
  VECTOR_STORE_CONFIG,
  VectorStoreService,
} from '../common/vector-store';
import {
  ChatbotProjectContext,
  ChatbotService,
  ChatbotUserContext,
} from './chatbot-service';
import { ERROR_MESSAGES, LLM_CONFIG, MIN_QUERY_LENGTH } from './constants';

jest.setTimeout(60_000);

const mockLLMInvoke = jest.fn().mockResolvedValue({
  content: 'This is a test response from the LLM',
});

const mockSimilaritySearchWithScore = jest.fn();

jest.mock('@langchain/mistralai', () => ({
  MistralAI: jest.fn().mockImplementation(() => ({})),
  MistralAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn(),
    embedQuery: jest.fn(),
  })),
  ChatMistralAI: jest.fn().mockImplementation(() => ({
    invoke: mockLLMInvoke,
  })),
}));

jest.mock('@langchain/community/vectorstores/pgvector', () => ({
  PGVectorStore: jest.fn().mockImplementation(() => ({
    similaritySearchWithScore: mockSimilaritySearchWithScore,
  })),
}));

const mockSemanticSearchDocuments = jest.fn();

const mockVectorStoreService = {
  semanticSearchDocuments: mockSemanticSearchDocuments,
} as unknown as VectorStoreService;

const mockVectorResults = [
  {
    id: 1,
    pageContent: 'Test document content 1',
    metadata: {
      source_path:
        'source/your-chatbot-source.pdf',
      processedAt: '2024-01-01T00:00:00.000Z',
      creationDate: '2024-01-01T00:00:00.000Z',
      chunk_index: 0,
    },
  },
  {
    id: 2,
    pageContent: 'Test document content 2',
    metadata: {
      source_path: 'source/your-chatbot-source.pdf',
      processedAt: '2024-01-02T00:00:00.000Z',
      creationDate: '2024-01-02T00:00:00.000Z',
      chunk_index: 1,
    },
  },
];

const mockUser: ShUser = {
  id: 'user-123',
  name: 'Erika Mustermann',
  roles: ['login'],
  academicTitle: 'Dr.',
  title: 'Frau',
  firstName: 'Erika',
  lastName: 'Mustermann',
  email: 'erika@example.com',
  phoneNumber: '+4912345678',
  cellPhoneNumber: '+4912345679',
  dateOfBirth: '1985-05-15',
  street: 'Beispielweg 5',
  postalCode: '12345',
  city: 'Hamburg',
  country: 'Deutschland',
  createdAt: new Date('2024-01-01T12:00:00Z'),
  inboxReference: '12345',
};

const mockProjects: Project[] = [
  {
    id: 11,
    name: 'Gruendungsvorbereitung',
    userId: mockUser.id,
    progress: 60,
    stSent: false,
    catalogueId: 'eun',
    gwSent: true,
    lastPosition: 1,
    createdAt: new Date(),
  },
];

const mockUserContext: ChatbotUserContext = {
  name: mockUser.name,
  firstName: mockUser.firstName,
  lastName: mockUser.lastName,
  city: mockUser.city,
  country: mockUser.country,
};

const mockProjectContexts: ChatbotProjectContext[] = mockProjects.map(
  (project) => ({
    name: project.name,
    catalogueId: project.catalogueId,
    progress: project.progress,
    stSent: project.stSent,
    gwSent: project.gwSent,
  })
);

describe('VectorStoreService (common)', () => {
  const mockApiKey = 'test-mistral-api-key';
  const mockDbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_password',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize MistralAIEmbeddings with correct parameters', () => {
    const { MistralAIEmbeddings } = require('@langchain/mistralai');

    new VectorStoreService(mockApiKey, mockDbConfig);

    expect(MistralAIEmbeddings).toHaveBeenCalledWith({
      apiKey: mockApiKey,
      model: EMBEDDINGS_CONFIG.model,
    });
  });

  it('should initialize PGVectorStore with correct configuration', () => {
    const {
      PGVectorStore,
    } = require('@langchain/community/vectorstores/pgvector');

    new VectorStoreService(mockApiKey, mockDbConfig);

    expect(PGVectorStore).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        postgresConnectionOptions: mockDbConfig,
        tableName: VECTOR_STORE_CONFIG.tableName,
        columns: VECTOR_STORE_CONFIG.columns,
        distanceStrategy: VECTOR_STORE_CONFIG.distanceStrategy,
      })
    );
  });

  it('should return validated results from semanticSearchDocuments', async () => {
    const service = new VectorStoreService(mockApiKey, mockDbConfig);
    mockSimilaritySearchWithScore.mockResolvedValueOnce([
      [
        {
          pageContent: 'Test content',
          metadata: {
            source_path:
              'source/your-chatbot-source.pdf',
            markdown_path: 'markdown/doc.md',
            chunk_index: 0,
            token_count: 123,
          },
          id: 1,
        },
        0.25,
      ],
    ]);

    const results = await service.semanticSearchDocuments('query', 0.5, {}, 3);

    expect(results).toHaveLength(1);
    expect(mockSimilaritySearchWithScore).toHaveBeenCalledWith('query', 3, {});
  });

  it('should allow sparse metadata from migrated documents', async () => {
    const service = new VectorStoreService(mockApiKey, mockDbConfig);
    mockSimilaritySearchWithScore.mockResolvedValueOnce([
      [
        {
          pageContent: 'Sparse metadata document',
          metadata: {
            source_path: 'source/your-hwk-legal-source.pdf',
          },
          id: 1,
        },
        0.1,
      ],
    ]);

    const results = await service.semanticSearchDocuments('query', 0.2, {}, 1);
    expect(results).toHaveLength(1);
    expect(results[0].metadata.source_path).toBe(
      'source/your-hwk-legal-source.pdf'
    );
  });
});

describe('ChatbotService', () => {
  let chatbotService: ChatbotService;
  const mockApiKey = 'test-mistral-api-key';
  const mockTopK = 5;
  const mockThreshold = 0.75;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSemanticSearchDocuments.mockResolvedValue(mockVectorResults);
    mockLLMInvoke.mockResolvedValue({
      content: 'This is a test response from the LLM',
    });
    chatbotService = new ChatbotService(
      mockApiKey,
      mockVectorStoreService,
      mockTopK,
      mockThreshold
    );
  });

  describe('constructor', () => {
    it('should create an instance with correct configuration', () => {
      // Arrange & Act
      const service = new ChatbotService(
        mockApiKey,
        mockVectorStoreService,
        mockTopK
      );

      // Assert
      expect(service).toBeInstanceOf(ChatbotService);
    });

    it('should initialize ChatMistralAI with correct parameters', () => {
      // Arrange
      const { ChatMistralAI } = require('@langchain/mistralai');

      // Act
      new ChatbotService(mockApiKey, mockVectorStoreService, mockTopK);

      // Assert
      expect(ChatMistralAI).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        model: LLM_CONFIG.model,
        temperature: LLM_CONFIG.temperature,
        maxTokens: LLM_CONFIG.maxTokens,
      });
    });

    it('should use DEFAULT_TOP_K_RESULTS when topK not provided', () => {
      // Arrange & Act
      const service = new ChatbotService(mockApiKey, mockVectorStoreService);

      // Assert
      expect(service).toBeInstanceOf(ChatbotService);
    });

    it('should accept custom topK value', () => {
      // Arrange
      const customTopK = 10;

      // Act
      const service = new ChatbotService(
        mockApiKey,
        mockVectorStoreService,
        customTopK
      );

      // Assert
      expect(service).toBeInstanceOf(ChatbotService);
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      // Reset to default mock values for this describe block
      mockSemanticSearchDocuments.mockResolvedValue(mockVectorResults);
      mockLLMInvoke.mockResolvedValue({
        content: 'This is a test response from the LLM',
      });
    });

    it('should process a simple conversation with one message', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the application process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(history[0]);
      expect(result[1].author).toBe('agent');
      expect(result[1].content).toBe('This is a test response from the LLM');
    });

    it('should process conversation with multiple messages', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Hello',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
        {
          content: 'Hello! How can I help you?',
          author: ChatAuthor.agent,
          createdAt: new Date(),
        },
        {
          content: 'What is the application process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(4);
      expect(result[3].author).toBe('agent');
      expect(mockSemanticSearchDocuments).toHaveBeenCalled();
      expect(mockLLMInvoke).toHaveBeenCalled();
    });

    it('should call vectorStoreService.semanticSearchDocuments with correct parameters', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Tell me about funding options',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      await chatbotService.chat(history);

      // Assert
      expect(mockSemanticSearchDocuments).toHaveBeenCalledWith(
        expect.any(String),
        mockThreshold,
        {}
      );
      expect(mockSemanticSearchDocuments).toHaveBeenCalledTimes(1);
    });

    it('should generate search query using LLM', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Can you please explain the application process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      await chatbotService.chat(history);

      // Assert
      // LLM is called twice: once for search query optimization, once for response generation
      expect(mockLLMInvoke).toHaveBeenCalledTimes(2);
      expect(mockSemanticSearchDocuments).toHaveBeenCalled();
    });

    it('should use original query if search query generation fails', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What are the requirements?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke
        .mockRejectedValueOnce(new Error('Search query generation failed'))
        .mockResolvedValueOnce({
          content: 'Here is the response',
        });

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(mockSemanticSearchDocuments).toHaveBeenCalledWith(
        'What are the requirements?',
        mockThreshold,
        {}
      );
      expect(result[1].author).toBe('agent');
    });

    it('should skip vector search for short queries', async () => {
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Short',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      mockLLMInvoke
        .mockResolvedValueOnce({
          content: 'a'.repeat(MIN_QUERY_LENGTH - 1),
        })
        .mockResolvedValueOnce({
          content: 'LLM response',
        });

      const result = await chatbotService.chat(history);

      expect(mockSemanticSearchDocuments).not.toHaveBeenCalled();
      expect(result[1].content).toBe('LLM response');
    });

    it('should include retrieved documents in the prompt', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      await chatbotService.chat(history);

      // Assert
      expect(mockLLMInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(SystemMessage),
          expect.any(HumanMessage),
        ])
      );
    });

    it('should exclude HWK and unknown-source documents from chatbot context', async () => {
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Welche Inhalte gibt es?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      mockSemanticSearchDocuments.mockResolvedValueOnce([
        {
          id: 11,
          pageContent: 'General chatbot context',
          metadata: {
            source_path:
              'source/your-chatbot-source.pdf',
          },
        },
        {
          id: 12,
          pageContent: 'HWK only context',
          metadata: {
            source_path: DEFAULT_HWK_SOURCE_PATHS[0],
          },
        },
        {
          id: 13,
          pageContent: 'Unknown source context',
          metadata: {
            source_path: 'source/unknown.pdf',
          },
        },
        {
          id: 14,
          pageContent: 'Missing source path context',
          metadata: {},
        },
      ]);

      mockLLMInvoke
        .mockResolvedValueOnce({
          content: 'optimierter query',
        })
        .mockResolvedValueOnce({
          content: 'This is a test response from the LLM',
        });

      await chatbotService.chat(history);

      const responseCall = mockLLMInvoke.mock.calls[1];
      expect(responseCall).toBeDefined();

      const responseMessages = responseCall?.[0];
      if (
        !Array.isArray(responseMessages) ||
        !(responseMessages[0] instanceof SystemMessage)
      ) {
        throw new Error('Expected SystemMessage in response prompt call');
      }

      const systemPromptContent = responseMessages[0].content;
      expect(typeof systemPromptContent).toBe('string');
      if (typeof systemPromptContent === 'string') {
        expect(systemPromptContent).toContain('General chatbot context');
        expect(systemPromptContent).not.toContain('HWK only context');
        expect(systemPromptContent).not.toContain('Unknown source context');
        expect(systemPromptContent).not.toContain(
          'Missing source path context'
        );
      }
    });

    it('should filter chatbot corpus before truncating to topK', async () => {
      const topKOneService = new ChatbotService(
        mockApiKey,
        mockVectorStoreService,
        1,
        mockThreshold
      );
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Welche Inhalte gibt es?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      const candidateDocuments = [
        {
          id: 21,
          pageContent: 'HWK only context',
          metadata: {
            source_path: DEFAULT_HWK_SOURCE_PATHS[0],
          },
        },
        {
          id: 22,
          pageContent: 'Unknown source context',
          metadata: {
            source_path: 'source/unknown.pdf',
          },
        },
        {
          id: 23,
          pageContent: 'General chatbot context',
          metadata: {
            source_path:
              'source/your-chatbot-source.pdf',
          },
        },
      ];

      mockSemanticSearchDocuments.mockImplementationOnce(
        async (_query, _threshold, _metadataFilter, topK) => {
          return typeof topK === 'number'
            ? candidateDocuments.slice(0, topK)
            : candidateDocuments;
        }
      );
      mockLLMInvoke
        .mockResolvedValueOnce({
          content: 'optimierter query',
        })
        .mockResolvedValueOnce({
          content: 'This is a test response from the LLM',
        });

      await topKOneService.chat(history);

      expect(mockSemanticSearchDocuments).toHaveBeenCalledWith(
        expect.any(String),
        mockThreshold,
        {}
      );

      const responseCall = mockLLMInvoke.mock.calls[1];
      expect(responseCall).toBeDefined();

      const responseMessages = responseCall?.[0];
      if (
        !Array.isArray(responseMessages) ||
        !(responseMessages[0] instanceof SystemMessage)
      ) {
        throw new Error('Expected SystemMessage in response prompt call');
      }

      const systemPromptContent = responseMessages[0].content;
      expect(typeof systemPromptContent).toBe('string');
      if (typeof systemPromptContent === 'string') {
        expect(systemPromptContent).toContain('General chatbot context');
        expect(systemPromptContent).not.toContain('HWK only context');
        expect(systemPromptContent).not.toContain('Unknown source context');
      }
    });

    it('should handle empty retrieved documents', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockSemanticSearchDocuments.mockResolvedValue([]);

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(mockLLMInvoke).toHaveBeenCalled();
    });

    it('should include minimized user and project context without internal metadata', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Welche Förderungen passen zu mir?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      await chatbotService.chat(history, mockUserContext, mockProjectContexts);

      // Assert
      const systemMessageCall = mockLLMInvoke.mock.calls.find((call) => {
        const [messages] = call;
        if (
          !Array.isArray(messages) ||
          !(messages[0] instanceof SystemMessage)
        ) {
          return false;
        }
        const content = (messages[0] as SystemMessage).content;
        if (typeof content !== 'string') {
          return false;
        }
        return content.includes(`Anzeigename: ${mockUser.name}`);
      });

      expect(systemMessageCall).toBeDefined();
      const [messages] = systemMessageCall ?? [];
      const systemMessage = (messages as SystemMessage[])[0];
      const systemMessageContent =
        typeof systemMessage.content === 'string'
          ? systemMessage.content
          : JSON.stringify(systemMessage.content);
      expect(systemMessageContent).toContain(`Anzeigename: ${mockUser.name}`);
      expect(systemMessageContent).toContain(`Stadt: ${mockUser.city}`);
      expect(systemMessageContent).toContain(`Land: ${mockUser.country}`);
      expect(systemMessageContent).toContain(
        `Projektname: ${mockProjects[0].name}`
      );
      expect(systemMessageContent).toContain(
        `Projektkatalog: ${mockProjects[0].catalogueId}`
      );
      expect(systemMessageContent).toContain(
        `Fortschritt: ${mockProjects[0].progress}`
      );
      expect(systemMessageContent).not.toContain('Benutzer-ID:');
      expect(systemMessageContent).not.toContain('E-Mail-Adresse:');
      expect(systemMessageContent).not.toContain('Rollen:');
      expect(systemMessageContent).not.toContain('Projekt-ID:');
      expect(systemMessageContent).not.toContain('Telefonnummer:');
      expect(systemMessageContent).not.toContain('Geburtsdatum:');
      expect(systemMessageContent).not.toContain('Postleitzahl:');
    });

    it('should throw error for empty history', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] =
        [];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('agent');
      expect(result[0].content).toBe(ERROR_MESSAGES.genericError);
    });

    it('should throw error when last message is not from human', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Hello',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
        {
          content: 'Hello! How can I help?',
          author: ChatAuthor.agent,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[2].author).toBe('agent');
      expect(result[2].content).toBe(ERROR_MESSAGES.genericError);
    });

    it('should handle rate limit errors', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke.mockRejectedValue(new Error('rate limit exceeded'));

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(result[1].content).toBe(ERROR_MESSAGES.rateLimit);
    });

    it('should handle API key errors', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke.mockRejectedValue(new Error('Invalid API key provided'));

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(result[1].content).toBe(ERROR_MESSAGES.apiKeyError);
    });

    it('should handle generic LLM errors', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke.mockRejectedValue(new Error('Unknown error'));

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(result[1].content).toBe(ERROR_MESSAGES.responseGenerationError);
    });

    it('should handle non-string LLM responses', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke.mockResolvedValue({
        content: ['array', 'response'],
      });

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(result[1].content).toBe(ERROR_MESSAGES.insufficientResponse);
    });

    it('should preserve conversation history in prompts', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'Hello',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
        {
          content: 'Hi! How can I help?',
          author: ChatAuthor.agent,
          createdAt: new Date(),
        },
        {
          content: 'What is the application process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      await chatbotService.chat(history);

      // Assert
      expect(mockLLMInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(SystemMessage),
          expect.any(HumanMessage),
          expect.any(AIMessage),
          expect.any(HumanMessage),
        ])
      );
    });

    it('should handle vector store service errors', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockSemanticSearchDocuments.mockRejectedValue(
        new Error('Vector store connection error')
      );

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(result[1].content).toBe(ERROR_MESSAGES.genericError);
    });

    it('should trim whitespace from LLM responses', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke.mockResolvedValue({
        content: '  Response with whitespace  ',
      });

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result[1].content).toBe('Response with whitespace');
    });

    it('should handle system messages in history', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'System initialization',
          author: ChatAuthor.system,
          createdAt: new Date(),
        },
        {
          content: 'Hello',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
        {
          content: 'Hi there!',
          author: ChatAuthor.agent,
          createdAt: new Date(),
        },
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(5);
      expect(result[4].author).toBe('agent');
      expect(mockLLMInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(SystemMessage)])
      );
    });

    it('should handle long conversation histories', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] =
        [];
      for (let i = 0; i < 20; i++) {
        history.push({
          content: `Message ${i}`,
          author: i % 2 === 0 ? ChatAuthor.human : ChatAuthor.agent,
          createdAt: new Date(),
        });
      }
      history.push({
        content: 'Final question',
        author: ChatAuthor.human,
        createdAt: new Date(),
      });

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(22);
      expect(result[21].author).toBe('agent');
      expect(mockLLMInvoke).toHaveBeenCalled();
    });

    it('should handle special characters in user messages', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What about @#$% special characters & symbols?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(mockSemanticSearchDocuments).toHaveBeenCalled();
    });

    it('should handle very long user messages', async () => {
      // Arrange
      const longMessage = 'a'.repeat(5000);
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: longMessage,
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
      expect(mockSemanticSearchDocuments).toHaveBeenCalled();
    });

    it('should handle empty content in messages', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: '',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockSemanticSearchDocuments).toHaveBeenCalled();
    });

    it('should call LLM twice - once for query optimization and once for response', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockLLMInvoke
        .mockResolvedValueOnce({ content: 'optimized query' })
        .mockResolvedValueOnce({ content: 'final response' });

      // Act
      await chatbotService.chat(history);

      // Assert
      expect(mockLLMInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple consecutive chat calls', async () => {
      // Arrange
      const history1: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] =
        [
          {
            content: 'First question',
            author: ChatAuthor.human,
            createdAt: new Date(),
          },
        ];
      const history2: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] =
        [
          {
            content: 'Second question',
            author: ChatAuthor.human,
            createdAt: new Date(),
          },
        ];

      // Act
      await chatbotService.chat(history1);
      await chatbotService.chat(history2);

      // Assert
      expect(mockLLMInvoke).toHaveBeenCalledTimes(4); // 2 calls per chat
      expect(mockSemanticSearchDocuments).toHaveBeenCalledTimes(2);
    });

    it('should format documents correctly in the prompt', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];

      // Act
      await chatbotService.chat(history);

      // Assert
      const callArgs = mockLLMInvoke.mock.calls[1][0];
      const systemMessage = callArgs.find(
        (msg: any) => msg instanceof SystemMessage
      );
      expect(systemMessage.content).toContain('[Document 1]');
      expect(systemMessage.content).toContain('Test document content 1');
      expect(systemMessage.content).toContain('[Document 2]');
      expect(systemMessage.content).toContain('Test document content 2');
    });

    it('should handle null or undefined values gracefully', async () => {
      // Arrange
      const history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[] = [
        {
          content: 'What is the process?',
          author: ChatAuthor.human,
          createdAt: new Date(),
        },
      ];
      mockSemanticSearchDocuments.mockResolvedValue([
        {
          id: 1,
          pageContent: null,
          embedding: [0.1, 0.2],
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      ]);

      // Act
      const result = await chatbotService.chat(history);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].author).toBe('agent');
    });
  });
});
