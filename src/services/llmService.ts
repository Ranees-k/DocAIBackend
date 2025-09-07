// src/services/llmService.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // ⚠️ set in .env
});

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
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini", // ✅ lightweight, fast model
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });
  console.log("completion", completion);

  return completion?.choices[0]?.message?.content ?? "";
}
