// Type definitions for stylizer application

export interface StyleAnalysis {
  style: string;
  colors: string[];
  composition: string;
  mood: string;
  prompt_template: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
}

export interface ImageUploadState {
  targetImage: File | null;
  styleImage: File | null;
  targetImageUrl: string | null;
  styleImageUrl: string | null;
}

export interface ProcessingState {
  isAnalyzing: boolean;
  isOptimizing: boolean;
  isProcessing: boolean;
  progress: number;
  error: string | null;
}