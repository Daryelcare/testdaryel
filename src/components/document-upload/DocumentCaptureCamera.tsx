import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, RotateCcw, Check } from 'lucide-react';
import { DocumentScanner, ScanQuality } from '@/utils/documentScanner';

interface DocumentCaptureCameraProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export function DocumentCaptureCamera({ onCapture, onCancel }: DocumentCaptureCameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const [scanQuality, setScanQuality] = useState<ScanQuality | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanner] = useState(() => new DocumentScanner());
  const [isScanning, setIsScanning] = useState(true);

  // Real-time quality checking
  useEffect(() => {
    if (!isScanning || !webcamRef.current?.video) return;

    const interval = setInterval(async () => {
      if (webcamRef.current?.video) {
        const quality = await scanner.checkQuality(webcamRef.current.video);
        setScanQuality(quality);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isScanning, scanner]);

  const handleCapture = () => {
    if (webcamRef.current?.video) {
      const imageData = scanner.captureImage(webcamRef.current.video);
      setCapturedImage(imageData);
      setIsScanning(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsScanning(true);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const canCapture = scanQuality?.isSharp && scanQuality?.hasDocumentEdges;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="relative min-h-[70vh] bg-muted rounded-lg overflow-hidden">
          {!capturedImage ? (
            <>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: 'environment',
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
                }}
                className="w-full h-full object-cover"
              />
              
              {/* Quality overlay */}
              {scanQuality?.documentCorners && (
                <div className="absolute inset-0 pointer-events-none">
                  <svg className="w-full h-full">
                    <polygon
                      points={scanQuality.documentCorners
                        .map(c => `${c.x},${c.y}`)
                        .join(' ')}
                      fill="none"
                      stroke={canCapture ? '#22c55e' : '#eab308'}
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              )}

              {/* Status indicator */}
              <div className="absolute top-4 left-4 right-4">
                <div
                  className={`px-4 py-2 rounded-lg backdrop-blur-sm ${
                    canCapture
                      ? 'bg-green-500/90 text-white'
                      : 'bg-yellow-500/90 text-white'
                  }`}
                >
                  <p className="text-sm font-medium text-center">
                    {scanQuality?.qualityMessage || 'Initializing camera...'}
                  </p>
                  {scanQuality && (
                    <p className="text-xs text-center mt-1 opacity-90">
                      Fill: {Math.round(scanQuality.fillPercentage)}% | Blur: {Math.round(scanQuality.blurScore)}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <img
              src={capturedImage}
              alt="Captured document"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          {!capturedImage ? (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCapture}
                disabled={!canCapture}
                className="gap-2"
              >
                <Camera className="h-4 w-4" />
                Capture
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleRetake}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
              <Button
                onClick={handleConfirm}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Use This Photo
              </Button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>📱 <strong>Tips for best results:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Ensure good lighting</li>
            <li>Position document to fill frame</li>
            <li>Hold camera steady</li>
            <li>Avoid glare and shadows</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
