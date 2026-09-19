import React, { useState } from 'react';

function App() {
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [styleImage, setStyleImage] = useState<File | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Image Stylizer</h1>
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm">
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Upload Zones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Target Image Upload */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors">
            <h2 className="text-lg font-semibold mb-4">Target Image</h2>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-8 text-center min-h-[200px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 mb-2">Drop your target image here</p>
              <p className="text-gray-500 text-sm mb-4">or</p>
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm">
                Select Image
              </button>
            </div>
          </div>

          {/* Style Image Upload */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors">
            <h2 className="text-lg font-semibold mb-4">Style Image</h2>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-8 text-center min-h-[200px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 mb-2">Drop your style image here</p>
              <p className="text-gray-500 text-sm mb-4">or</p>
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm">
                Select Image
              </button>
            </div>
          </div>
        </div>

        {/* Prompt Enhancement Section */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Prompt Enhancement</h2>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-sm">
              Analyze Style
            </button>
          </div>
          
          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium mb-2">Enhanced Prompt</label>
            <textarea
              id="prompt"
              rows={3}
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
              <p className="bg-gray-700/50 p-3 rounded-lg text-sm truncate">No prompt available</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center justify-center">
              Apply Style
            </button>

            <div className="flex gap-2">
              <button className="px-4 py-3 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 transition-colors text-sm">
                Reset All
              </button>
            </div>
          </div>
        </div>
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