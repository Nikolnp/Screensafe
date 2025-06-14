import { createWorker, PSM, OEM } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  metadata: {
    language: string;
    processingTime: number;
    imageSize: { width: number; height: number };
  };
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  baseline: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

class OCRService {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('Initializing OCR worker...');
      
      this.worker = await createWorker('eng', OEM.LSTM_ONLY, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      await this.worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?@#$%^&*()_+-=[]{}|;:\'",.<>/?`~',
      });

      this.isInitialized = true;
      console.log('OCR Worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  async extractText(imageFile: File | string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      console.log('Starting OCR extraction...');
      
      // Initialize worker if needed
      await this.initialize();
      
      if (!this.worker) {
        throw new Error('OCR worker not initialized');
      }

      console.log('Processing image with OCR...');
      const { data } = await this.worker.recognize(imageFile);
      const processingTime = Date.now() - startTime;

      console.log('OCR extraction completed in', processingTime, 'ms');

      // Extract blocks with bounding boxes
      const blocks: OCRBlock[] = data.blocks?.map(block => ({
        text: block.text,
        confidence: block.confidence,
        bbox: block.bbox,
        baseline: block.baseline
      })) || [];

      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        blocks,
        metadata: {
          language: 'eng',
          processingTime,
          imageSize: {
            width: data.width || 0,
            height: data.height || 0
          }
        }
      };

      console.log('OCR Result:', {
        textLength: result.text.length,
        confidence: result.confidence,
        blocksCount: result.blocks.length
      });

      return result;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initializationPromise = null;
    }
  }

  // Mock OCR result for testing
  getMockOCRResult(): OCRResult {
    console.log('Using mock OCR data for testing');
    
    return {
      text: `Meeting with team tomorrow at 2 PM
Complete project proposal by Friday
Reminder: Doctor appointment next week
Achievement unlocked: 10 tasks completed!
Buy groceries: milk, bread, eggs
Call mom tonight
Deadline: Submit report by end of month`,
      confidence: 85.5,
      blocks: [
        {
          text: "Meeting with team tomorrow at 2 PM",
          confidence: 92.3,
          bbox: { x0: 10, y0: 20, x1: 300, y1: 45 },
          baseline: { x0: 10, y0: 40, x1: 300, y1: 40 }
        },
        {
          text: "Complete project proposal by Friday",
          confidence: 88.7,
          bbox: { x0: 10, y0: 50, x1: 280, y1: 75 },
          baseline: { x0: 10, y0: 70, x1: 280, y1: 70 }
        },
        {
          text: "Reminder: Doctor appointment next week",
          confidence: 91.2,
          bbox: { x0: 10, y0: 80, x1: 320, y1: 105 },
          baseline: { x0: 10, y0: 100, x1: 320, y1: 100 }
        },
        {
          text: "Achievement unlocked: 10 tasks completed!",
          confidence: 89.4,
          bbox: { x0: 10, y0: 110, x1: 350, y1: 135 },
          baseline: { x0: 10, y0: 130, x1: 350, y1: 130 }
        }
      ],
      metadata: {
        language: 'eng',
        processingTime: 2500,
        imageSize: { width: 400, height: 600 }
      }
    };
  }
}

export const ocrService = new OCRService();