// src/services/llmService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateAnswer(query: string, context: string) {
  const prompt = `
    You are an AI assistant. Your primary task is to answer the user's question based on the provided PDF context. 
    The PDF may contain information about a person, finance, project description, or other topics. 
    
    Instructions:
    1. First, carefully read the context from the PDF and use it as the main source of truth.  
    2. If the context contains the answer, provide it clearly and concisely.  
    3. If the context does not contain enough information, use your general knowledge to give a helpful, well-reasoned answer.  
    4. If both the PDF context and your general knowledge do not provide enough detail, say:  
       "I couldn't find relevant information in the document."  
    5. Always distinguish between information directly taken from the PDF and information inferred from general knowledge.  
    
    ---
    📄 PDF Context:
    ${context}
    
    ---
    ❓ User Query:
    ${query}
    `;

  console.log("prompt", prompt);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log("completion", text);

  return text ?? "";
}
