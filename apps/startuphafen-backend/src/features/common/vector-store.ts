import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { z } from 'zod';
import { ServerConfig } from '../../config';

export const EMBEDDINGS_CONFIG = {
  model: 'mistral-embed',
} as const;

export const VECTOR_STORE_CONFIG = {
  tableName: '"VectorEmbedding"',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'embedding',
    contentColumnName: 'content',
    metadataColumnName: 'metadata',
  },
  distanceStrategy: 'cosine',
} as const;

const DEFAULT_VECTOR_SEARCH_LIMIT = 50;

// NOTE (open source release): This repository ships with an EMPTY embeddings
// corpus. Configure the source documents of your own corpus here (as ingested
// via tools/pdf-embeddings-generator.js).
export const DEFAULT_HWK_SOURCE_PATHS = [
  'source/your-hwk-legal-source.pdf',
];

export const DEFAULT_KNOWN_SOURCE_PATHS = [
  ...DEFAULT_HWK_SOURCE_PATHS,
  'source/your-chatbot-source.pdf',
];

export type UnknownSourcePolicy = 'exclude' | 'chatbot';

export type AiCorpusConfig = {
  hwkSourcePaths: string[];
  unknownSourcePolicy: UnknownSourcePolicy;
};

export type AiCorpusTarget = 'chatbot' | 'hwk';

export const DocumentMetadataSchema = z
  .object({
    source_path: z.string().optional(),
    source: z.string().optional(),
    markdown_path: z.string().optional(),
    chunk_index: z.number().optional(),
    token_count: z.number().optional(),
    tokenizer_model: z.string().optional(),
    chunker: z.string().optional(),
    merge_peers: z.boolean().optional(),
    headings: z.array(z.string()).optional(),
    doc_items: z.array(z.record(z.string(), z.unknown())).optional(),
    embedding_model: z.string().optional(),
    title: z.string().optional(),
    author: z.string().nullable().optional(),
    numPages: z.number().optional(),
    processedAt: z.string().optional(),
    creationDate: z.string().optional(),
    paragraphIndex: z.number().optional(),
    dataset: z.string().optional(),
  })
  .catchall(z.unknown());

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const DocumentResultSchema = z.object({
  pageContent: z.string(),
  metadata: DocumentMetadataSchema,
  id: z.number(),
});

export type DocumentResult = z.infer<typeof DocumentResultSchema>;
export type VectorDocumentResult = DocumentResult;

const RawDocumentResultSchema = z.object({
  pageContent: z.string(),
  metadata: z.unknown().optional().nullable(),
  id: z.number(),
});

export function createVectorStore(
  mistralApiKey: string,
  dbConfig: ServerConfig['knex']['connection']
): PGVectorStore {
  const embeddingsModel = new MistralAIEmbeddings({
    apiKey: mistralApiKey,
    model: EMBEDDINGS_CONFIG.model,
  });

  return new PGVectorStore(embeddingsModel, {
    postgresConnectionOptions: dbConfig,
    tableName: VECTOR_STORE_CONFIG.tableName,
    columns: VECTOR_STORE_CONFIG.columns,
    distanceStrategy: VECTOR_STORE_CONFIG.distanceStrategy,
  });
}

function normalizeSourcePath(
  sourcePath: string | null | undefined
): string | null {
  if (!sourcePath) {
    return null;
  }

  const trimmed = sourcePath.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildNormalizedSourcePathSet(paths: string[]): Set<string> {
  const normalizedPaths = new Set<string>();
  for (const path of paths) {
    const normalizedPath = normalizeSourcePath(path);
    if (normalizedPath) {
      normalizedPaths.add(normalizedPath);
    }
  }
  return normalizedPaths;
}

export function getDocumentSourcePath(
  metadata: DocumentMetadata
): string | null {
  const migratedPath = normalizeSourcePath(metadata.source_path);
  if (migratedPath) {
    return migratedPath;
  }
  return normalizeSourcePath(metadata.source);
}

export function filterDocumentsForCorpus(
  documents: DocumentResult[],
  target: AiCorpusTarget,
  aiCorpusConfig: AiCorpusConfig
): DocumentResult[] {
  const hwkSourcePaths = buildNormalizedSourcePathSet(
    aiCorpusConfig.hwkSourcePaths
  );
  const knownSourcePaths = buildNormalizedSourcePathSet(
    DEFAULT_KNOWN_SOURCE_PATHS
  );
  for (const hwkSourcePath of hwkSourcePaths) {
    knownSourcePaths.add(hwkSourcePath);
  }

  return documents.filter((document) => {
    const sourcePath = getDocumentSourcePath(document.metadata);

    if (!sourcePath || !knownSourcePaths.has(sourcePath)) {
      return (
        target === 'chatbot' && aiCorpusConfig.unknownSourcePolicy === 'chatbot'
      );
    }

    const isHwkDocument = hwkSourcePaths.has(sourcePath);
    return target === 'hwk' ? isHwkDocument : !isHwkDocument;
  });
}

function parseDocumentMetadata(rawMetadata: unknown): DocumentMetadata {
  if (
    rawMetadata &&
    typeof rawMetadata === 'object' &&
    !Array.isArray(rawMetadata)
  ) {
    return DocumentMetadataSchema.parse(rawMetadata);
  }

  return DocumentMetadataSchema.parse({});
}

export class VectorStoreService {
  private vectorStore: ReturnType<typeof createVectorStore>;

  constructor(
    mistralApiKey: string,
    dbConfig: ServerConfig['knex']['connection']
  ) {
    this.vectorStore = createVectorStore(mistralApiKey, dbConfig);
  }

  async semanticSearchDocuments(
    query: string,
    threshold: number,
    metadataFilter: Record<string, unknown>,
    topK?: number
  ): Promise<DocumentResult[]> {
    const searchLimit = topK ?? DEFAULT_VECTOR_SEARCH_LIMIT;
    const resultsWithScore = await this.vectorStore.similaritySearchWithScore(
      query,
      searchLimit,
      metadataFilter
    );
    const filteredResults = resultsWithScore
      .filter(([, score]) => score <= threshold)
      .map(([document]) => document);
    const cappedResults =
      topK !== undefined ? filteredResults.slice(0, topK) : filteredResults;

    const rawDocuments = z.array(RawDocumentResultSchema).parse(cappedResults);
    return rawDocuments.map((document) => ({
      pageContent: document.pageContent,
      id: document.id,
      metadata: parseDocumentMetadata(document.metadata),
    }));
  }
}
