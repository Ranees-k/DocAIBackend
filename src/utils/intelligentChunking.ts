export interface ChunkMetadata {
  heading?: string;
  headingLevel?: number;
  section?: string;
  pageNumber?: number;
  chunkIndex: number;
  totalChunks: number;
  wordCount: number;
  charCount: number;
  startPosition: number;
  endPosition: number;
}

export interface IntelligentChunk {
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlapSize?: number;
  respectSentenceBoundaries?: boolean;
  respectParagraphBoundaries?: boolean;
  respectHeadingBoundaries?: boolean;
  preserveHeadingHierarchy?: boolean;
  maxHeadingLevel?: number;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000,
  minChunkSize: 200,
  overlapSize: 100,
  respectSentenceBoundaries: true,
  respectParagraphBoundaries: true,
  respectHeadingBoundaries: true,
  preserveHeadingHierarchy: true,
  maxHeadingLevel: 6
};

export class IntelligentChunker {
  private options: Required<ChunkingOptions>;

  constructor(options: ChunkingOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Main method to chunk text intelligently
   */
  chunkText(text: string, options: ChunkingOptions = {}): IntelligentChunk[] {
    const finalOptions = { ...this.options, ...options };
    const cleanedText = this.preprocessText(text);
    const sections = this.identifySections(cleanedText);
    const chunks: IntelligentChunk[] = [];

    let chunkIndex = 0;
    let globalPosition = 0;

    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, finalOptions, globalPosition, chunkIndex);
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
      globalPosition += section.text.length;
    }

    // Add metadata to all chunks
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
        totalChunks: chunks.length
      }
    }));
  }

  /**
   * Preprocess text to normalize and clean it
   */
  private preprocessText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Identify sections based on headings and structure
   */
  private identifySections(text: string): Array<{text: string, heading?: string, headingLevel?: number, startPos: number}> {
    const sections: Array<{text: string, heading?: string, headingLevel?: number, startPos: number}> = [];
    
    // Enhanced heading patterns for different document types
    const headingPatterns = [
      // Markdown headings
      /^#{1,6}\s+.+$/gm,
      
      // Numbered headings (1., 1.1, 1.1.1, etc.)
      /^\d+(\.\d+)*\s+[A-Z].+$/gm,
      
      // All caps headings (at least 10 characters)
      /^[A-Z][A-Z\s]{9,}$/gm,
      
      // Title case with colon
      /^[A-Z][a-z\s]+:$/gm,
      
      // Roman numerals (I., II., III., etc.)
      /^[IVX]+\.\s+[A-Z].+$/gm,
      
      // Lettered sections (A., B., C., etc.)
      /^[A-Z]\.\s+[A-Z].+$/gm,
      
      // Legal document patterns
      /^Article\s+\d+[.:]/gm,
      /^Section\s+\d+[.:]/gm,
      /^Chapter\s+\d+[.:]/gm,
      
      // Academic paper patterns
      /^Abstract[.:]/gm,
      /^Introduction[.:]/gm,
      /^Conclusion[.:]/gm,
      /^References?[.:]/gm,
      /^Bibliography[.:]/gm,
      
      // Technical document patterns
      /^Overview[.:]/gm,
      /^Implementation[.:]/gm,
      /^API\s+Reference[.:]/gm,
      /^Configuration[.:]/gm,
      
      // Table of contents patterns
      /^\d+\s+[A-Z].+\.{3,}\s+\d+$/gm,
      
      // Page break indicators
      /^Page\s+\d+$/gm,
      /^-\s*\d+\s*-$/gm
    ];

    let lastIndex = 0;
    const allMatches: Array<{match: string, index: number, level: number, type: string}> = [];

    // Find all potential headings
    for (const pattern of headingPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const level = this.getHeadingLevel(match[0]);
        const type = this.getHeadingType(match[0]);
        allMatches.push({
          match: match[0],
          index: match.index,
          level,
          type
        });
      }
    }

    // Sort by position
    allMatches.sort((a, b) => a.index - b.index);

    // Create sections
    for (let i = 0; i < allMatches.length; i++) {
      const current = allMatches[i];
      const next = allMatches[i + 1];
      
      const sectionText = text.slice(
        current.index,
        next ? next.index : text.length
      ).trim();

      if (sectionText.length > 0) {
        sections.push({
          text: sectionText,
          heading: this.cleanHeading(current.match),
          headingLevel: current.level,
          startPos: current.index
        });
      }
    }

    // If no headings found, try to split by double newlines or other patterns
    if (sections.length === 0) {
      const paragraphSections = this.splitByParagraphs(text);
      sections.push(...paragraphSections);
    }

    // If still no sections, treat entire text as one section
    if (sections.length === 0) {
      sections.push({
        text,
        startPos: 0
      });
    }

    return sections;
  }

  /**
   * Split text by paragraphs when no headings are found
   */
  private splitByParagraphs(text: string): Array<{text: string, heading?: string, headingLevel?: number, startPos: number}> {
    const paragraphs = text.split(/\n\s*\n/);
    const sections: Array<{text: string, heading?: string, headingLevel?: number, startPos: number}> = [];
    
    let currentPos = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (paragraph.length === 0) continue;
      
      // Check if this paragraph looks like a heading
      const isHeading = this.looksLikeHeading(paragraph);
      const headingLevel = isHeading ? this.getHeadingLevel(paragraph) : undefined;
      
      sections.push({
        text: paragraph,
        heading: isHeading ? this.cleanHeading(paragraph) : undefined,
        headingLevel,
        startPos: currentPos
      });
      
      currentPos += paragraph.length + 2; // +2 for the newlines
    }
    
    return sections;
  }

  /**
   * Check if text looks like a heading
   */
  private looksLikeHeading(text: string): boolean {
    // Short text (likely heading)
    if (text.length < 100) {
      // Check for common heading patterns
      if (/^[A-Z]/.test(text) && !text.includes('.') && !text.includes(',')) {
        return true;
      }
    }
    
    // Check for specific patterns
    return /^#{1,6}\s+/.test(text) || // Markdown
           /^\d+\.\s+[A-Z]/.test(text) || // Numbered
           /^[A-Z][A-Z\s]{9,}$/.test(text) || // All caps
           /^[A-Z][a-z\s]+:$/.test(text); // Title with colon
  }

  /**
   * Get heading type for better categorization
   */
  private getHeadingType(heading: string): string {
    if (/^#{1,6}\s+/.test(heading)) return 'markdown';
    if (/^\d+(\.\d+)*\s+/.test(heading)) return 'numbered';
    if (/^[A-Z][A-Z\s]{9,}$/.test(heading)) return 'allcaps';
    if (/^[A-Z][a-z\s]+:$/.test(heading)) return 'titlecase';
    if (/^[IVX]+\.\s+/.test(heading)) return 'roman';
    if (/^[A-Z]\.\s+/.test(heading)) return 'lettered';
    if (/^Article\s+/.test(heading)) return 'legal';
    if (/^Section\s+/.test(heading)) return 'legal';
    if (/^Chapter\s+/.test(heading)) return 'legal';
    if (/^(Abstract|Introduction|Conclusion|References?|Bibliography)[.:]/.test(heading)) return 'academic';
    if (/^(Overview|Implementation|API\s+Reference|Configuration)[.:]/.test(heading)) return 'technical';
    return 'unknown';
  }

  /**
   * Determine heading level from text
   */
  private getHeadingLevel(heading: string): number {
    // Markdown headings
    const markdownMatch = heading.match(/^(#{1,6})/);
    if (markdownMatch) {
      return markdownMatch[1].length;
    }

    // Numbered headings - count the depth of numbering
    const numberedMatch = heading.match(/^(\d+(\.\d+)*)/);
    if (numberedMatch) {
      const parts = numberedMatch[1].split('.');
      return Math.min(parts.length, 6); // Cap at level 6
    }

    // Roman numerals (level 1)
    if (/^[IVX]+\.\s+/.test(heading)) {
      return 1;
    }

    // Lettered sections (level 2)
    if (/^[A-Z]\.\s+/.test(heading)) {
      return 2;
    }

    // Legal document patterns
    if (/^Article\s+/.test(heading)) return 1;
    if (/^Section\s+/.test(heading)) return 2;
    if (/^Chapter\s+/.test(heading)) return 1;

    // Academic paper patterns
    if (/^(Abstract|Introduction|Conclusion|References?|Bibliography)[.:]/.test(heading)) {
      return 1;
    }

    // Technical document patterns
    if (/^(Overview|Implementation|API\s+Reference|Configuration)[.:]/.test(heading)) {
      return 1;
    }

    // All caps headings (level 1)
    if (/^[A-Z][A-Z\s]{9,}$/.test(heading)) {
      return 1;
    }

    // Title case with colon (level 2)
    if (/^[A-Z][a-z\s]+:$/.test(heading)) {
      return 2;
    }

    // Default level
    return 3;
  }

  /**
   * Clean heading text
   */
  private cleanHeading(heading: string): string {
    return heading
      .replace(/^#{1,6}\s+/, '')  // Remove markdown markers
      .replace(/^\d+(\.\d+)*\s+/, '')   // Remove numbered headings (1., 1.1, 1.1.1, etc.)
      .replace(/^[IVX]+\.\s+/, '')  // Remove roman numerals
      .replace(/^[A-Z]\.\s+/, '')  // Remove lettered sections
      .replace(/^(Article|Section|Chapter)\s+\d+[.:]\s*/, '')  // Remove legal document prefixes
      .replace(/:\s*$/, '')       // Remove trailing colon
      .replace(/^Page\s+\d+$/, '')  // Remove page numbers
      .replace(/^-\s*\d+\s*-$/, '')  // Remove page separators
      .trim();
  }

  /**
   * Chunk a single section intelligently
   */
  private chunkSection(
    section: {text: string, heading?: string, headingLevel?: number, startPos: number},
    options: Required<ChunkingOptions>,
    globalPosition: number,
    startChunkIndex: number
  ): IntelligentChunk[] {
    const chunks: IntelligentChunk[] = [];
    const text = section.text;
    
    if (text.length <= options.maxChunkSize) {
      // Section fits in one chunk
      chunks.push({
        text: text.trim(),
        metadata: {
          heading: section.heading,
          headingLevel: section.headingLevel,
          section: section.heading,
          chunkIndex: startChunkIndex,
          totalChunks: 1, // Will be updated later
          wordCount: this.countWords(text),
          charCount: text.length,
          startPosition: globalPosition,
          endPosition: globalPosition + text.length
        }
      });
      return chunks;
    }

    // Need to split the section
    const paragraphs = this.splitIntoParagraphs(text);
    let currentChunk = '';
    let chunkIndex = startChunkIndex;
    let position = globalPosition;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Check if adding this paragraph would exceed max size
      if (currentChunk.length + paragraph.length > options.maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            heading: section.heading,
            headingLevel: section.headingLevel,
            section: section.heading,
            chunkIndex: chunkIndex++,
            totalChunks: 1, // Will be updated later
            wordCount: this.countWords(currentChunk),
            charCount: currentChunk.length,
            startPosition: position - currentChunk.length,
            endPosition: position
          }
        });

        // Start new chunk with overlap
        currentChunk = this.createOverlap(currentChunk, options.overlapSize) + paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
      
      position += paragraph.length + (currentChunk.includes(paragraph) ? 2 : 0);
    }

    // Add remaining text as final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        metadata: {
          heading: section.heading,
          headingLevel: section.headingLevel,
          section: section.heading,
          chunkIndex: chunkIndex,
          totalChunks: 1, // Will be updated later
          wordCount: this.countWords(currentChunk),
          charCount: currentChunk.length,
          startPosition: position - currentChunk.length,
          endPosition: position
        }
      });
    }

    return chunks;
  }

  /**
   * Split text into paragraphs
   */
  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Create overlap from previous chunk
   */
  private createOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    const overlap = text.slice(-overlapSize);
    const lastSentence = this.findLastCompleteSentence(overlap);
    return lastSentence || overlap;
  }

  /**
   * Find the last complete sentence in text
   */
  private findLastCompleteSentence(text: string): string | null {
    const sentences = text.split(/[.!?]+/);
    if (sentences.length < 2) return null;
    
    const lastComplete = sentences[sentences.length - 2].trim();
    return lastComplete.length > 0 ? lastComplete + '.' : null;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Chunk text for PDF documents with page awareness
   */
  chunkPDFText(text: string, pageBreaks: number[] = [], options: ChunkingOptions = {}): IntelligentChunk[] {
    const finalOptions = { ...this.options, ...options };
    const chunks = this.chunkText(text, finalOptions);
    
    // Add page number information
    return chunks.map(chunk => {
      const pageNumber = this.findPageNumber(chunk.metadata.startPosition, pageBreaks);
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          pageNumber
        }
      };
    });
  }

  /**
   * Find page number for a given position
   */
  private findPageNumber(position: number, pageBreaks: number[]): number {
    for (let i = 0; i < pageBreaks.length; i++) {
      if (position < pageBreaks[i]) {
        return i + 1;
      }
    }
    return pageBreaks.length + 1;
  }
}

// Export convenience functions
export function chunkTextIntelligently(
  text: string, 
  options: ChunkingOptions = {}
): IntelligentChunk[] {
  const chunker = new IntelligentChunker(options);
  return chunker.chunkText(text);
}

export function chunkPDFTextIntelligently(
  text: string, 
  pageBreaks: number[] = [],
  options: ChunkingOptions = {}
): IntelligentChunk[] {
  const chunker = new IntelligentChunker(options);
  return chunker.chunkPDFText(text, pageBreaks, options);
}
