import { GoogleGenAI, Modality } from "@google/genai";

// A global error is thrown if the API key is not available.
// This is a design choice to fail early in a critical configuration issue.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Edits an image using a text prompt with the Gemini API.
 * @param base64ImageData The base64 encoded image data, without the 'data:image/...' prefix.
 * @param mimeType The MIME type of the image (e.g., 'image/jpeg').
 * @param prompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the base64 encoded string of the edited image.
 */
export const editImage = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });
    
    // The response should contain at least one candidate with content parts.
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("API returned no candidates.");
    }

    const candidate = response.candidates[0];

    // Find the image part in the response
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }
    
    throw new Error("No image data found in the API response.");

  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    // Re-throw a more user-friendly error message.
    throw new Error("Failed to edit image. The model may not be able to fulfill this request. Please try a different prompt or image.");
  }
};
