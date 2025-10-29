import { GoogleGenAI, Modality, Type } from "@google/genai";

// A global error is thrown if the API key is not available.
// This is a design choice to fail early in a critical configuration issue.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface DetectedObject {
  label: string;
  boundingBox: {
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  };
}

const objectDetectionSchema = {
  type: Type.OBJECT,
  properties: {
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: "A short, descriptive label for the detected object, e.g., 'cat', 'red car'."
          },
          boundingBox: {
            type: Type.OBJECT,
            description: "The bounding box coordinates of the object, normalized from 0 to 1.",
            properties: {
              x_min: { type: Type.NUMBER, description: "Left-most coordinate." },
              y_min: { type: Type.NUMBER, description: "Top-most coordinate." },
              x_max: { type: Type.NUMBER, description: "Right-most coordinate." },
              y_max: { type: Type.NUMBER, description: "Bottom-most coordinate." }
            },
            required: ["x_min", "y_min", "x_max", "y_max"]
          }
        },
        required: ["label", "boundingBox"]
      }
    }
  },
  required: ["objects"]
};

/**
 * Generates an image from a text prompt.
 * @param prompt The text prompt describing the desired image.
 * @returns A promise that resolves to the base64 encoded string of the generated image.
 */
export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        if (!response.candidates || response.candidates.length === 0) {
            throw new Error("API returned no candidates for image generation.");
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }

        throw new Error("No image data found in the generation response.");

    } catch (error) {
        console.error("Error generating image with Gemini:", error);
        throw new Error("Failed to generate image. The model may not be able to fulfill this request.");
    }
};


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

/**
 * Detects watermark text in an image using the Gemini API.
 * @param base64ImageData The base64 encoded image data.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to an array of detected text objects.
 */
export const detectWatermarkText = async (
  base64ImageData: string,
  mimeType: string
): Promise<DetectedObject[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: "Identify only text that appears to be a watermark or is digitally overlaid on the image. Do not identify text that is part of the original photo (e.g., text on a book page or a sign). Provide a label (the text itself) and a precise bounding box for each piece of identified text.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: objectDetectionSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      console.warn("API returned an empty response for watermark detection.");
      return [];
    }

    const result = JSON.parse(jsonText);
    return result.objects || [];
  } catch (error) {
    console.error("Error detecting watermark text with Gemini:", error);
    throw new Error("Failed to detect watermark text in the image. The model may not have been able to identify any.");
  }
};

/**
 * Detects objects in an image using the Gemini API.
 * @param base64ImageData The base64 encoded image data.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to an array of detected objects.
 */
export const detectObjects = async (
  base64ImageData: string,
  mimeType: string
): Promise<DetectedObject[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: "Identify all distinct objects in the image and provide their labels and bounding boxes. Be as precise as possible.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: objectDetectionSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      console.warn("API returned an empty response for object detection.");
      return [];
    }

    const result = JSON.parse(jsonText);
    return result.objects || [];
  } catch (error) {
    console.error("Error detecting objects with Gemini:", error);
    throw new Error("Failed to detect objects in the image. The model may not have been able to identify any distinct items.");
  }
};
