export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
  
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap; // move with overlap
    }
  
    return chunks;
  }
  