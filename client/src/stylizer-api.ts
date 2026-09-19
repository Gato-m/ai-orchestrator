// API service for image stylization operations
import { StyleAnalysis } from './types';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
}

export class StylizerAPI {
  private baseUrl: string;

  constructor() {
    // Use environment variable or default to localhost
    this.baseUrl = import.meta.env?.VITE_API_URL || '/api';
  }

  /**
   * Analyze the style of an image
   */
  async analyzeStyle(imageFile: File): Promise<StyleAnalysis> {
    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const response = await fetch(`${this.baseUrl}/api/analyze-style`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze style: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing style:', error);
      throw error;
    }
  }

  /**
   * Optimize a prompt for better stylization results
   */
  async optimizePrompt(prompt: string): Promise<{ optimized_prompt: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/optimize-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Failed to optimize prompt: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      throw error;
    }
  }

  /**
   * Perform style transfer on target and style images
   */
  async styleTransfer(
    targetImage: File,
    styleImage: File,
    prompt: string
  ): Promise<{ result_url: string }> {
    const formData = new FormData();
    formData.append('target_image', targetImage);
    formData.append('style_image', styleImage);
    formData.append('prompt', prompt);

    try {
      const response = await fetch(`${this.baseUrl}/api/style-transfer`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to perform style transfer: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in style transfer:', error);
      throw error;
    }
  }

  /**
   * Get all generated images
   */
  async getGeneratedImages(): Promise<GeneratedImage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generated-images`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch generated images: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching generated images:', error);
      throw error;
    }
  }
}