import React, { useState, useCallback, ChangeEvent, useRef, useLayoutEffect } from 'react';
import { editImage, detectObjects, DetectedObject, generateImageFromPrompt, detectText } from './services/geminiService';
import { compositeImages } from './services/canvasService';
import { fileToBase64 } from './utils/fileUtils';
import { DownloadIcon, SparklesIcon, UploadIcon, XCircleIcon, IsolateIcon, TrashIcon, ObjectDetectIcon, ImageIcon, WandIcon, TextScanIcon, TranslateIcon } from './components/icons';
import { QuickActionButton } from './components/QuickActionButton';
import { EDIT_PRESETS, PresetKey } from './constants/editPresets';

type ImageState = {
  src: string;
  file: File;
} | null;

const areObjectsEqual = (objA: DetectedObject, objB: DetectedObject) => {
    return objA.label === objB.label && JSON.stringify(objA.boundingBox) === JSON.stringify(objB.boundingBox);
};

const ImagePlaceholder: React.FC<{ onFileChange: (e: ChangeEvent<HTMLInputElement>) => void, id?: string }> = ({ onFileChange, id = "file-upload" }) => (
  <div className="w-full aspect-square bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-center p-4 transition-colors hover:border-blue-500 hover:bg-gray-800">
    <UploadIcon className="w-12 h-12 text-gray-500 mb-4" />
    <label htmlFor={id} className="relative cursor-pointer bg-blue-600 text-white font-semibold rounded-lg px-4 py-2 transition-colors hover:bg-blue-700">
      <span>Upload Image</span>
      <input id={id} name={id} type="file" className="sr-only" accept="image/*" onChange={onFileChange} />
    </label>
    <p className="mt-2 text-xs text-gray-400">PNG, JPG, GIF up to 10MB</p>
  </div>
);

const ImagePreview: React.FC<{
  src: string;
  onClear: () => void;
  detectedObjects?: DetectedObject[];
  selectedObjects?: DetectedObject[];
  onObjectSelect?: (object: DetectedObject) => void;
}> = ({ src, onClear, detectedObjects = [], selectedObjects = [], onObjectSelect }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderInfo, setRenderInfo] = useState({ width: 0, height: 0, top: 0, left: 0 });

  useLayoutEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        const { clientWidth, clientHeight, naturalWidth, naturalHeight } = imgRef.current;
        if (naturalWidth === 0 || naturalHeight === 0) return;

        const naturalRatio = naturalWidth / naturalHeight;
        const clientRatio = clientWidth / clientHeight;
        
        let width, height, top, left;

        if (naturalRatio > clientRatio) {
          width = clientWidth;
          height = clientWidth / naturalRatio;
          top = (clientHeight - height) / 2;
          left = 0;
        } else {
          height = clientHeight;
          width = clientHeight * naturalRatio;
          left = (clientWidth - width) / 2;
          top = 0;
        }
        setRenderInfo({ width, height, top, left });
      }
    };

    const imgElement = imgRef.current;
    if (imgElement) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(imgElement);
      
      if (imgElement.complete) {
        handleResize();
      } else {
        imgElement.addEventListener('load', handleResize);
      }

      return () => {
        imgElement.removeEventListener('load', handleResize);
        resizeObserver.disconnect();
      };
    }
  }, [src]);

  return (
    <div 
        ref={containerRef}
        className="relative w-full aspect-square bg-black/20 rounded-lg overflow-hidden"
    >
      <img ref={imgRef} src={src} alt="Preview" className="w-full h-full object-contain" />
      <button 
        onClick={(e) => { e.stopPropagation(); onClear(); }} 
        className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 z-30"
      >
        <XCircleIcon className="w-6 h-6" />
      </button>
      
      {onObjectSelect && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
          {detectedObjects.map((object, index) => {
            const isSelected = selectedObjects.some(obj => areObjectsEqual(obj, object));
            const { x_min, y_min, x_max, y_max } = object.boundingBox;
            const boxStyle: React.CSSProperties = {
              position: 'absolute',
              left: `${renderInfo.left + x_min * renderInfo.width}px`,
              top: `${renderInfo.top + y_min * renderInfo.height}px`,
              width: `${(x_max - x_min) * renderInfo.width}px`,
              height: `${(y_max - y_min) * renderInfo.height}px`,
              pointerEvents: 'auto',
            };
            
            return (
              <div
                key={index}
                style={boxStyle}
                className={`cursor-pointer transition-all duration-200 ${isSelected ? 'border-4 border-green-400' : 'border-2 border-cyan-400 hover:bg-cyan-400/30'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onObjectSelect(object);
                }}
              >
                <span className={`absolute -top-6 left-0 text-xs font-bold px-1.5 py-0.5 rounded-sm ${isSelected ? 'bg-green-400 text-black' : 'bg-cyan-400 text-black'}`}>
                  {object.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


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
      <p className="text-gray-500 text-sm">Upload an image and choose an action</p>
    </div>
  );
};


export default function App() {
  // Main editor state
  const [image, setImage] = useState<ImageState>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  
  // Object detection state
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<DetectedObject[]>([]);
  
  // Compositor state
  const [objectImage, setObjectImage] = useState<ImageState>(null);
  const [backgroundImage, setBackgroundImage] = useState<ImageState>(null);
  const [backgroundPrompt, setBackgroundPrompt] = useState('A photorealistic image of a beautiful beach at sunset');
  const [compositorBgMode, setCompositorBgMode] = useState<'upload' | 'generate'>('generate');
  const [generatedBackground, setGeneratedBackground] = useState<string | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);


  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64Src = await fileToBase64(file);
        setImage({ src: base64Src, file });
        setResultImage(null);
        setError(null);
        setDetectedObjects([]);
        setSelectedObjects([]);
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
    setDetectedObjects([]);
    setSelectedObjects([]);
  }, []);

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const currentPrompt = promptOverride || prompt;
    if (!image || !currentPrompt) {
      setError("Please upload an image and provide a prompt.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    
    try {
      const base64Data = image.src.split(',')[1];
      const editedImageBase64 = await editImage(base64Data, image.file.type, currentPrompt);
      setResultImage(`data:image/png;base64,${editedImageBase64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setActivePreset(null);
    }
  }, [image, prompt]);

  const handleQuickEdit = useCallback(async (presetKey: PresetKey) => {
    if (!image) {
      setError("Please upload an image first.");
      return;
    }
    if (selectedObjects.length !== 1) {
      setError("Please select exactly one object for this action.");
      return;
    }
    const selectedObject = selectedObjects[0];
  
    const preset = EDIT_PRESETS[presetKey];
    let finalPrompt: string;

    const { label, boundingBox } = selectedObject;
    const { x_min, y_min, x_max, y_max } = boundingBox;
    const bboxString = `[${y_min.toFixed(4)}, ${x_min.toFixed(4)}, ${y_max.toFixed(4)}, ${x_max.toFixed(4)}]`;
    
    if (presetKey === 'removeText') {
      finalPrompt = `Remove the selected text '${label}' located within the normalized bounding box (y_min, x_min, y_max, x_max) ${bboxString}. Inpaint the area naturally to match the surroundings.`;
    } else {
      finalPrompt = `${preset.prompt}. The main subject for this operation is the selected '${label}' located within the normalized bounding box (y_min, x_min, y_max, x_max) ${bboxString}. Focus the effect on this object or the area around it as appropriate.`;
    }
    
    setActivePreset(presetKey);
    handleGenerate(finalPrompt);

  }, [image, selectedObjects, handleGenerate]);

  const handleDetectObjects = useCallback(async () => {
    if (!image) {
      setError("Please upload an image first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    setSelectedObjects([]);
    setDetectedObjects([]);
    
    try {
      const base64Data = image.src.split(',')[1];
      const objects = await detectObjects(base64Data, image.file.type);
      setDetectedObjects(objects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [image]);

  const handleDetectText = useCallback(async () => {
    if (!image) {
      setError("Please upload an image first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    setSelectedObjects([]);
    setDetectedObjects([]);
    
    try {
      const base64Data = image.src.split(',')[1];
      const texts = await detectText(base64Data, image.file.type);
      setDetectedObjects(texts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [image]);
  
  const handleObjectAction = useCallback((action: 'isolate' | 'remove') => {
    if (selectedObjects.length === 0) return;
    
    if (action === 'isolate' && selectedObjects.length > 1) {
      setError("Please select only one object to isolate.");
      return;
    }
    
    let actionPrompt = '';
    if (action === 'isolate') {
      const { label, boundingBox } = selectedObjects[0];
      const { x_min, y_min, x_max, y_max } = boundingBox;
      const bboxString = `[${y_min.toFixed(4)}, ${x_min.toFixed(4)}, ${y_max.toFixed(4)}, ${x_max.toFixed(4)}]`;
      actionPrompt = `Isolate the ${label} located within the bounding box (y_min, x_min, y_max, x_max) ${bboxString}. Make the background transparent.`;
    } else { // remove
      const objectsToRemove = selectedObjects.map((obj, i) => 
        `${i+1}. The object '${obj.label}' located within bounding box [${obj.boundingBox.y_min.toFixed(4)}, ${obj.boundingBox.x_min.toFixed(4)}, ${obj.boundingBox.y_max.toFixed(4)}, ${obj.boundingBox.x_max.toFixed(4)}]`
      ).join('\n');
      actionPrompt = `Remove the following objects from the image and inpaint their areas naturally to match the surroundings:\n${objectsToRemove}`;
    }
    
    handleGenerate(actionPrompt);

  }, [selectedObjects, handleGenerate]);
  
  const handleObjectSelect = useCallback((object: DetectedObject) => {
    setSelectedObjects(prevSelected => {
      const isSelected = prevSelected.some(obj => areObjectsEqual(obj, object));
      if (isSelected) {
        return prevSelected.filter(obj => !areObjectsEqual(obj, object));
      } else {
        return [...prevSelected, object];
      }
    });
  }, []);

  const handleTranslate = useCallback(async () => {
    if (selectedObjects.length === 0) return;

    const objectsToTranslate = selectedObjects.map((obj, i) => 
        `${i + 1}. Original Text: "${obj.label}", Bounding Box (y_min, x_min, y_max, x_max): [${obj.boundingBox.y_min.toFixed(4)}, ${obj.boundingBox.x_min.toFixed(4)}, ${obj.boundingBox.y_max.toFixed(4)}, ${obj.boundingBox.x_max.toFixed(4)}]`
      ).join('\n');
    
    const translationPrompt = `Translate the text in the following regions from Chinese to Korean. Then, replace the original text with the Korean translation. Ensure the new text fits naturally in the same location and matches the original style (font, color, size) as closely as possible.

Here are the text regions to translate:
${objectsToTranslate}
`;

    handleGenerate(translationPrompt);
  }, [selectedObjects, handleGenerate]);

  // --- Compositor Handlers ---
  const handleObjectImageChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setObjectImage({ src: await fileToBase64(file), file });
    }
  }, []);

  const handleBackgroundImageChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackgroundImage({ src: await fileToBase64(file), file });
      setGeneratedBackground(null); // Clear generated bg if user uploads one
    }
  }, []);

  const handleGenerateBackground = useCallback(async () => {
    if (!backgroundPrompt) {
      setError("Please enter a prompt for the background.");
      return;
    }
    setIsGeneratingBg(true);
    setError(null);
    try {
      const generatedBase64 = await generateImageFromPrompt(backgroundPrompt);
      setGeneratedBackground(`data:image/png;base64,${generatedBase64}`);
      setBackgroundImage(null); // Clear uploaded bg
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate background.');
    } finally {
      setIsGeneratingBg(false);
    }
  }, [backgroundPrompt]);

  const handleComposite = useCallback(async () => {
    const backgroundSrc = backgroundImage?.src || generatedBackground;
    if (!objectImage || !backgroundSrc) {
      setError("Please provide both an object and a background image.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResultImage(null);
    try {
      const result = await compositeImages(objectImage.src, backgroundSrc);
      setResultImage(result);
    } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to composite images.');
    } finally {
      setIsLoading(false);
    }
  }, [objectImage, backgroundImage, generatedBackground]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            Image Factory
          </h1>
          <p className="mt-2 text-lg text-gray-400">Advanced AI Image Editing & Composition</p>
        </header>

        <main className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg flex flex-col">
              <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-6">
                 <h2 className="text-2xl font-bold">
                    1. Main Editor
                 </h2>
              </div>
              {image ? (
                <ImagePreview 
                  src={image.src} 
                  onClear={clearImage}
                  detectedObjects={detectedObjects}
                  selectedObjects={selectedObjects}
                  onObjectSelect={handleObjectSelect}
                />
              ) : (
                <ImagePlaceholder onFileChange={handleFileChange} />
              )}
            </div>
            
            <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold border-b border-gray-700 pb-3 mb-6">
                2. Result
              </h2>
              <ResultDisplay image={resultImage} isLoading={isLoading} error={error} />
            </div>
          </div>
          
          <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3 mb-6">
              🛠️ Object & Text Tools
            </h2>
             <p className="text-sm text-gray-400 -mt-4 mb-4">
              First, use a detection tool. Then, click a box on the image to select an item for editing.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
               <div className="flex flex-col sm:flex-row md:flex-col gap-4">
                <button
                  onClick={handleDetectObjects}
                  disabled={!image || isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  <ObjectDetectIcon className="w-6 h-6" />
                  Detect Objects
                </button>
                <button
                  onClick={handleDetectText}
                  disabled={!image || isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  <TextScanIcon className="w-6 h-6" />
                  Detect Text
                </button>
              </div>
              
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <button
                    onClick={() => handleObjectAction('isolate')}
                    disabled={selectedObjects.length !== 1 || isLoading}
                    className="flex items-center justify-center gap-2 bg-teal-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    title={selectedObjects.length !== 1 ? "Please select exactly one object to isolate" : "Isolate object"}
                  >
                    <IsolateIcon className="w-6 h-6" />
                    Isolate
                  </button>
                  <button
                    onClick={() => handleObjectAction('remove')}
                    disabled={selectedObjects.length === 0 || isLoading}
                    className="flex items-center justify-center gap-2 bg-rose-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    title={selectedObjects.length === 0 ? "Select one or more objects to remove" : "Remove selected object(s)"}
                  >
                    <TrashIcon className="w-6 h-6" />
                    Remove
                  </button>
                  <button
                    onClick={handleTranslate}
                    disabled={selectedObjects.length === 0 || isLoading}
                    className="flex items-center justify-center gap-2 bg-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    title={selectedObjects.length === 0 ? "Select one or more text objects to translate" : "Translate selected text to Korean"}
                  >
                    <TranslateIcon className="w-6 h-6" />
                    번역
                  </button>
              </div>
            </div>
             {detectedObjects.length > 0 && selectedObjects.length === 0 && (
              <p className="text-center text-cyan-300 mt-4 text-sm animate-fade-in">
                Detection complete. Click on a box on the image to select an item.
              </p>
            )}
             {selectedObjects.length > 0 && (
              <p className="text-center text-green-300 mt-4 text-sm animate-fade-in">
                Selected: <span className="font-bold">{selectedObjects.length} item(s)</span>. Now choose an action.
              </p>
            )}
          </div>

          <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3 mb-6">
              🎯 Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(EDIT_PRESETS).map(([key, preset]) => (
                <QuickActionButton
                  key={key}
                  icon={<span className="text-4xl">{preset.icon}</span>}
                  label={preset.label}
                  onClick={() => handleQuickEdit(key as PresetKey)}
                  disabled={!image || isLoading || selectedObjects.length > 1}
                  loading={isLoading && activePreset === key}
                />
              ))}
            </div>
            {selectedObjects.length > 1 && <p className="text-center text-yellow-400 mt-4 text-xs">Quick Actions are disabled when multiple objects are selected.</p>}
          </div>
          
          {/* Background Compositor */}
          <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3 mb-6">
              🖼️ Background Compositor
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Object Image Column */}
              <div className='space-y-2'>
                  <h3 className="font-semibold text-lg text-center">Object Image</h3>
                  {objectImage ? (
                      <ImagePreview src={objectImage.src} onClear={() => setObjectImage(null)} />
                  ) : (
                      <ImagePlaceholder onFileChange={handleObjectImageChange} id="object-image-upload" />
                  )}
              </div>
              
              {/* Background Column */}
              <div className='space-y-2'>
                <h3 className="font-semibold text-lg text-center">Background</h3>
                <div className="flex justify-center bg-gray-900/50 p-1 rounded-lg mb-2">
                  <button onClick={() => setCompositorBgMode('generate')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors w-1/2 ${compositorBgMode === 'generate' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Generate</button>
                  <button onClick={() => setCompositorBgMode('upload')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors w-1/2 ${compositorBgMode === 'upload' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Upload</button>
                </div>
                
                {compositorBgMode === 'upload' && (
                  backgroundImage ? (
                    <ImagePreview src={backgroundImage.src} onClear={() => setBackgroundImage(null)} />
                  ) : (
                    <ImagePlaceholder onFileChange={handleBackgroundImageChange} id="background-image-upload" />
                  )
                )}
                
                {compositorBgMode === 'generate' && (
                  <div className="space-y-4">
                    <textarea
                      value={backgroundPrompt}
                      onChange={(e) => setBackgroundPrompt(e.target.value)}
                      placeholder="e.g., A mountain landscape at sunrise"
                      className="w-full h-20 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleGenerateBackground}
                      disabled={isGeneratingBg}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isGeneratingBg ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <WandIcon className="w-5 h-5" />}
                      Generate Background
                    </button>
                    {generatedBackground && (
                        <div className="relative">
                          <p className="text-xs text-center mb-2 text-gray-400">Generated Background:</p>
                          <ImagePreview src={generatedBackground} onClear={() => setGeneratedBackground(null)} />
                        </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8">
               <button
                  onClick={handleComposite}
                  disabled={!objectImage || (!backgroundImage && !generatedBackground) || isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-4 px-4 rounded-lg shadow-lg text-xl transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  <ImageIcon className="w-8 h-8"/>
                  Composite Images
                </button>
            </div>
          </div>


          <div className="bg-gray-800/50 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold border-b border-gray-700 pb-3 mb-6">
              ⚙️ Advanced Options
            </h2>
            <div className="flex flex-col gap-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Or enter a custom prompt for the main editor..."
                className="w-full h-24 p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                disabled={!image || isLoading}
              />
              <button
                onClick={() => handleGenerate()}
                disabled={!image || !prompt || isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isLoading && !activePreset ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-6 h-6" />
                    Generate with Custom Prompt
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}