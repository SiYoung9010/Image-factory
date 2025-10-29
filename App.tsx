import React, { useState, useCallback, ChangeEvent } from 'react';
import { editImage } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { DownloadIcon, SparklesIcon, UploadIcon, XCircleIcon } from './components/icons';

type ImageState = {
  src: string;
  file: File;
} | null;

const ImagePlaceholder: React.FC<{ onFileChange: (e: ChangeEvent<HTMLInputElement>) => void }> = ({ onFileChange }) => (
  <div className="w-full aspect-square bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-center p-4 transition-colors hover:border-blue-500 hover:bg-gray-800">
    <UploadIcon className="w-12 h-12 text-gray-500 mb-4" />
    <label htmlFor="file-upload" className="relative cursor-pointer bg-blue-600 text-white font-semibold rounded-lg px-4 py-2 transition-colors hover:bg-blue-700">
      <span>Upload an Image</span>
      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={onFileChange} />
    </label>
    <p className="mt-2 text-xs text-gray-400">PNG, JPG, GIF up to 10MB</p>
  </div>
);

const ImagePreview: React.FC<{ src: string; onClear: () => void }> = ({ src, onClear }) => (
  <div className="relative w-full aspect-square">
    <img src={src} alt="Original preview" className="w-full h-full object-contain rounded-lg" />
    <button onClick={onClear} className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500">
      <XCircleIcon className="w-6 h-6" />
    </button>
  </div>
);

const ResultDisplay: React.FC<{ image: string | null; isLoading: boolean; error: string | null }> = ({ image, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="w-full aspect-square bg-gray-800/50 rounded-lg flex flex-col items-center justify-center text-center p-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
        <p className="mt-4 font-semibold text-lg">Generating your image...</p>
        <p className="text-gray-400 text-sm">This may take a few moments.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full aspect-square bg-red-900/20 border border-red-700 rounded-lg flex flex-col items-center justify-center text-center p-4">
        <XCircleIcon className="w-12 h-12 text-red-500 mb-4" />
        <p className="font-semibold text-lg text-red-400">An Error Occurred</p>
        <p className="text-red-500 text-sm max-w-xs">{error}</p>
      </div>
    );
  }

  if (image) {
    return (
      <div className="relative w-full aspect-square group">
        <img src={image} alt="Edited result" className="w-full h-full object-contain rounded-lg" />
        <a 
          href={image} 
          download="edited-image.png"
          className="absolute bottom-4 right-4 bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transform transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500"
        >
          <DownloadIcon className="w-5 h-5" />
          Download
        </a>
      </div>
    );
  }

  return (
    <div className="w-full aspect-square bg-gray-800/50 rounded-lg flex flex-col items-center justify-center text-center p-4">
      <SparklesIcon className="w-12 h-12 text-gray-500 mb-4" />
      <p className="font-semibold text-lg text-gray-400">Your edited image will appear here</p>
      <p className="text-gray-500 text-sm">Upload an image and enter a prompt to start</p>
    </div>
  );
};


export default function App() {
  const [image, setImage] = useState<ImageState>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const examplePrompts = [
    "Add a retro, vintage filter.",
    "Make the background a solid, bright blue.",
    "Remove the person in the background.",
    "Turn this into a black and white pencil sketch.",
    "Add a dramatic, cinematic lighting effect.",
  ];

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64Src = await fileToBase64(file);
        setImage({ src: base64Src, file });
        setResultImage(null);
        setError(null);
      } catch (err) {
        setError('Failed to read the image file.');
        console.error(err);
      }
    }
  }, []);
  
  const clearImage = useCallback(() => {
    setImage(null);
    setResultImage(null);
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!image || !prompt) {
      setError("Please upload an image and enter a prompt.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultImage(null);

    try {
      // Remove the base64 prefix
      const base64Data = image.src.split(',')[1];
      const editedImageBase64 = await editImage(base64Data, image.file.type, prompt);
      setResultImage(`data:image/png;base64,${editedImageBase64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [image, prompt]);
  
  const handlePromptSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Image Factory
          </h1>
          <p className="mt-2 text-lg text-gray-400">Edit Images with a Simple Text Prompt using Gemini</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Control Panel */}
          <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg flex flex-col gap-6">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3">1. Your Image</h2>
            {image ? <ImagePreview src={image.src} onClear={clearImage} /> : <ImagePlaceholder onFileChange={handleFileChange} />}
            
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3">2. Your Prompt</h2>
            <div className="flex flex-col gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Add a retro filter"
                className="w-full h-24 p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                disabled={!image}
              />
              <div className="flex flex-wrap gap-2 text-xs">
                {examplePrompts.map(p => (
                   <button 
                     key={p} 
                     onClick={() => handlePromptSuggestionClick(p)}
                     className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                     disabled={!image}
                   >
                     {p}
                   </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!image || !prompt || isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-6 h-6" />
                  Generate
                </>
              )}
            </button>
          </div>

          {/* Result Panel */}
          <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3 mb-6">3. Result</h2>
            <ResultDisplay image={resultImage} isLoading={isLoading} error={error} />
          </div>
        </main>
      </div>
    </div>
  );
}
