export interface ScanQuality {
  isSharp: boolean;
  blurScore: number;
  hasDocumentEdges: boolean;
  documentCorners: Array<{ x: number; y: number }> | null;
  qualityMessage: string;
  fillPercentage: number;
}

export class DocumentScanner {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  // Calculate blur score using Laplacian variance
  private calculateBlurScore(imageData: ImageData): number {
    const { data, width, height } = imageData;
    const gray = new Float32Array(width * height);

    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Apply Laplacian operator
    let variance = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const laplacian =
          -gray[idx - width - 1] - gray[idx - width] - gray[idx - width + 1] -
          gray[idx - 1] + 8 * gray[idx] - gray[idx + 1] -
          gray[idx + width - 1] - gray[idx + width] - gray[idx + width + 1];
        variance += laplacian * laplacian;
      }
    }

    return variance / ((width - 2) * (height - 2));
  }

  // Detect document edges and corners
  private detectDocumentEdges(imageData: ImageData): {
    corners: Array<{ x: number; y: number }> | null;
    fillPercentage: number;
  } {
    const { data, width, height } = imageData;
    
    // Simple edge detection - convert to binary
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      binary[i / 4] = gray > 128 ? 255 : 0;
    }

    // Find document contours (simplified - look for large rectangles)
    const minArea = (width * height) * 0.25; // Document should be at least 25% of frame
    let largestArea = 0;
    let corners: Array<{ x: number; y: number }> | null = null;

    // Scan for edges
    let topLeft = { x: width, y: height };
    let bottomRight = { x: 0, y: 0 };
    let edgeCount = 0;

    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const idx = y * width + x;
        if (binary[idx] === 0) {
          edgeCount++;
          if (x < topLeft.x) topLeft.x = x;
          if (y < topLeft.y) topLeft.y = y;
          if (x > bottomRight.x) bottomRight.x = x;
          if (y > bottomRight.y) bottomRight.y = y;
        }
      }
    }

    const area = (bottomRight.x - topLeft.x) * (bottomRight.y - topLeft.y);
    if (area > minArea && edgeCount > 100) {
      largestArea = area;
      corners = [
        topLeft,
        { x: bottomRight.x, y: topLeft.y },
        bottomRight,
        { x: topLeft.x, y: bottomRight.y }
      ];
    }

    const fillPercentage = (largestArea / (width * height)) * 100;
    return { corners, fillPercentage };
  }

  // Main scan quality check
  public async checkQuality(
    videoElement: HTMLVideoElement
  ): Promise<ScanQuality> {
    const { videoWidth, videoHeight } = videoElement;
    this.canvas.width = videoWidth;
    this.canvas.height = videoHeight;

    this.ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
    const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight);

    // Calculate blur
    const blurScore = this.calculateBlurScore(imageData);
    const isSharp = blurScore > 100;

    // Detect document
    const { corners, fillPercentage } = this.detectDocumentEdges(imageData);
    const hasDocumentEdges = corners !== null && fillPercentage > 40;

    // Generate quality message
    let qualityMessage = '';
    if (!hasDocumentEdges) {
      qualityMessage = '📄 Position document in frame';
    } else if (fillPercentage < 40) {
      qualityMessage = '📐 Move closer';
    } else if (!isSharp) {
      qualityMessage = '⚠️ Hold steady - image is blurry';
    } else {
      qualityMessage = '✓ Ready to capture';
    }

    return {
      isSharp,
      blurScore,
      hasDocumentEdges,
      documentCorners: corners,
      qualityMessage,
      fillPercentage
    };
  }

  // Capture image from video
  public captureImage(videoElement: HTMLVideoElement): string {
    const { videoWidth, videoHeight } = videoElement;
    this.canvas.width = videoWidth;
    this.canvas.height = videoHeight;
    this.ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
    return this.canvas.toDataURL('image/jpeg', 0.95);
  }
}
