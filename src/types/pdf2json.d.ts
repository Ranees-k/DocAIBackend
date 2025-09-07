declare module 'pdf2json' {
  interface PDFData {
    Pages: any[];
    Transcoder: string;
    Meta: any;
  }

  class PDFParser {
    constructor();
    on(event: string, callback: (data: PDFData) => void): void;
    loadPDF(pdfPath: string): void;
    parseBuffer(buffer: Buffer): void;
  }

  export = PDFParser;
}
