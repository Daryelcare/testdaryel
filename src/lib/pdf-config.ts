import { pdfjs } from "react-pdf";

// Centralized PDF.js configuration optimized for Vite and CORS
const PDFJS_VERSION = pdfjs.version;

// Use jsDelivr CDN which supports CORS and has correct file paths
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

// Configure PDF.js worker globally
pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

// PDF viewer configuration constants
export const PDF_CONFIG = {
  workerSrc: PDFJS_WORKER_URL,
  defaultScale: 1.0,
  minScale: 0.25,
  maxScale: 3.0,
  scaleSteps: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0],
  defaultOptions: {
    renderTextLayer: false,
    renderAnnotationLayer: false,
  },
  keyboardShortcuts: {
    zoomIn: ['Equal', 'NumpadAdd', 'Plus'] as const,
    zoomOut: ['Minus', 'NumpadSubtract'] as const,
    nextPage: ['ArrowRight', 'PageDown', 'Space'] as const,
    prevPage: ['ArrowLeft', 'PageUp'] as const,
    firstPage: ['Home'] as const,
    lastPage: ['End'] as const,
    fitWidth: ['KeyW'] as const,
    fitPage: ['KeyF'] as const,
    resetZoom: ['Digit0', 'Numpad0'] as const,
  }
} as const;

// Zoom utility functions
export const zoomUtils = {
  getNextZoomLevel: (currentScale: number, direction: 'in' | 'out') => {
    const currentIndex = PDF_CONFIG.scaleSteps.findIndex(scale => scale >= currentScale);
    if (direction === 'in') {
      return PDF_CONFIG.scaleSteps[Math.min(currentIndex + 1, PDF_CONFIG.scaleSteps.length - 1)] || currentScale;
    } else {
      return PDF_CONFIG.scaleSteps[Math.max(currentIndex - 1, 0)] || currentScale;
    }
  },
  
  clampScale: (scale: number) => {
    return Math.max(PDF_CONFIG.minScale, Math.min(PDF_CONFIG.maxScale, scale));
  },
  
  formatScalePercent: (scale: number) => {
    return `${Math.round(scale * 100)}%`;
  }
};

// Error handling utilities
export const pdfErrorHandler = {
  getErrorMessage: (error: any) => {
    if (error.name === 'InvalidPDFException') {
      return 'Invalid PDF file. Please check the file format.';
    }
    if (error.name === 'MissingPDFException') {
      return 'PDF file not found. Please check the file path.';
    }
    if (error.name === 'UnexpectedResponseException') {
      return 'Failed to load PDF. Please try again.';
    }
    return `PDF Error: ${error.message || 'Unknown error occurred'}`;
  }
};