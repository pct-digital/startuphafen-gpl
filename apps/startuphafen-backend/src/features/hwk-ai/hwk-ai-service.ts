import {
  HumanMessage,
  SystemMessage,
  isAIMessage,
  isBaseMessage,
} from '@langchain/core/messages';
import { ChatMistralAI } from '@langchain/mistralai';
import {
  HWK_AI_KNOWN_TRADES,
  HwkAiResult,
  HwkAiResultSchema,
} from '@startuphafen/startuphafen-common';
import {
  VectorDocumentResult,
  VectorStoreService,
} from '../common/vector-store';
import {
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_TOP_K_RESULTS,
  ERROR_MESSAGES,
  LLM_CONFIG,
  MIN_QUERY_LENGTH,
  SYSTEM_PROMPTS,
} from './constants';

// The structured-output LLM call intermittently returns null/invalid JSON
// (observed on staging: "Expected object, received null"). Each attempt is a
// cheap formatting call on top of the already-computed agent answer, so we
// retry a few times before giving up and returning the fallback.
const STRUCTURED_OUTPUT_MAX_ATTEMPTS = 3;

const FALLBACK_RESULT: HwkAiResult = {
  classification: 'kein Handwerksrolle',
  branch: null,
  requiresPermit: true,
  shortDescription:
    'Die Zuordnung konnte nicht sicher abgeleitet werden. Bitte konkretisiere die geplanten Arbeiten.',
  trades: ['Keine eindeutige Zuordnung gemäß Anlage A, B1 oder B2 möglich.'],
  reasoning:
    'Fallback-Einordnung, weil die Angaben nicht ausreichend für eine belastbare HWK-Zuordnung waren.',
};

type VectorSearchClient = Pick<VectorStoreService, 'semanticSearchDocuments'>;
type StructuredOutputClient = {
  invoke(input: unknown): Promise<{
    raw: unknown;
    parsed: unknown;
  }>;
};

export class HwkAiService {
  private readonly vectorStoreService: VectorSearchClient;
  private readonly threshold: number;
  private readonly topKResults: number;
  private readonly structuredOutputClient: StructuredOutputClient;

  constructor(
    mistralApiKey: string,
    vectorStoreService: VectorSearchClient,
    threshold: number = DEFAULT_DISTANCE_THRESHOLD,
    topKResults: number = DEFAULT_TOP_K_RESULTS
  ) {
    this.vectorStoreService = vectorStoreService;
    this.threshold = threshold;
    this.topKResults = topKResults;
    const llmClient = new ChatMistralAI({
      apiKey: mistralApiKey,
      model: LLM_CONFIG.model,
      temperature: LLM_CONFIG.temperature,
    });
    this.structuredOutputClient =
      llmClient.withStructuredOutput(HwkAiResultSchema, { includeRaw: true });
  }

  async analyze(description: string): Promise<HwkAiResult> {
    const normalizedDescription = description.trim();
    if (normalizedDescription.length === 0) {
      return FALLBACK_RESULT;
    }

    try {
      // Retrieve the relevant legal context once, then classify in a single
      // LLM call. This replaces the previous multi-round-trip ReAct agent and
      // cuts latency ~3-5x (the agent loop dominated the response time).
      const context = await this.runVectorSearch(
        normalizedDescription,
        this.topKResults
      );

      let lastIssues: unknown = null;
      for (
        let attempt = 1;
        attempt <= STRUCTURED_OUTPUT_MAX_ATTEMPTS;
        attempt++
      ) {
        const structuredResponse = await this.structuredOutputClient.invoke([
          new SystemMessage(SYSTEM_PROMPTS.singleShotClassifier),
          new HumanMessage(
            this.buildSingleShotPrompt(normalizedDescription, context)
          ),
        ]);

        const extractedResult = this.extractStructuredResult(structuredResponse);
        if (extractedResult !== null) {
          return extractedResult;
        }

        const parsedStructuredResponse = HwkAiResultSchema.safeParse(
          structuredResponse.parsed
        );
        lastIssues = parsedStructuredResponse.success
          ? []
          : parsedStructuredResponse.error.issues;
        console.warn(
          `[HwkAiService] Invalid structured response (attempt ${attempt}/${STRUCTURED_OUTPUT_MAX_ATTEMPTS})`,
          { issues: lastIssues }
        );
      }

      console.error(
        '[HwkAiService] Structured response invalid after retries, using fallback',
        { issues: lastIssues }
      );
      return FALLBACK_RESULT;
    } catch (error) {
      console.error('[HwkAiService] analyze failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return FALLBACK_RESULT;
    }
  }

  private async runVectorSearch(query: string, topK?: number): Promise<string> {
    const documents = await this.searchDocuments(query, topK);
    if (documents.length === 0) {
      return ERROR_MESSAGES.noRelevantContext;
    }

    return this.formatDocumentsForTool(documents);
  }

  private async searchDocuments(
    query: string,
    topK?: number
  ): Promise<VectorDocumentResult[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    return this.vectorStoreService.semanticSearchDocuments(
      normalizedQuery,
      this.threshold,
      {},
      topK ?? this.topKResults
    );
  }

  private formatDocumentsForTool(documents: VectorDocumentResult[]): string {
    return documents
      .map(
        (document, index) =>
          `[Treffer ${index + 1}] ${document.pageContent.trim()}`
      )
      .join('\n\n');
  }

  private buildSingleShotPrompt(description: string, context: string): string {
    return [
      '[Tätigkeitsbeschreibung]',
      description,
      '',
      '[Rechtskontext aus der Wissensbasis]',
      context,
    ].join('\n');
  }

  private extractStructuredResult(structuredResponse: {
    raw: unknown;
    parsed: unknown;
  }): HwkAiResult | null {
    const parsedStructuredResponse = HwkAiResultSchema.safeParse(
      structuredResponse.parsed
    );
    if (parsedStructuredResponse.success) {
      return parsedStructuredResponse.data;
    }

    const rawArgs = this.extractRawStructuredArgs(structuredResponse.raw);
    if (rawArgs === null) {
      return null;
    }

    const parsedFallbackResult = HwkAiResultSchema.safeParse(
      this.normalizeStructuredResult(rawArgs)
    );

    if (!parsedFallbackResult.success) {
      return null;
    }

    return parsedFallbackResult.data;
  }

  private extractRawStructuredArgs(rawStructuredResponse: unknown): unknown | null {
    if (!isBaseMessage(rawStructuredResponse) || !isAIMessage(rawStructuredResponse)) {
      return null;
    }

    const toolCalls = rawStructuredResponse.tool_calls;
    if (toolCalls === undefined) {
      return null;
    }

    const firstToolCall = toolCalls[0];
    if (firstToolCall === undefined) {
      return null;
    }

    return firstToolCall.args;
  }

  private normalizeStructuredResult(value: unknown): unknown {
    if (!this.isRecord(value)) {
      return value;
    }

    const normalizedTrades = this.normalizeTrades(value['trades']);
    if (normalizedTrades === null) {
      return value;
    }

    return {
      ...value,
      trades: normalizedTrades,
    };
  }

  private normalizeTrades(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const normalizedTrades: string[] = [];

    for (const entry of value) {
      if (typeof entry !== 'string') {
        return null;
      }

      normalizedTrades.push(this.normalizeTrade(entry));
    }

    return normalizedTrades;
  }

  private normalizeTrade(value: string): string {
    const normalizedValue = value.trim();
    if (HWK_AI_KNOWN_TRADES.some((trade) => trade === normalizedValue)) {
      return normalizedValue;
    }

    const suffixMatch = normalizedValue.match(/\((Anlage (?:A|B1|B2))\)\s*$/);
    if (suffixMatch === null || suffixMatch.index === undefined) {
      return normalizedValue;
    }

    const tradePrefix = normalizedValue.slice(0, suffixMatch.index).trim();
    const tradeSuffix = suffixMatch[1];
    const matchingTrades = HWK_AI_KNOWN_TRADES.filter((trade) => {
      if (!trade.endsWith(`(${tradeSuffix})`)) {
        return false;
      }

      return trade === `${tradePrefix} (${tradeSuffix})` || trade.startsWith(`${tradePrefix} (`);
    });

    if (matchingTrades.length !== 1) {
      return normalizedValue;
    }

    return matchingTrades[0];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
