import React, { useState, useEffect } from 'react';
import { StylizerAPI } from './stylizer-api';
import { ProcessingState } from './types';

const apiClient = new StylizerAPI();

interface ServerStatus {
  nodeServer: boolean;
  frontendServer: boolean;
  comfyServer: boolean;
  ollamaServer: boolean;
}

function App() {
  const [targetImage, setTargetImage] = useState<File | null>(null);
  const [styleImage, setStyleImage] = useState<File | null>(null);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(null);
  const [styleImageUrl, setStyleImageUrl] = useState<string | null>(null);

  const [enhancedPrompt, setEnhancedPrompt] = useState<string>('');
  const [currentPrompt, setCurrentPrompt] = useState<string>('No prompt available');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const [processingState, setProcessingState] = useState<ProcessingState>({
    isAnalyzing: false,
    isOptimizing: false,
    isProcessing: false,
    progress: 0,
    error: null
  });

  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    nodeServer: false,
    frontendServer: true,
    comfyServer: false,
    ollamaServer: false
  });

  const checkServersHealth = async () => {
    // 1. Node Server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const resNode = await fetch('http://127.0.0.1:3000/health', {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      setServerStatus(prev => ({ ...prev, nodeServer: resNode.ok }));
    } catch {
      setServerStatus(prev => ({ ...prev, nodeServer: false }));
    }

    // 2. Frontend
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const resFrontend = await fetch(window.location.origin, {
        method: 'HEAD',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      setServerStatus(prev => ({ ...prev, frontendServer: resFrontend.ok || true }));
    } catch {
      setServerStatus(prev => ({ ...prev, frontendServer: true }));
    }

    // 3. ComfyUI Server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('http://127.0.0.1:8188/system_stats', {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      setServerStatus(prev => ({ ...prev, comfyServer: true }));
    } catch {
      setServerStatus(prev => ({ ...prev, comfyServer: false }));
    }

    // 4. Ollama Server (ports 11434)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch('http://127.0.0.1:11434/api/tags', {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      setServerStatus(prev => ({ ...prev, ollamaServer: true }));
    } catch {
      setServerStatus(prev => ({ ...prev, ollamaServer: false }));
    }
  };

  useEffect(() => {
    checkServersHealth();
    const interval = setInterval(checkServersHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTargetDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setTargetImage(file);
      setTargetImageUrl(URL.createObjectURL(file));
    }
  };

  const handleStyleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setStyleImage(file);
      setStyleImageUrl(URL.createObjectURL(file));
    }
  };

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

  // VAIROGS: Tiešs izsaukums uz backendu
  const executeTranslation = async (text: string): Promise<string> => {
    try {
      // Pirmkārt mēģinām izsaukt caur API klientu
      let result = await apiClient.translatePrompt(text);

      // Ja rezultāts ir identisks vai tukšs, sūtām tiešu HTTP pieprasījumu uz backendu
      if (!result || result === text) {
        console.log('🔄 [App.tsx] API klients atgrieza oriģinālu, sūtām tiešo fetch uz localhost:3000...');
        const response = await fetch('http://localhost:3000/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text })
        });

        if (response.ok) {
          const data = await response.json();
          result = data.translatedPrompt || data.translatedText || data.translation || text;
        }
      }
      return result || text;
    } catch (err) {
      console.error('❌ Kļūda tulkošanas izpildē:', err);
      return text;
    }
  };

  // 1. STILA ANALĪZE + AUTOMĀTISKĀ TULKOŠANA
  const handleAnalyzeStyle = async () => {
    if (!styleImage) return;
    setProcessingState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    try {
      console.log('🔄 Sākam stila analīzi...');
      const analysisText = await apiClient.analyzeStyle(styleImage);

      const cleanAnalysis = analysisText
        .trim()
        .replace(/^["'“`]+|["'”`]+$/g, '')
        .replace(/^Artistic style:\s*/i, '');

      console.log('👉 [Frontend] Veicam automātisko EN -> LV tulkošanu saņemtajai analīzei...');
      setIsTranslating(true);

      const translatedText = await executeTranslation(cleanAnalysis);

      console.log('✅ [Frontend] Iestatām galīgo tekstu:', translatedText);
      setEnhancedPrompt(translatedText);
      setCurrentPrompt(translatedText);

    } catch (error: any) {
      console.error('❌ Stila analīzes vai tulkošanas kļūda:', error);
      setProcessingState(prev => ({ ...prev, error: error.message || 'Kļūda stila analīzē' }));
    } finally {
      setIsTranslating(false);
      setProcessingState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  // 2. MANUĀLĀ TULKOŠANA (POGA)
  const handleTranslatePrompt = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    const textToTranslate = enhancedPrompt || (currentPrompt !== 'No prompt available' ? currentPrompt : '');

    if (!textToTranslate || !textToTranslate.trim()) {
      console.warn('⚠️ Nav teksta ko tulkot!');
      return;
    }

    console.log('👉 [Frontend] Sūtām tulkošanas pieprasījumu:', textToTranslate);
    setIsTranslating(true);
    setProcessingState(prev => ({ ...prev, error: null }));

    try {
      const translatedText = await executeTranslation(textToTranslate);
      console.log('✅ [Frontend] Saņemts tulkojums:', translatedText);

      if (translatedText) {
        setEnhancedPrompt(translatedText);
        setCurrentPrompt(translatedText);
      }
    } catch (error: any) {
      console.error('❌ [Frontend] Kļūda tulkojot:', error);
      setProcessingState(prev => ({ ...prev, error: error.message || 'Kļūda tulkojot' }));
    } finally {
      setIsTranslating(false);
    }
  };

  // 3. PROMPTA OPTIMIZĒŠANA
  const handleOptimizePrompt = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    const textToOptimize = enhancedPrompt || (currentPrompt !== 'No prompt available' ? currentPrompt : '');

    if (!textToOptimize || !textToOptimize.trim()) return;

    console.log('👉 [Frontend] Sūtām optimizēšanas pieprasījumu:', textToOptimize);
    setProcessingState(prev => ({ ...prev, isOptimizing: true, error: null }));

    try {
      const result = await apiClient.optimizePrompt(textToOptimize);
      const textResult = result.optimizedPrompt || (result as any).optimized_prompt || textToOptimize;

      console.log('✅ [Frontend] Saņemts optimizētais prompts:', textResult);
      setEnhancedPrompt(textResult);
      setCurrentPrompt(textResult);
    } catch (error: any) {
      console.error('❌ [Frontend] Kļūda optimizējot:', error);
      setProcessingState(prev => ({ ...prev, error: error.message || 'Kļūda optimizējot' }));
    } finally {
      setProcessingState(prev => ({ ...prev, isOptimizing: false }));
    }
  };

  // 4. STYLE TRANSFER AR COMFYUI
  const handleStyleTransfer = async () => {
    if (!targetImage || !styleImage) return;
    setProcessingState(prev => ({ ...prev, isProcessing: true, progress: 0, error: null }));

    const interval = setInterval(() => {
      setProcessingState(prev => {
        if (prev.progress >= 90) return prev;
        return { ...prev, progress: prev.progress + 10 };
      });
    }, 500);

    try {
      const result = await apiClient.styleTransfer(targetImage, styleImage, enhancedPrompt);
      clearInterval(interval);
      setProcessingState(prev => ({ ...prev, isProcessing: false, progress: 100 }));
      setGeneratedImage(result.image || (result as any).result_url);
    } catch (error: any) {
      clearInterval(interval);
      setProcessingState(prev => ({ ...prev, isProcessing: false, error: error.message || 'Kļūda apstrādē' }));
    }
  };

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

  useEffect(() => {
    return () => {
      if (targetImageUrl) URL.revokeObjectURL(targetImageUrl);
      if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
    };
  }, [targetImageUrl, styleImageUrl]);

  const activePromptText = enhancedPrompt || (currentPrompt !== 'No prompt available' ? currentPrompt : '');

  return (
    <div className="min-h-screen bg-[#0d111a] text-slate-200 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0d111a]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-white font-bold text-base">AI</span>
            </div>
            <h1 className="text-2xl font-bold tracking-wide text-white">AI Orchestrator</h1>
          </div>
          <div className="text-lg text-slate-400 font-medium">Image Stylizer</div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-[1600px] w-full mx-auto px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT SIDEBAR (2/12) */}
        <aside className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-4 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
            <h2 className="text-base font-semibold text-slate-300 mb-3 tracking-wider uppercase">Agents</h2>
            <nav className="flex flex-col gap-2 w-full">
              <button className="w-full text-left px-3.5 py-2.5 rounded-lg bg-slate-800/80 border border-cyan-500/40 text-cyan-300 font-medium text-base flex items-center shadow-sm shadow-cyan-500/10 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-2 flex-shrink-0 shadow-sm shadow-cyan-400"></span>
                <span className="truncate">Image Workflows</span>
              </button>
              <button disabled className="w-full text-left px-3.5 py-2.5 rounded-lg text-slate-500 font-medium text-base cursor-not-allowed hover:bg-slate-800/20 transition-colors truncate">Infographics</button>
              <button disabled className="w-full text-left px-3.5 py-2.5 rounded-lg text-slate-500 font-medium text-base cursor-not-allowed hover:bg-slate-800/20 transition-colors truncate">Web Design</button>
              <button disabled className="w-full text-left px-3.5 py-2.5 rounded-lg text-slate-500 font-medium text-base cursor-not-allowed hover:bg-slate-800/20 transition-colors truncate">Code Workflow</button>
            </nav>
          </div>

          <div className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-4 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
            <h2 className="text-base font-semibold text-slate-300 mb-3 tracking-wider uppercase">System</h2>

            <div className="border border-slate-600/80 bg-slate-900/40 rounded-lg p-3 space-y-3">
              <div className="flex items-center space-x-2 text-base font-medium truncate">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300 ${serverStatus.nodeServer ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.5)]'}`}></span>
                <span className={`truncate ${serverStatus.nodeServer ? 'text-slate-200' : 'text-slate-500'}`}>Node Server</span>
              </div>

              <div className="flex items-center space-x-2 text-base font-medium truncate">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300 ${serverStatus.frontendServer ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.5)]'}`}></span>
                <span className={`truncate ${serverStatus.frontendServer ? 'text-slate-200' : 'text-slate-500'}`}>Frontend</span>
              </div>

              <div className="flex items-center space-x-2 text-base font-medium truncate">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300 ${serverStatus.comfyServer ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.5)]'}`}></span>
                <span className={`truncate ${serverStatus.comfyServer ? 'text-slate-200' : 'text-slate-500'}`}>Comfy Server</span>
              </div>

              <div className="flex items-center space-x-2 text-base font-medium truncate">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300 ${serverStatus.ollamaServer ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.5)]'}`}></span>
                <span className={`truncate ${serverStatus.ollamaServer ? 'text-slate-200' : 'text-slate-500'}`}>Ollama Server</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER CONTENT (8/12) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Target Image Box */}
            <div
              className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300"
              onDrop={handleTargetDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Target Image</h3>
                {targetImageUrl && (
                  <button onClick={() => { setTargetImage(null); setTargetImageUrl(null); }} className="text-base text-red-400 hover:text-red-300 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              {targetImageUrl ? (
                <div className="flex justify-center items-center h-52 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-600/80">
                  <img src={targetImageUrl} alt="Target" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border border-dashed border-slate-600/80 rounded-lg p-6 text-center h-52 bg-slate-900/30 hover:border-slate-500 transition-colors">
                  <svg className="h-10 w-10 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-base text-slate-400 mb-1">Drop your target image here</p>
                  <p className="text-sm text-slate-500 mb-3">or</p>
                  <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-base cursor-pointer border border-slate-600/80 transition-colors font-medium">
                    Select Image
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'target')} />
                  </label>
                </div>
              )}
            </div>

            {/* Style Image Box */}
            <div
              className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300"
              onDrop={handleStyleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Style Image</h3>
                {styleImageUrl && (
                  <button onClick={() => { setStyleImage(null); setStyleImageUrl(null); }} className="text-base text-red-400 hover:text-red-300 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              {styleImageUrl ? (
                <div className="flex justify-center items-center h-52 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-600/80">
                  <img src={styleImageUrl} alt="Style" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border border-dashed border-slate-600/80 rounded-lg p-6 text-center h-52 bg-slate-900/30 hover:border-slate-500 transition-colors">
                  <svg className="h-10 w-10 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-base text-slate-400 mb-1">Drop your style image here</p>
                  <p className="text-sm text-slate-500 mb-3">or</p>
                  <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-base cursor-pointer border border-slate-600/80 transition-colors font-medium">
                    Select Image
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'style')} />
                  </label>
                </div>
              )}
            </div>

          </div>

          {/* Prompt Enhancement Section */}
          <div className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-slate-200">Prompt Enhancement</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAnalyzeStyle}
                  disabled={processingState.isAnalyzing || !styleImage}
                  className={`px-4 py-2 rounded-md font-medium transition-all text-base shadow-md ${processingState.isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'}`}
                >
                  {processingState.isAnalyzing ? 'Analyzing...' : 'Analyze Style'}
                </button>

                <button
                  type="button"
                  onClick={handleOptimizePrompt}
                  disabled={processingState.isOptimizing || !activePromptText}
                  className={`px-4 py-2 rounded-md font-medium transition-all text-base shadow-md ${processingState.isOptimizing || !activePromptText ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'}`}
                >
                  {processingState.isOptimizing ? 'Optimizing...' : 'Optimize Prompt'}
                </button>

                <button
                  type="button"
                  onClick={handleTranslatePrompt}
                  disabled={isTranslating || !activePromptText}
                  className={`px-4 py-2 rounded-md font-medium transition-all text-base shadow-md ${isTranslating || !activePromptText ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'}`}
                >
                  {isTranslating ? 'Translating...' : 'Translate (LV ⇄ EN)'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="prompt" className="block text-base font-medium text-slate-400 mb-2">Enhanced Prompt</label>
              <textarea
                id="prompt"
                rows={4}
                value={enhancedPrompt}
                onChange={(e) => {
                  setEnhancedPrompt(e.target.value);
                  setCurrentPrompt(e.target.value);
                }}
                className="w-full bg-slate-900/80 border border-slate-600/80 rounded-lg p-3 text-base text-slate-200 focus:outline-none focus:border-cyan-500/60 transition-colors resize-none placeholder:text-slate-600"
                placeholder="Enhanced prompt will appear after analyzing the style image, or write your own in LV/EN..."
              />
            </div>
          </div>

          {/* Processing Controls */}
          <div className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
            <h2 className="text-lg font-semibold text-slate-200 mb-3">Processing</h2>

            <div className="mb-4">
              <p className="text-base text-slate-400 mb-1.5">Current Prompt:</p>
              <div className="bg-slate-900/60 border border-slate-600/80 p-3.5 rounded-lg text-base text-slate-300 break-words font-mono min-h-[50px]">
                {currentPrompt}
              </div>
            </div>

            {/* Progress Bar */}
            {processingState.isProcessing && (
              <div className="mb-4">
                <div className="flex justify-between text-base text-slate-400 mb-1.5">
                  <span>Processing Style Transfer...</span>
                  <span>{processingState.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-cyan-500 h-2.5 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{ width: `${processingState.progress}%` }}></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {processingState.error && (
              <div className="mb-4 p-3.5 bg-red-950/40 border border-red-800/60 rounded-lg text-base text-red-300">
                {processingState.error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleStyleTransfer}
                disabled={processingState.isProcessing || !targetImage || !styleImage}
                className={`px-5 py-2.5 rounded-lg font-semibold text-base transition-all flex items-center shadow-md ${processingState.isProcessing || !targetImage || !styleImage ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-200 hover:bg-white text-slate-900 shadow-white/10'}`}
              >
                {processingState.isProcessing ? 'Processing...' : 'Apply Style'}
              </button>

              <button type="button" onClick={handleReset} className="px-4 py-2.5 rounded-lg font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors text-base border border-slate-600/80">
                Reset All
              </button>
            </div>
          </div>

          {/* Generated Result Output */}
          {generatedImage && (
            <div className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">Result</h2>
              <div className="flex justify-center bg-slate-900/60 rounded-lg p-2 border border-slate-600/80">
                <img src={generatedImage} alt="Generated result" className="max-h-96 rounded object-contain" />
              </div>
              <div className="mt-3 flex justify-end">
                <a href={generatedImage} download={`stylized-image-${Date.now()}.png`} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-base font-medium transition-colors">
                  Download Result
                </a>
              </div>
            </div>
          )}

        </section>

        {/* RIGHT SIDEBAR (2/12) */}
        <aside className="lg:col-span-2">
          <div className="bg-[#1a2234]/90 border border-slate-800 rounded-xl p-4 shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
            <h2 className="text-base font-semibold text-slate-300 mb-3 tracking-wider uppercase">Recent Prompts</h2>
            <div className="text-base text-slate-600 italic">Vēsture un saglabātie prompti tiks parādīti šeit...</div>
          </div>
        </aside>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-[#0d111a]/60 backdrop-blur-md py-4">
        <div className="max-w-[1600px] mx-auto px-6 text-center text-slate-500 text-base font-medium">
          Image Stylizer Dashboard • Apple-inspired Dark Mode UI
        </div>
      </footer>
    </div>
  );
}

export default App;