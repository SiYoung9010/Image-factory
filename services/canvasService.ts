/**
 * Helper function to load an image from a base64 source.
 * @param src The base64 data URL.
 * @returns A promise that resolves with the HTMLImageElement.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
};

/**
 * Composites an object image onto a background image using the Canvas API.
 * The object is centered and scaled to fit nicely within the background.
 * @param objectBase64 The base64 data URL of the object image (e.g., with transparent background).
 * @param backgroundBase64 The base64 data URL of the background image.
 * @returns A promise that resolves with the base64 data URL of the final composited image.
 */
export const compositeImages = async (
    objectBase64: string,
    backgroundBase64: string
): Promise<string> => {
    try {
        const [objectImg, backgroundImg] = await Promise.all([
            loadImage(objectBase64),
            loadImage(backgroundBase64),
        ]);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Set canvas to the dimensions of the background
        canvas.width = backgroundImg.width;
        canvas.height = backgroundImg.height;

        // Draw the background
        ctx.drawImage(backgroundImg, 0, 0);

        // Calculate the dimensions for the object image to fit within the background
        // with some padding (e.g., scaled to 80% of the background's smaller dimension)
        const scaleFactor = 0.8;
        const bgAspectRatio = canvas.width / canvas.height;
        const objAspectRatio = objectImg.width / objectImg.height;

        let objRenderWidth, objRenderHeight;

        if (objAspectRatio > bgAspectRatio) {
            // Object is wider than background
            objRenderWidth = canvas.width * scaleFactor;
            objRenderHeight = objRenderWidth / objAspectRatio;
        } else {
            // Object is taller than or same aspect as background
            objRenderHeight = canvas.height * scaleFactor;
            objRenderWidth = objRenderHeight * objAspectRatio;
        }

        // Center the object image
        const x = (canvas.width - objRenderWidth) / 2;
        const y = (canvas.height - objRenderHeight) / 2;

        // Draw the object image on top
        ctx.drawImage(objectImg, x, y, objRenderWidth, objRenderHeight);

        // Return the final image as a data URL
        return canvas.toDataURL('image/png');

    } catch (error) {
        console.error("Error during image composition:", error);
        throw new Error("Failed to composite images due to an error loading image assets.");
    }
};
