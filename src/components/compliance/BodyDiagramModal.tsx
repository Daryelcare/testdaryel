import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Canvas as FabricCanvas, Circle, FabricText, FabricImage, Rect } from "fabric";

// Body part regions with their names and approximate click areas (adjusted for the body diagram image)
const BODY_PARTS = [
  { name: "Head", x: 200, y: 60, region: { minX: 180, maxX: 220, minY: 40, maxY: 80 } },
  { name: "Neck", x: 200, y: 90, region: { minX: 190, maxX: 210, minY: 80, maxY: 110 } },
  { name: "Left Shoulder", x: 160, y: 120, region: { minX: 140, maxX: 180, minY: 110, maxY: 140 } },
  { name: "Right Shoulder", x: 240, y: 120, region: { minX: 220, maxX: 260, minY: 110, maxY: 140 } },
  { name: "Left Arm", x: 120, y: 160, region: { minX: 100, maxX: 150, minY: 140, maxY: 200 } },
  { name: "Right Arm", x: 280, y: 160, region: { minX: 250, maxX: 300, minY: 140, maxY: 200 } },
  { name: "Chest", x: 200, y: 150, region: { minX: 180, maxX: 220, minY: 130, maxY: 180 } },
  { name: "Abdomen", x: 200, y: 200, region: { minX: 180, maxX: 220, minY: 180, maxY: 230 } },
  { name: "Left Hand", x: 90, y: 210, region: { minX: 80, maxX: 110, minY: 200, maxY: 230 } },
  { name: "Right Hand", x: 310, y: 210, region: { minX: 290, maxX: 320, minY: 200, maxY: 230 } },
  { name: "Left Hip", x: 180, y: 240, region: { minX: 170, maxX: 190, minY: 230, maxY: 260 } },
  { name: "Right Hip", x: 220, y: 240, region: { minX: 210, maxX: 230, minY: 230, maxY: 260 } },
  { name: "Left Thigh", x: 180, y: 300, region: { minX: 170, maxX: 200, minY: 260, maxY: 340 } },
  { name: "Right Thigh", x: 220, y: 300, region: { minX: 200, maxX: 230, minY: 260, maxY: 340 } },
  { name: "Left Knee", x: 180, y: 360, region: { minX: 170, maxX: 200, minY: 340, maxY: 380 } },
  { name: "Right Knee", x: 220, y: 360, region: { minX: 200, maxX: 230, minY: 340, maxY: 380 } },
  { name: "Left Shin", x: 180, y: 420, region: { minX: 170, maxX: 200, minY: 380, maxY: 460 } },
  { name: "Right Shin", x: 220, y: 420, region: { minX: 200, maxX: 230, minY: 380, maxY: 460 } },
  { name: "Left Foot", x: 180, y: 480, region: { minX: 170, maxX: 200, minY: 460, maxY: 500 } },
  { name: "Right Foot", x: 220, y: 480, region: { minX: 200, maxX: 230, minY: 460, maxY: 500 } },
];

interface BodyMarker {
  x: number;
  y: number;
  bodyPart: string;
}

interface BodyDiagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (markers: BodyMarker[]) => void;
  title: string;
  initialMarkers?: BodyMarker[];
}

export default function BodyDiagramModal({ 
  open, 
  onOpenChange, 
  onSave, 
  title, 
  initialMarkers = [] 
}: BodyDiagramModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [markers, setMarkers] = useState<BodyMarker[]>(initialMarkers);

  useEffect(() => {
    if (!canvasRef.current || !open) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 400,
      height: 550,
      backgroundColor: "#f5f5f5",
      selection: false,
    });

    // Load the body diagram image
    const loadBodyDiagram = async () => {
      try {
        // Use FabricImage.fromURL directly with better error handling
        FabricImage.fromURL('/body-diagram.png', {
          crossOrigin: 'anonymous'
        }).then((img) => {
          if (!img) {
            throw new Error('Image failed to load');
          }
          
          // Scale the image to fit the canvas while maintaining aspect ratio
          const scaleX = canvas.width! / img.width!;
          const scaleY = canvas.height! / img.height!;
          const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size
          
          img.set({
            scaleX: scale,
            scaleY: scale,
            left: (canvas.width! - img.width! * scale) / 2,
            top: (canvas.height! - img.height! * scale) / 2,
            selectable: false,
            evented: false,
            opacity: 1,
          });
          
          canvas.add(img);
          canvas.sendObjectToBack(img);
          canvas.renderAll();
          
          // Add initial markers after the image is loaded
          initialMarkers.forEach(marker => {
            addMarkerToCanvas(canvas, marker.x, marker.y, marker.bodyPart);
          });
        }).catch((error) => {
          console.error('FabricImage.fromURL error:', error);
          console.log('Failed to load body diagram, using fallback shapes');
          drawFallbackBodyOutline(canvas);
          
          // Add initial markers
          initialMarkers.forEach(marker => {
            addMarkerToCanvas(canvas, marker.x, marker.y, marker.bodyPart);
          });
        });
      } catch (error) {
        console.error('Error loading body diagram:', error);
        drawFallbackBodyOutline(canvas);
        
        // Add initial markers
        initialMarkers.forEach(marker => {
          addMarkerToCanvas(canvas, marker.x, marker.y, marker.bodyPart);
        });
      }
    };

    const drawFallbackBodyOutline = (canvas: FabricCanvas) => {
      // Fallback basic body outline
      // Head (circle)
      canvas.add(new Circle({ left: 185, top: 45, radius: 25, fill: "transparent", stroke: "#333", strokeWidth: 2, selectable: false }));
      // Body (rectangle)
      canvas.add(new Rect({ left: 175, top: 100, width: 50, height: 100, fill: "transparent", stroke: "#333", strokeWidth: 2, selectable: false }));
      // Arms
      canvas.add(new Rect({ left: 130, top: 120, width: 40, height: 15, fill: "transparent", stroke: "#333", strokeWidth: 2, selectable: false }));
      canvas.add(new Rect({ left: 230, top: 120, width: 40, height: 15, fill: "transparent", stroke: "#333", strokeWidth: 2, selectable: false }));
      // Legs
      canvas.add(new Rect({ left: 180, top: 210, width: 15, height: 80, fill: "transparent", stroke: "#333", strokeWidth: 2, selectable: false }));
      canvas.add(new Rect({ left: 205, top: 210, width: 15, height: 80, fill: "transparent", stroke: "#333", strokeWidth: 2, selectable: false }));
    };

    canvas.on('mouse:down', (e) => {
      const pointer = canvas.getPointer(e.e);
      const clickedBodyPart = getBodyPartAtPosition(pointer.x, pointer.y);
      
      if (clickedBodyPart) {
        addMarker(pointer.x, pointer.y, clickedBodyPart);
      }
    });

    loadBodyDiagram();
    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [open]);

  const getBodyPartAtPosition = (x: number, y: number): string | null => {
    for (const part of BODY_PARTS) {
      const { region } = part;
      if (x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY) {
        return part.name;
      }
    }
    return null;
  };

  const addMarkerToCanvas = (canvas: FabricCanvas, x: number, y: number, bodyPart: string) => {
    // Red circle marker
    const marker = new Circle({
      left: x - 8,
      top: y - 8,
      radius: 8,
      fill: "#dc2626",
      stroke: "#ffffff",
      strokeWidth: 2,
      selectable: true,
      hasControls: false,
      hasBorders: false,
    });

    // Body part label
    const label = new FabricText(bodyPart, {
      left: x + 15,
      top: y - 10,
      fontSize: 12,
      fill: "#333",
      selectable: true,
      hasControls: false,
      hasBorders: false,
    });

    canvas.add(marker, label);
    canvas.renderAll();
  };

  const addMarker = (x: number, y: number, bodyPart: string) => {
    // Check if marker already exists for this body part
    const existingIndex = markers.findIndex(m => m.bodyPart === bodyPart);
    
    if (existingIndex >= 0) {
      // Remove existing marker
      setMarkers(prev => prev.filter((_, i) => i !== existingIndex));
      
      // Remove existing marker from canvas
      if (fabricCanvas) {
        const objects = fabricCanvas.getObjects();
        const toRemove = objects.filter(obj => 
          (obj.type === 'circle' && obj.fill === '#dc2626') || // markers
          obj.type === 'text' // labels
        );
        
        toRemove.forEach(obj => fabricCanvas.remove(obj));
        fabricCanvas.renderAll();
        
        // Redraw all markers except the one being replaced
        markers.filter((_, i) => i !== existingIndex).forEach(marker => {
          addMarkerToCanvas(fabricCanvas, marker.x, marker.y, marker.bodyPart);
        });
      }
    }

    // Add new marker
    const newMarker = { x, y, bodyPart };
    setMarkers(prev => [...prev.filter(m => m.bodyPart !== bodyPart), newMarker]);
    
    if (fabricCanvas) {
      addMarkerToCanvas(fabricCanvas, x, y, bodyPart);
    }
  };

  const handleSave = () => {
    onSave(markers);
    onOpenChange(false);
  };

  const handleClear = () => {
    setMarkers([]);
    if (fabricCanvas) {
      // Remove only markers and labels, keep the body diagram
      const objects = fabricCanvas.getObjects();
      const toRemove = objects.filter(obj => 
        obj.type === 'circle' && obj.fill === '#dc2626' || // markers
        obj.type === 'text' // labels
      );
      
      toRemove.forEach(obj => fabricCanvas.remove(obj));
      fabricCanvas.renderAll();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click on the body diagram to mark locations. Click again to remove a marker.
          </p>
          
          <div className="flex justify-center border rounded-lg p-4 bg-background">
            <canvas 
              ref={canvasRef}
              className="border border-border rounded shadow-sm"
            />
          </div>
          
          {markers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Marked Locations:</h4>
              <div className="flex flex-wrap gap-2">
                {markers.map((marker, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive"
                  >
                    {marker.bodyPart}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={handleClear}>
              Clear All
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Locations
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}