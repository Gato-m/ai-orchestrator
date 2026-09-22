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
    // Tiešais savienojums ar Express backend portu 3000
    this.baseUrl = 'http://127.0.0.1:3000';
  }

  /**
   * Palīgfunkcija File objekta konvertēšanai uz Base64 teksta virkni
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  /**
   * Attēla stila analīze ar Ollama (llava)
   * Pieņem gan Base64 tekstu, gan File objektu.
   */
  async analyzeStyle(imageInput: string | File): Promise<string> {
    try {
      let base64String = '';

      if (imageInput instanceof File) {
        base64String = await this.fileToBase64(imageInput);
      } else if (typeof imageInput === 'string') {
        base64String = imageInput;
      } else {
        throw new Error('Nekorekts attēla formāts. Gaidīts File vai Base64 string.');
      }

      if (!base64String || base64String.trim() === '') {
        throw new Error('Attēla Base64 dati ir tukši.');
      }

      const response = await fetch(`${this.baseUrl}/api/analyze-style`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: base64String }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data.styleDescription) {
        throw new Error('Serveris neatgrieza stila aprakstu');
      }

      return data.styleDescription;
    } catch (error: any) {
      console.error('Kļūda izpildot analyzeStyle:', error);
      throw error;
    }
  }

  /**
   * Prompta optimizācija ar Qwen
   */
  async optimizePrompt(prompt: string): Promise<{ optimizedPrompt: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/optimize-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to optimize prompt: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      throw error;
    }
  }

  /**
   * Stila pārnese (Style Transfer) ar ComfyUI
   */
  async styleTransfer(
    targetImage: File,
    styleImage: File,
    prompt: string,
    styleStrength: number = 30
  ): Promise<{ success: boolean; image: string; promptId: string }> {
    const formData = new FormData();
    // Atbilst multer upload.fields([{ name: 'image' }, { name: 'style' }])
    formData.append('image', targetImage);
    formData.append('style', styleImage);
    formData.append('prompt', prompt);
    formData.append('styleStrength', styleStrength.toString());

    try {
      const response = await fetch(`${this.baseUrl}/api/style-transfer`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to perform style transfer: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in style transfer:', error);
      throw error;
    }
  }

  /**
   * Iegūst visus ģenerētos attēlus
   */
  async getGeneratedImages(): Promise<GeneratedImage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generated-images`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch generated images: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching generated images:', error);
      throw error;
    }
  }
}