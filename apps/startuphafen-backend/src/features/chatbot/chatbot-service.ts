import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatMistralAI } from '@langchain/mistralai';
import {
  ChatAuthor,
  ChatMessage,
  Project,
  ShUser,
  VectorEmbedding,
} from '@startuphafen/startuphafen-common';
import {
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_TOP_K_RESULTS,
  ERROR_MESSAGES,
  LLM_CONFIG,
  MIN_QUERY_LENGTH,
  SYSTEM_PROMPTS,
} from './constants';
import {
  AiCorpusConfig,
  DEFAULT_HWK_SOURCE_PATHS,
  DocumentResult,
  VectorStoreService,
  filterDocumentsForCorpus,
} from '../common/vector-store';

const DEFAULT_AI_CORPUS_CONFIG: AiCorpusConfig = {
  hwkSourcePaths: DEFAULT_HWK_SOURCE_PATHS,
  unknownSourcePolicy: 'exclude',
};

export type ChatbotUserContext = Pick<
  ShUser,
  'name' | 'firstName' | 'lastName' | 'city' | 'country'
>;
export type ChatbotProjectContext = Pick<
  Project,
  'name' | 'catalogueId' | 'progress' | 'stSent' | 'gwSent'
>;

export class ChatbotService {
  private llmClient: ChatMistralAI;
  private vectorStoreService: VectorStoreService;
  private distanceThreshold: number;
  private topKResults: number;
  private aiCorpusConfig: AiCorpusConfig;

  constructor(
    mistralApiKey: string,
    vectorStoreService: VectorStoreService,
    topKResults: number = DEFAULT_TOP_K_RESULTS,
    distanceThreshold: number = DEFAULT_DISTANCE_THRESHOLD,
    aiCorpusConfig: AiCorpusConfig = DEFAULT_AI_CORPUS_CONFIG
  ) {
    this.llmClient = new ChatMistralAI({
      apiKey: mistralApiKey,
      model: LLM_CONFIG.model,
      temperature: LLM_CONFIG.temperature,
      maxTokens: LLM_CONFIG.maxTokens,
    });

    this.vectorStoreService = vectorStoreService;
    this.topKResults = topKResults;
    this.distanceThreshold = distanceThreshold;
    this.aiCorpusConfig = aiCorpusConfig;
  }

  async chat(
    history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[],
    user?: ChatbotUserContext,
    projects: ChatbotProjectContext[] = []
  ): Promise<Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[]> {
    try {
      if (!history || history.length === 0) {
        console.error('[ChatbotService] Empty history provided');
        throw new Error(ERROR_MESSAGES.emptyHistory);
      }

      const lastMessage = history[history.length - 1];

      if (lastMessage.author !== 'human') {
        console.error('[ChatbotService] Last message is not from human', {
          author: lastMessage.author,
        });
        throw new Error(ERROR_MESSAGES.lastMessageNotHuman);
      }

      const humanMessage = lastMessage.content;

      const searchQuery = await this.generateSearchQuery(humanMessage);

      const retrievedDocs = await this.searchVectorEmbeddings(searchQuery);

      const enhancedPrompt = this.buildEnhancedPrompt(
        history,
        retrievedDocs,
        humanMessage,
        user,
        projects
      );

      const agentResponse = await this.generateAgentResponse(enhancedPrompt);

      const newMessage: Pick<ChatMessage, 'author' | 'content' | 'createdAt'> =
        {
          content: agentResponse,
          author: ChatAuthor.agent,
          createdAt: new Date(),
        };

      return [...history, newMessage];
    } catch (error) {
      console.error('[ChatbotService] Error in chat()', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorMessage: Pick<
        ChatMessage,
        'author' | 'content' | 'createdAt'
      > = {
        content: ERROR_MESSAGES.genericError,
        author: ChatAuthor.agent,
        createdAt: new Date(),
      };

      return [...history, errorMessage];
    }
  }

  private async searchVectorEmbeddings(
    query: string
  ): Promise<VectorEmbedding[]> {
    if (!query || query.trim().length < MIN_QUERY_LENGTH) {
      return [];
    }

    const documents = await this.vectorStoreService.semanticSearchDocuments(
      query,
      this.distanceThreshold,
      {}
    );

    const chatbotDocuments = filterDocumentsForCorpus(
      documents,
      'chatbot',
      this.aiCorpusConfig
    ).slice(0, this.topKResults);

    return this.mapDocumentsToEmbeddings(chatbotDocuments);
  }

  private mapDocumentsToEmbeddings(
    documents: DocumentResult[]
  ): VectorEmbedding[] {
    return documents.map((doc) => ({
      ...this.mapDocumentDates(doc),
      id: doc.id,
      content: doc.pageContent,
      embedding: doc.pageContent,
      metadata: doc.metadata,
    }));
  }

  private mapDocumentDates(
    document: DocumentResult
  ): Pick<VectorEmbedding, 'createdAt' | 'updatedAt'> {
    const now = new Date();
    const createdAt = this.parseMetadataDate(document.metadata.creationDate);
    const updatedAt = this.parseMetadataDate(document.metadata.processedAt);

    return {
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? createdAt ?? now,
    };
  }

  private parseMetadataDate(value: string | undefined): Date | null {
    if (typeof value !== 'string') {
      return null;
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private async generateSearchQuery(humanMessage: string): Promise<string> {
    try {
      const response = await this.llmClient.invoke([
        new SystemMessage(SYSTEM_PROMPTS.searchQueryOptimizer),
        new HumanMessage(`User question: ${humanMessage}`),
      ]);

      const searchQuery =
        typeof response.content === 'string'
          ? response.content.trim()
          : humanMessage;

      return searchQuery;
    } catch (error) {
      console.error('[ChatbotService] Error generating search query', {
        error: error instanceof Error ? error.message : String(error),
        fallbackToOriginal: true,
      });
      return humanMessage;
    }
  }

  private buildEnhancedPrompt(
    history: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>[],
    retrievedDocs: VectorEmbedding[],
    humanMessage: string,
    user?: ChatbotUserContext,
    projects: ChatbotProjectContext[] = []
  ) {
    const contextText =
      retrievedDocs.length > 0
        ? retrievedDocs
            .map((doc, idx) => {
              const content = doc.content || '';
              return `[Document ${idx + 1}]\n${content}`;
            })
            .join('\n\n')
        : ERROR_MESSAGES.noRelevantContext;

    const formattedHistory = history
      .slice(0, -1)
      .map((msg) => this.convertToLangChainMessage(msg));

    const userInformation = user
      ? this.formatUserInformation(user)
      : 'Keine relevanten Benutzerinformationen verfügbar.';
    const projectInformation = this.formatProjectInformation(projects);
    const systemPrompt = new SystemMessage(
      SYSTEM_PROMPTS.mainAssistant(
        contextText,
        userInformation,
        projectInformation
      )
    );

    const messages = [
      systemPrompt,
      ...formattedHistory,
      new HumanMessage(humanMessage),
    ];

    return messages;
  }

  private formatProjectInformation(projects: ChatbotProjectContext[]): string {
    if (!projects.length) {
      return 'Keine relevanten Projektinformationen verfügbar.';
    }

    const sections: string[] = [];

    for (const [index, project] of projects.entries()) {
      sections.push(
        `[Project ${index + 1}]`,
        `Projektname: ${this.formatValue(project.name)}`,
        `Projektkatalog: ${this.formatValue(project.catalogueId)}`,
        `Fortschritt: ${this.formatValue(project.progress)}`,
        `Steuer-Erklärung gesendet: ${this.formatValue(project.stSent)}`,
        `GEWA gesendet: ${this.formatValue(project.gwSent)}`,
        ''
      );
    }

    if (sections.at(-1) === '') {
      sections.pop();
    }

    return sections.join('\n');
  }

  private formatValue(value: unknown): string {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'keine Angabe';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : 'keine Angabe';
    }

    if (value === null || value === undefined) {
      return 'keine Angabe';
    }

    return String(value);
  }

  private formatUserInformation(user: ChatbotUserContext): string {
    const entries: [string, unknown][] = [
      ['Anzeigename', this.buildDisplayName(user)],
      ['Stadt', user.city],
      ['Land', user.country],
    ];

    return entries
      .map(([label, value]) => `${label}: ${this.formatValue(value)}`)
      .join('\n');
  }

  private buildDisplayName(user: ChatbotUserContext): string | null {
    const explicitName = user.name?.trim();
    if (explicitName && explicitName.length > 0) {
      return explicitName;
    }

    const combinedName = `${user.firstName} ${user.lastName}`.trim();
    return combinedName.length > 0 ? combinedName : null;
  }

  private async generateAgentResponse(
    messages: BaseMessage[]
  ): Promise<string> {
    try {
      const response = await this.llmClient.invoke(messages);

      const responseText =
        typeof response.content === 'string'
          ? response.content.trim()
          : ERROR_MESSAGES.insufficientResponse;

      return responseText;
    } catch (error) {
      console.error('[ChatbotService] Error generating agent response', {
        error: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      });

      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          console.error('[ChatbotService] Rate limit error detected');
          return ERROR_MESSAGES.rateLimit;
        } else if (error.message.includes('API key')) {
          console.error('[ChatbotService] API key error detected');
          return ERROR_MESSAGES.apiKeyError;
        }
      }

      return ERROR_MESSAGES.responseGenerationError;
    }
  }

  private convertToLangChainMessage(
    message: Pick<ChatMessage, 'author' | 'content' | 'createdAt'>
  ): HumanMessage | AIMessage | SystemMessage {
    switch (message.author) {
      case 'human':
        return new HumanMessage(message.content);
      case 'agent':
        return new AIMessage(message.content);
      case 'system':
        return new SystemMessage(message.content);
      default:
        return new HumanMessage(message.content);
    }
  }
}
