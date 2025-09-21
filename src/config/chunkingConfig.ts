import { ChunkingOptions } from "../utils/intelligentChunking";

export interface ChunkingStrategy {
  name: string;
  description: string;
  options: ChunkingOptions;
  fileTypes: string[];
}

export const CHUNKING_STRATEGIES: Record<string, ChunkingStrategy> = {
  // Default strategy - balanced for most documents
  default: {
    name: "Default",
    description: "Balanced chunking with heading awareness and semantic boundaries",
    fileTypes: ["application/pdf", "text/plain", "text/markdown"],
    options: {
      maxChunkSize: 1000,
      minChunkSize: 200,
      overlapSize: 100,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: true,
      respectHeadingBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 6
    }
  },

  // For technical documents with many headings
  technical: {
    name: "Technical",
    description: "Optimized for technical documents with many headings and code blocks",
    fileTypes: ["application/pdf", "text/plain", "text/markdown"],
    options: {
      maxChunkSize: 800,
      minChunkSize: 150,
      overlapSize: 80,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: true,
      respectHeadingBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 8
    }
  },

  // For academic papers and research documents
  academic: {
    name: "Academic",
    description: "Optimized for academic papers with citations and structured sections",
    fileTypes: ["application/pdf", "text/plain"],
    options: {
      maxChunkSize: 1200,
      minChunkSize: 300,
      overlapSize: 150,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: true,
      respectHeadingBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 6
    }
  },

  // For legal documents with specific formatting
  legal: {
    name: "Legal",
    description: "Optimized for legal documents with numbered sections and clauses",
    fileTypes: ["application/pdf", "text/plain"],
    options: {
      maxChunkSize: 1500,
      minChunkSize: 400,
      overlapSize: 200,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: true,
      respectHeadingBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 10
    }
  },

  // For simple text documents
  simple: {
    name: "Simple",
    description: "Basic chunking for simple text documents without complex structure",
    fileTypes: ["text/plain"],
    options: {
      maxChunkSize: 600,
      minChunkSize: 100,
      overlapSize: 50,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: false,
      respectHeadingBoundaries: false,
      preserveHeadingHierarchy: false,
      maxHeadingLevel: 3
    }
  },

  // For large documents that need smaller chunks
  fine_grained: {
    name: "Fine-grained",
    description: "Smaller chunks for detailed analysis and precise retrieval",
    fileTypes: ["application/pdf", "text/plain", "text/markdown"],
    options: {
      maxChunkSize: 500,
      minChunkSize: 100,
      overlapSize: 50,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: true,
      respectHeadingBoundaries: true,
      preserveHeadingHierarchy: true,
      maxHeadingLevel: 6
    }
  }
};

export function getChunkingStrategy(
  fileType: string, 
  strategyName?: string
): ChunkingStrategy {
  // If strategy is specified and exists, use it
  if (strategyName && CHUNKING_STRATEGIES[strategyName]) {
    const strategy = CHUNKING_STRATEGIES[strategyName];
    if (strategy.fileTypes.includes(fileType)) {
      return strategy;
    }
  }

  // Auto-select based on file type
  switch (fileType) {
    case "application/pdf":
      return CHUNKING_STRATEGIES.default;
    case "text/plain":
      return CHUNKING_STRATEGIES.simple;
    case "text/markdown":
      return CHUNKING_STRATEGIES.technical;
    default:
      return CHUNKING_STRATEGIES.default;
  }
}

export function getAvailableStrategies(fileType?: string): ChunkingStrategy[] {
  if (!fileType) {
    return Object.values(CHUNKING_STRATEGIES);
  }
  
  return Object.values(CHUNKING_STRATEGIES).filter(
    strategy => strategy.fileTypes.includes(fileType)
  );
}

export function validateChunkingOptions(options: Partial<ChunkingOptions>): ChunkingOptions {
  const defaults = CHUNKING_STRATEGIES.default.options;
  
  return {
    maxChunkSize: Math.max(100, Math.min(2000, options.maxChunkSize || defaults.maxChunkSize)),
    minChunkSize: Math.max(50, Math.min(500, options.minChunkSize || defaults.minChunkSize)),
    overlapSize: Math.max(0, Math.min(300, options.overlapSize || defaults.overlapSize)),
    respectSentenceBoundaries: options.respectSentenceBoundaries ?? defaults.respectSentenceBoundaries,
    respectParagraphBoundaries: options.respectParagraphBoundaries ?? defaults.respectParagraphBoundaries,
    respectHeadingBoundaries: options.respectHeadingBoundaries ?? defaults.respectHeadingBoundaries,
    preserveHeadingHierarchy: options.preserveHeadingHierarchy ?? defaults.preserveHeadingHierarchy,
    maxHeadingLevel: Math.max(1, Math.min(10, options.maxHeadingLevel || defaults.maxHeadingLevel))
  };
}
