# Intelligent Chunking System

This document explains the intelligent chunking system implemented in the DocAI Backend, which provides advanced text segmentation with heading detection, semantic boundaries, and metadata tracking.

## Overview

The intelligent chunking system replaces the basic text chunking with a sophisticated approach that:

- **Detects headings** using multiple patterns (markdown, numbered, legal, academic, etc.)
- **Preserves semantic boundaries** by respecting sentences, paragraphs, and headings
- **Tracks metadata** including heading hierarchy, section information, and positioning
- **Supports multiple document types** (PDF, text, markdown) with specialized strategies
- **Provides configurable strategies** for different use cases

## Features

### 1. Heading Detection

The system recognizes various heading patterns:

- **Markdown headings**: `# Heading`, `## Subheading`, etc.
- **Numbered headings**: `1. Introduction`, `1.1 Overview`, `1.1.1 Details`
- **Legal documents**: `Article 1:`, `Section 2.1:`, `Chapter III:`
- **Academic papers**: `Abstract:`, `Introduction:`, `Conclusion:`
- **Technical docs**: `Overview:`, `API Reference:`, `Configuration:`
- **All caps headings**: `EXECUTIVE SUMMARY`
- **Roman numerals**: `I. Introduction`, `II. Methods`
- **Lettered sections**: `A. Overview`, `B. Implementation`

### 2. Semantic Boundaries

- **Sentence boundaries**: Chunks don't break mid-sentence
- **Paragraph boundaries**: Respects paragraph structure
- **Heading boundaries**: Never splits content across different sections
- **Overlap handling**: Maintains context between chunks

### 3. Metadata Tracking

Each chunk includes rich metadata:

```typescript
interface ChunkMetadata {
  heading?: string;           // The section heading
  headingLevel?: number;      // Heading hierarchy level (1-6)
  section?: string;          // Section name
  pageNumber?: number;       // Page number (for PDFs)
  chunkIndex: number;        // Position in document
  totalChunks: number;       // Total chunks in document
  wordCount: number;         // Word count
  charCount: number;         // Character count
  startPosition: number;     // Start position in original text
  endPosition: number;       // End position in original text
}
```

## Usage

### 1. Basic Usage

```typescript
import { chunkTextIntelligently } from '../utils/intelligentChunking';

const text = `
# Introduction
This is the introduction section...

## Overview
This is the overview section...

### Details
This is the details section...
`;

const chunks = chunkTextIntelligently(text);
console.log(chunks);
```

### 2. With Custom Options

```typescript
import { chunkTextIntelligently, ChunkingOptions } from '../utils/intelligentChunking';

const options: ChunkingOptions = {
  maxChunkSize: 800,
  minChunkSize: 200,
  overlapSize: 100,
  respectSentenceBoundaries: true,
  respectParagraphBoundaries: true,
  respectHeadingBoundaries: true,
  preserveHeadingHierarchy: true,
  maxHeadingLevel: 6
};

const chunks = chunkTextIntelligently(text, options);
```

### 3. PDF Documents

```typescript
import { chunkPDFTextIntelligently } from '../utils/intelligentChunking';

const pageBreaks = [1000, 2000, 3000]; // Character positions of page breaks
const chunks = chunkPDFTextIntelligently(text, pageBreaks, options);
```

### 4. Using Chunking Strategies

```typescript
import { getChunkingStrategy } from '../config/chunkingConfig';

// Auto-select strategy based on file type
const strategy = getChunkingStrategy('application/pdf');
const chunks = chunkTextIntelligently(text, strategy.options);

// Use specific strategy
const technicalStrategy = getChunkingStrategy('application/pdf', 'technical');
const chunks = chunkTextIntelligently(text, technicalStrategy.options);
```

## API Endpoints

### Upload with Intelligent Chunking

**POST** `/file/upload`

Upload a file with intelligent chunking. You can specify chunking strategy and options.

**Request:**
```json
{
  "file": "<file>",
  "userId": 123,
  "chunkingStrategy": "technical",
  "chunkingOptions": {
    "maxChunkSize": 800,
    "overlapSize": 100
  }
}
```

**Response:**
```json
{
  "message": "✅ Document uploaded successfully with intelligent chunking",
  "document": {
    "id": 456,
    "filename": "document.pdf",
    "fileType": "application/pdf",
    "fileUrl": "/uploads/filename.pdf"
  },
  "chunking": {
    "strategy": "Technical",
    "description": "Optimized for technical documents with many headings and code blocks",
    "summary": {
      "totalChunks": 15,
      "chunksWithHeadings": 12,
      "averageChunkSize": 750,
      "sections": ["Introduction", "Overview", "Implementation"],
      "headingLevels": [1, 2, 3]
    },
    "options": {
      "maxChunkSize": 800,
      "minChunkSize": 150,
      "overlapSize": 80,
      "respectSentenceBoundaries": true,
      "respectParagraphBoundaries": true,
      "respectHeadingBoundaries": true,
      "preserveHeadingHierarchy": true,
      "maxHeadingLevel": 8
    }
  }
}
```

### Get Available Strategies

**GET** `/file/chunking-strategies?fileType=application/pdf`

Get available chunking strategies for a specific file type.

**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "name": "Default",
      "description": "Balanced chunking with heading awareness and semantic boundaries",
      "fileTypes": ["application/pdf", "text/plain", "text/markdown"],
      "options": {
        "maxChunkSize": 1000,
        "minChunkSize": 200,
        "overlapSize": 100,
        "respectSentenceBoundaries": true,
        "respectParagraphBoundaries": true,
        "respectHeadingBoundaries": true,
        "preserveHeadingHierarchy": true,
        "maxHeadingLevel": 6
      }
    }
  ],
  "total": 6
}
```

## Available Strategies

### 1. Default
- **Best for**: General documents
- **Chunk size**: 1000 chars
- **Features**: Balanced approach with heading awareness

### 2. Technical
- **Best for**: Technical documentation, code docs
- **Chunk size**: 800 chars
- **Features**: Smaller chunks, more heading levels

### 3. Academic
- **Best for**: Research papers, academic documents
- **Chunk size**: 1200 chars
- **Features**: Larger chunks, citation-aware

### 4. Legal
- **Best for**: Legal documents, contracts
- **Chunk size**: 1500 chars
- **Features**: Large chunks, legal section patterns

### 5. Simple
- **Best for**: Plain text documents
- **Chunk size**: 600 chars
- **Features**: Basic chunking without complex structure

### 6. Fine-grained
- **Best for**: Detailed analysis, precise retrieval
- **Chunk size**: 500 chars
- **Features**: Small chunks for detailed search

## Database Schema

The system extends the `document_chunks` table with metadata columns:

```sql
ALTER TABLE document_chunks 
ADD COLUMN heading VARCHAR(500),
ADD COLUMN heading_level INTEGER,
ADD COLUMN section VARCHAR(500),
ADD COLUMN page_number INTEGER,
ADD COLUMN chunk_index INTEGER,
ADD COLUMN total_chunks INTEGER,
ADD COLUMN word_count INTEGER,
ADD COLUMN char_count INTEGER,
ADD COLUMN start_position INTEGER,
ADD COLUMN end_position INTEGER,
ADD COLUMN metadata JSONB;
```

## Migration

Run the migration to add the new columns:

```bash
npm run migrate
```

## Examples

### Example 1: Technical Document

```markdown
# API Documentation

## Overview
This document describes the REST API...

### Authentication
All requests require authentication...

#### Bearer Token
Include the token in the Authorization header...

### Endpoints
The API provides the following endpoints...

#### GET /users
Retrieve a list of users...
```

**Result**: Chunks will be created for each section, preserving the hierarchy and maintaining semantic boundaries.

### Example 2: Academic Paper

```text
Abstract
This paper presents a novel approach...

1. Introduction
The field of artificial intelligence...

1.1 Background
Previous work in this area...

2. Methodology
Our approach consists of...

2.1 Data Collection
We collected data from...

3. Results
The experimental results show...

4. Conclusion
In this paper, we have presented...
```

**Result**: Chunks will respect the numbered structure and academic formatting patterns.

### Example 3: Legal Document

```text
Article 1: Definitions
For the purposes of this Agreement...

Section 1.1: "Company" means...
Section 1.2: "Services" means...

Article 2: Scope of Services
The Company shall provide...

Section 2.1: Service Level
The Services shall be provided...
```

**Result**: Chunks will maintain legal document structure and preserve article/section relationships.

## Performance Considerations

- **Memory usage**: Intelligent chunking uses more memory than basic chunking due to metadata tracking
- **Processing time**: Slightly slower than basic chunking due to pattern matching and analysis
- **Database storage**: Additional columns increase storage requirements
- **Query performance**: Indexes are created for common query patterns

## Troubleshooting

### Common Issues

1. **No headings detected**: Check if your document uses supported heading patterns
2. **Chunks too small/large**: Adjust `maxChunkSize` and `minChunkSize` options
3. **Poor semantic boundaries**: Enable `respectSentenceBoundaries` and `respectParagraphBoundaries`
4. **Missing metadata**: Ensure the database migration has been run

### Debug Mode

Enable debug logging to see chunking decisions:

```typescript
const chunks = chunkTextIntelligently(text, {
  ...options,
  debug: true // Add this to see detailed logging
});
```

## Future Enhancements

- **Machine learning-based heading detection**
- **Language-specific patterns**
- **Custom heading pattern definitions**
- **Chunk quality scoring**
- **Automatic strategy selection based on content analysis**
