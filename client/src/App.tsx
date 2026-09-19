import React, { useState, useEffect } from 'react';
import { StylizerAPI } from './stylizer-api';
import { StyleAnalysis, ImageUploadState, ProcessingState } from './types';

// Inicializē API klientu
const apiClient = new StylizerAPI();

function App() {
  // State management - Trūkstošie failu stāvokļi
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [styleImage, setStyleImage] = useState<File | null>(null);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(null);
  const [styleImageUrl, setStyleImageUrl] = useState<string | null>(null);

  const [enhancedPrompt, setEnhancedPrompt] = useState<string>('');
  const [currentPrompt, setCurrentPrompt] = useState<string>('No prompt available');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Processing state
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isAnalyzing: false,
    isOptimizing: false,
    isProcessing: false,
    progress: 0,
    error: null
  });

  // Handle file drops for target image
  const handleTargetDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setTargetImage(file);
      setTargetImageUrl(URL.createObjectURL(file));
    }
  };

  // Handle file drops for style image
  const handleStyleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setStyleImage(file);
      setStyleImageUrl(URL.createObjectURL(file));
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'target' | 'style') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (type === 'target') {
        setTargetImage(file);
        setTargetImageUrl(URL.createObjectURL(file));
      } else {
        setStyleImage(file);
        setStyleImageUrl(URL.createObjectURL(file));
      }
    }
  };

  // Analyze style of the style image
  const handleAnalyzeStyle = async () => {
    if (!styleImage) {
      setProcessingState(prev => ({ ...prev, error: 'Please select a style image first' }));
      return;
    }

    setProcessingState(prev => ({
      ...prev,
      isAnalyzing: true,
      error: null
    }));

    try {
      const analysis = await apiClient.analyzeStyle(styleImage);
      const enhanced = `Create an image in the style of ${analysis.style}, with ${analysis.colors.join(', ')}, and ${analysis.composition} composition`;
      setEnhancedPrompt(enhanced);
      setCurrentPrompt(enhanced);
    } catch (error) {
      console.error('Error analyzing style:', error);
      setProcessingState(prev => ({
        ...prev,
        error: 'Failed to analyze style. Please try again.'
      }));
    } finally {
      setProcessingState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  // Optimize the prompt
  const handleOptimizePrompt = async () => {
    if (!enhancedPrompt) {
      setProcessingState(prev => ({ ...prev, error: 'Please analyze a style first' }));
      return;
    }

    setProcessingState(prev => ({
      ...prev,
      isOptimizing: true,
      error: null
    }));

    try {
      const result = await apiClient.optimizePrompt(enhancedPrompt);
      setEnhancedPrompt(result.optimized_prompt);
      setCurrentPrompt(result.optimized_prompt);
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      setProcessingState(prev => ({
        ...prev,
        error: 'Failed to optimize prompt. Please try again.'
      }));
    } finally {
      setProcessingState(prev => ({ ...prev, isOptimizing: false }));
    }
  };

  // Perform style transfer
  const handleStyleTransfer = async () => {
    if (!targetImage || !styleImage) {
      setProcessingState(prev => ({
        ...prev,
        error: 'Please select both target and style images'
      }));
      return;
    }

    setProcessingState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      error: null
    }));

    try {
      const interval = setInterval(() => {
        setProcessingState(prev => {
          if (prev.progress >= 100) {
            clearInterval(interval);
            return { ...prev, isProcessing: false };
          }
          return { ...prev, progress: prev.progress + 10 };
        });
      }, 200);

      const result = await apiClient.styleTransfer(targetImage, styleImage, enhancedPrompt);

      clearInterval(interval);
      setProcessingState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100
      }));

      setGeneratedImage(result.result_url);
    } catch (error) {
      console.error('Error in style transfer:', error);
      setProcessingState(prev => ({
        ...prev,
        error: 'Failed to perform style transfer. Please try again.'
      }));
    }
  };

  // Reset all
  const handleReset = () => {
    setTargetImage(null);
    setStyleImage(null);
    setTargetImageUrl(null);
    setStyleImageUrl(null);
    setEnhancedPrompt('');
    setCurrentPrompt('No prompt available');
    setGeneratedImage(null);
    setProcessingState({
      isAnalyzing: false,
      isOptimizing: false,
      isProcessing: false,
      progress: 0,
      error: null
    });
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (targetImageUrl) URL.revokeObjectURL(targetImageUrl);
      if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
    };
  }, [targetImageUrl, styleImageUrl]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Image Stylizer</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Upload Zones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Target Image Upload */}
          <div
            className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            onDrop={handleTargetDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <h2 className="text-lg font-semibold mb-4">Target Image</h2>
            {targetImageUrl ? (
              <div className="flex justify-center">
                <img
                  src={targetImageUrl}
                  alt="Target"
                  className="max-h-64 rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-8 text-center min-h-[200px]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-400 mb-2">Drop your target image here</p>
                <p className="text-gray-500 text-sm mb-4">or</p>
                <label className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm cursor-pointer">
                  Select Image
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'target')}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Style Image Upload */}
          <div
            className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            onDrop={handleStyleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <h2 className="text-lg font-semibold mb-4">Style Image</h2>
            {styleImageUrl ? (
              <div className="flex justify-center">
                <img
                  src={styleImageUrl}
                  alt="Style"
                  className="max-h-64 rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-8 text-center min-h-[200px]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-400 mb-2">Drop your style image here</p>
                <p className="text-gray-500 text-sm mb-4">or</p>
                <label className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm cursor-pointer">
                  Select Image
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'style')}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Prompt Enhancement Section */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Prompt Enhancement</h2>
            <div className="flex gap-2">
              <button
                onClick={handleAnalyzeStyle}
                disabled={processingState.isAnalyzing || !styleImage}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${processingState.isAnalyzing
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {processingState.isAnalyzing ? 'Analyzing...' : 'Analyze Style'}
              </button>
              <button
                onClick={handleOptimizePrompt}
                disabled={processingState.isOptimizing || !enhancedPrompt}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${processingState.isOptimizing
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
                  }`}
              >
                {processingState.isOptimizing ? 'Optimizing...' : 'Optimize Prompt'}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium mb-2">Enhanced Prompt</label>
            <textarea
              id="prompt"
              rows={3}
              value={enhancedPrompt}
              onChange={(e) => setEnhancedPrompt(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enhanced prompt will appear after analyzing the style image..."
            />
          </div>
        </div>

        {/* Processing Controls */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Processing</h2>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">Current Prompt:</p>
              <p className="bg-gray-700/50 p-3 rounded-lg text-sm truncate">{currentPrompt}</p>
            </div>
          </div>

          {/* Progress bar */}
          {processingState.isProcessing && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span>Processing...</span>
                <span>{processingState.progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${processingState.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error message */}
          {processingState.error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm">
              {processingState.error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleStyleTransfer}
              disabled={processingState.isProcessing || !targetImage || !styleImage}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${processingState.isProcessing || !targetImage || !styleImage
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {processingState.isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Apply Style'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 transition-colors text-sm"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>

        {/* Result Display */}
        {generatedImage && (
          <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">Result</h2>
            <div className="flex justify-center">
              <img
                src={generatedImage}
                alt="Generated result"
                className="max-h-96 rounded-lg object-contain"
              />
            </div>
            <div className="mt-4 flex justify-center">
              <a
                href={generatedImage}
                download={`stylized-image-${Date.now()}.png`}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-sm"
              >
                Download Result
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>Image Stylizer Dashboard • Apple-inspired Dark Mode UI</p>
        </div>
      </footer>
    </div>
  );
}

export default App;