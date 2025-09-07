import { pipeline } from "@xenova/transformers";

// Singleton pattern for performance (load model only once)
let extractor: any = null;

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2" // free, 384-dim embedding model
    );
  }

  // Generate embeddings
  const output = await extractor(text, {
    pooling: "mean",      // average tokens into a single vector
    normalize: true       // normalize length = 1
  });

  return Array.from(output.data); // Convert Float32Array -> number[]
}
