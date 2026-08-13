const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const { execSync } = require('child_process');
const { Mistral } = require('@mistralai/mistralai');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mistralApiKey: process.env.MISTRAL_API_KEY || null,
    pdfDirectory: null,
    pdfFiles: [],
    urlSources: [],
    outputFile: './embeddings_data.sql',
    batchSize: 10,
    minParagraphLength: 50,
    dataset: null,
    gitUser: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-key':
      case '-k':
        config.mistralApiKey = args[++i];
        break;
      case '--pdf-dir':
      case '-p':
        config.pdfDirectory = args[++i];
        break;
      case '--pdf-file':
      case '-f':
        config.pdfFiles.push(args[++i]);
        break;
      case '--url':
      case '-u':
        config.urlSources.push(args[++i]);
        break;
      case '--dataset':
      case '-d':
        config.dataset = args[++i];
        break;
      case '--output':
      case '-o':
        config.outputFile = args[++i];
        break;
      case '--batch-size':
      case '-b':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--min-length':
      case '-m':
        config.minParagraphLength = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        console.log(`
PDF to Embeddings Generator - Usage:

Arguments:
  --api-key, -k <key>          Mistral API key (required)
  --pdf-dir, -p <path>         Directory containing PDF files (optional)
  --pdf-file, -f <path>        Additional PDF file (repeatable)
  --url, -u <url>              Additional URL source (repeatable)
  --output, -o <file>          Output SQL file path (default: ./embeddings_data.sql)
  --batch-size, -b <number>    Number of paragraphs to process at once (default: 10)
  --min-length, -m <number>    Minimum paragraph length in characters (default: 50)
  --dataset, -d <name>         Optional metadata dataset tag
  --help, -h                   Show this help message

Examples:
  node pdf-embeddings-generator.js --api-key YOUR_KEY
  node pdf-embeddings-generator.js -k YOUR_KEY -p ./documents -o output.sql
  node pdf-embeddings-generator.js -k YOUR_KEY -f ./some.pdf --url https://example.com
  node pdf-embeddings-generator.js -k YOUR_KEY -b 20 -m 100
  
Environment Variables:
  MISTRAL_API_KEY              Can be used instead of --api-key argument
        `);
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        console.log('Use --help or -h for usage information');
        process.exit(1);
    }
  }

  // Validate required arguments
  if (!config.mistralApiKey) {
    console.error('Error: Mistral API key is required.');
    console.log(
      'Provide it via --api-key argument or MISTRAL_API_KEY environment variable'
    );
    console.log('Use --help or -h for usage information');
    process.exit(1);
  }

  config.gitUser = getGitUserName();

  return config;
}

// Parse configuration from command line arguments
const CONFIG = parseArgs();

// Initialize Mistral client
const mistralClient = new Mistral({ apiKey: CONFIG.mistralApiKey });

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text) {
  // Split by double newlines, single newlines, or common paragraph breaks
  const paragraphs = text
    .split(/\n\s*\n|\r\n\s*\r\n/) // Split on double line breaks
    .map((p) => p.replace(/\s+/g, ' ').trim()) // Normalize whitespace
    .filter((p) => p.length >= CONFIG.minParagraphLength); // Filter out very short paragraphs

  // If no double line breaks found, try splitting by single newlines
  if (paragraphs.length === 1 && paragraphs[0].length > 2000) {
    return text
      .split(/\n|\r\n/)
      .map((p) => p.trim())
      .filter((p) => p.length >= CONFIG.minParagraphLength);
  }

  return paragraphs;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (!match) {
    return null;
  }
  return decodeHtmlEntities(match[1]).trim();
}

function htmlToText(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/(h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s+\n/g, '\n\n');

  return text.trim();
}

function buildMetadata(base) {
  if (!CONFIG.dataset) {
    return base;
  }
  return { ...base, dataset: CONFIG.dataset };
}

function getUrlLabel(url) {
  try {
    const parsed = new URL(url);
    const filename = path.basename(parsed.pathname) || 'index.html';
    return `${parsed.hostname}-${filename}`;
  } catch (error) {
    return url;
  }
}

async function extractTextFromUrl(url) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this runtime.');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const html = await response.text();
  const title = extractTitleFromHtml(html) || url;
  return {
    text: htmlToText(html),
    title,
  };
}

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Generate embeddings using Mistral AI
 */
async function generateEmbeddings(texts) {
  try {
    const response = await mistralClient.embeddings.create({
      model: 'mistral-embed',
      inputs: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error.message);
    throw error;
  }
}

async function collectPdfFiles() {
  const fileSet = new Set();

  if (CONFIG.pdfDirectory) {
    try {
      const files = await fs.readdir(CONFIG.pdfDirectory);
      const pdfFiles = files.filter((file) =>
        file.toLowerCase().endsWith('.pdf')
      );
      for (const filename of pdfFiles) {
        fileSet.add(path.join(CONFIG.pdfDirectory, filename));
      }
    } catch (error) {
      console.error(
        `Error reading PDF directory ${CONFIG.pdfDirectory}:`,
        error.message
      );
    }
  }

  for (const filePath of CONFIG.pdfFiles) {
    fileSet.add(filePath);
  }

  return Array.from(fileSet);
}

/**
 * Process all PDFs in batches
 */
async function processPDFs() {
  const results = [];

  // Read all PDF files from directory
  const pdfFiles = await collectPdfFiles();
  if (pdfFiles.length === 0) {
    throw new Error(
      'No PDF files found. Provide at least one --pdf-file or --pdf-dir.'
    );
  }

  console.log(`Found ${pdfFiles.length} PDF files to process\n`);

  for (let i = 0; i < pdfFiles.length; i++) {
    const filePath = pdfFiles[i];
    const filename = path.basename(filePath);

    console.log(`[${i + 1}/${pdfFiles.length}] Processing: ${filename}`);

    try {
      // Extract text from PDF
      const pdfData = await extractTextFromPDF(filePath);
      console.log(`  - Extracted ${pdfData.text.length} characters`);

      // Split into paragraphs
      const paragraphs = splitIntoParagraphs(pdfData.text);
      console.log(`  - Found ${paragraphs.length} paragraphs`);

      // Process paragraphs in batches
      for (let j = 0; j < paragraphs.length; j += CONFIG.batchSize) {
        const batch = paragraphs.slice(j, j + CONFIG.batchSize);
        console.log(
          `  - Generating embeddings for paragraphs ${j + 1}-${Math.min(
            j + batch.length,
            paragraphs.length
          )}...`
        );

        const embeddings = await generateEmbeddings(batch);

        // Store results
        batch.forEach((paragraph, idx) => {
          results.push({
            filename: filename,
            paragraphIndex: j + idx,
            content: paragraph,
            embedding: embeddings[idx],
            metadata: buildMetadata({
              source: filename,
              numPages: pdfData.numPages,
              paragraphIndex: j + idx,
              title: pdfData.info?.Title || filename,
              author: pdfData.info?.Author || null,
              creationDate: pdfData.info?.CreationDate || null,
              processedAt: new Date().toISOString(),
            }),
          });
        });

        // Rate limiting - wait a bit between batches
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(`  ✓ Completed ${filename}\n`);
    } catch (error) {
      console.error(`  ✗ Failed to process ${filename}: ${error.message}\n`);
    }
  }

  if (CONFIG.urlSources.length > 0) {
    console.log(`Found ${CONFIG.urlSources.length} URL sources to process\n`);
  }

  for (let i = 0; i < CONFIG.urlSources.length; i++) {
    const url = CONFIG.urlSources[i];
    const label = getUrlLabel(url);

    console.log(
      `[${i + 1}/${CONFIG.urlSources.length}] Processing URL: ${label}`
    );

    try {
      const htmlData = await extractTextFromUrl(url);
      console.log(`  - Extracted ${htmlData.text.length} characters`);

      const paragraphs = splitIntoParagraphs(htmlData.text);
      console.log(`  - Found ${paragraphs.length} paragraphs`);

      for (let j = 0; j < paragraphs.length; j += CONFIG.batchSize) {
        const batch = paragraphs.slice(j, j + CONFIG.batchSize);
        console.log(
          `  - Generating embeddings for paragraphs ${j + 1}-${Math.min(
            j + batch.length,
            paragraphs.length
          )}...`
        );

        const embeddings = await generateEmbeddings(batch);

        batch.forEach((paragraph, idx) => {
          results.push({
            filename: label,
            paragraphIndex: j + idx,
            content: paragraph,
            embedding: embeddings[idx],
            metadata: buildMetadata({
              source: url,
              numPages: 1,
              paragraphIndex: j + idx,
              title: htmlData.title,
              author: null,
              creationDate: new Date().toISOString(),
              processedAt: new Date().toISOString(),
            }),
          });
        });

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(`  ✓ Completed ${label}\n`);
    } catch (error) {
      console.error(`  ✗ Failed to process ${label}: ${error.message}\n`);
    }
  }

  return results;
}

/**
 * Generate SQL INSERT statements matching VectorEmbedding schema
 */
function generateSQL(results) {
  const now = new Date().toISOString();

  let sql = `-- Generated on ${now}\n`;
  sql += `-- Total records: ${results.length}\n`;
  sql += `-- Processed by: ${CONFIG.gitUser}\n\n`;

  sql += `-- Table schema (for reference)\n`;
  sql += `-- CREATE TABLE "VectorEmbedding" (\n`;
  sql += `--     "id" SERIAL NOT NULL,\n`;
  sql += `--     "content" TEXT NOT NULL,\n`;
  sql += `--     "embedding" vector NOT NULL,\n`;
  sql += `--     "metadata" JSONB,\n`;
  sql += `--     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `--     "updatedAt" TIMESTAMP(3) NOT NULL,\n`;
  sql += `--     CONSTRAINT "VectorEmbedding_pkey" PRIMARY KEY ("id")\n`;
  sql += `-- );\n\n`;

  sql += `-- Create index for vector similarity search (if not exists)\n`;
  sql += `CREATE INDEX IF NOT EXISTS "VectorEmbedding_embedding_idx" ON "VectorEmbedding" USING ivfflat (embedding vector_cosine_ops);\n\n`;

  sql += `-- Insert data\n`;
  sql += `BEGIN;\n\n`;

  results.forEach((result, index) => {
    const escapedContent = result.content.replace(/'/g, "''");
    const embeddingStr = `'[${result.embedding.join(',')}]'`;
    const metadataStr = JSON.stringify(result.metadata).replace(/'/g, "''");

    sql += `INSERT INTO "VectorEmbedding" ("content", "embedding", "metadata", "createdAt", "updatedAt") VALUES\n`;
    sql += `  ('${escapedContent}', ${embeddingStr}::vector, '${metadataStr}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);\n\n`;
  });

  sql += `COMMIT;\n`;

  return sql;
}

/**
 * Generate JSON export (alternative to SQL)
 */
function generateJSON(results) {
  return JSON.stringify(results, null, 2);
}

/**
 * Generate statistics
 */
function generateStats(results) {
  const fileGroups = {};
  results.forEach((r) => {
    if (!fileGroups[r.filename]) {
      fileGroups[r.filename] = 0;
    }
    fileGroups[r.filename]++;
  });

  const avgParagraphLength =
    results.reduce((sum, r) => sum + r.content.length, 0) / results.length;
  const totalChars = results.reduce((sum, r) => sum + r.content.length, 0);

  return {
    totalParagraphs: results.length,
    totalFiles: Object.keys(fileGroups).length,
    averageParagraphLength: Math.round(avgParagraphLength),
    totalCharacters: totalChars,
    paragraphsPerFile: fileGroups,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('PDF to Embeddings Pipeline (Mistral AI + pgvector)');
  console.log('Paragraph-based chunking strategy');
  console.log('='.repeat(60));
  console.log();

  try {
    // Process all PDFs
    const results = await processPDFs();

    if (results.length === 0) {
      console.log('No paragraphs were processed. Please check your PDF files.');
      return;
    }

    console.log('='.repeat(60));
    console.log(`Successfully processed ${results.length} total paragraphs`);
    console.log();

    // Generate statistics
    const stats = generateStats(results);
    console.log('Statistics:');
    console.log(`  - Total files: ${stats.totalFiles}`);
    console.log(`  - Total paragraphs: ${stats.totalParagraphs}`);
    console.log(
      `  - Average paragraph length: ${stats.averageParagraphLength} characters`
    );
    console.log(`  - Total characters: ${stats.totalCharacters}`);
    console.log();

    // Generate SQL file
    console.log('Generating SQL file...');
    const sqlContent = generateSQL(results);
    await fs.writeFile(CONFIG.outputFile, sqlContent);
    console.log(`✓ SQL file saved to: ${CONFIG.outputFile}`);

    // Also generate JSON for reference
    const jsonFile = CONFIG.outputFile.replace('.sql', '.json');
    console.log('Generating JSON file...');
    const jsonContent = generateJSON(results);
    await fs.writeFile(jsonFile, jsonContent);
    console.log(`✓ JSON file saved to: ${jsonFile}`);

    // Save statistics
    const statsFile = CONFIG.outputFile.replace('.sql', '_stats.json');
    await fs.writeFile(statsFile, JSON.stringify(stats, null, 2));
    console.log(`✓ Statistics saved to: ${statsFile}`);

    console.log();
    console.log('='.repeat(60));
    console.log('Import Instructions:');
    console.log('='.repeat(60));
    console.log(
      `\n1. Import SQL file:\n   psql -U your_user -d your_database -f ${CONFIG.outputFile}\n`
    );
    console.log(`2. Or copy JSON and import programmatically\n`);
    console.log(
      `3. Query example:\n   SELECT * FROM "VectorEmbedding" ORDER BY embedding <-> '[your_vector]' LIMIT 5;\n`
    );
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
function getGitUserName() {
  try {
    const repoName = execSync('git config --get user.name', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (repoName) {
      return repoName;
    }
  } catch (error) {
    // ignore and fallback
  }

  try {
    const globalName = execSync('git config --global --get user.name', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (globalName) {
      return globalName;
    }
  } catch (error) {
    // ignore and fallback
  }

  console.error('Error: git user.name is not set.');
  console.log('Set it via: git config --global user.name "Your Name"');
  process.exit(1);
}
