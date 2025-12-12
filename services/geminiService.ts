import { GoogleGenAI, Type } from "@google/genai";
import { ActionItem } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const summarizeMeeting = async (notes: string): Promise<string> => {
  const ai = getAIClient();
  
  const prompt = `
    以下の会議メモを、専門的かつ簡潔な要約にまとめてください。
    重要な決定事項と議論の流れがわかるように構成してください。
    
    会議メモ:
    ${notes}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "あなたは優秀な議事録作成アシスタントです。Markdown形式で出力してください。",
      }
    });
    return response.text || "要約を生成できませんでした。";
  } catch (error) {
    console.error("Summarization error:", error);
    throw error;
  }
};

export const extractActionItems = async (notes: string): Promise<Partial<ActionItem>[]> => {
  const ai = getAIClient();
  
  const prompt = `
    以下の会議メモから、具体的なアクションアイテム（タスク）を抽出してください。
    担当者が不明な場合は「未定」としてください。
    期限が明記されていない場合は空にしてください。
    
    会議メモ:
    ${notes}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING, description: "具体的なタスク内容" },
              assignee: { type: Type.STRING, description: "担当者名" },
              dueDate: { type: Type.STRING, description: "期限 (YYYY-MM-DD形式推奨)" }
            },
            required: ["task", "assignee"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Extraction error:", error);
    throw error;
  }
};

export const suggestTags = async (notes: string): Promise<string[]> => {
    const ai = getAIClient();
    const prompt = `
      以下の会議メモの内容に基づいて、適切なタグを最大5つ生成してください。
      JSON配列形式で出力してください。
      
      会議メモ:
      ${notes}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        const jsonText = response.text;
        if (!jsonText) return [];
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Tag generation error", error);
        return [];
    }
}