import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  FileText,
  Download,
  Maximize2
} from "lucide-react";
import { PDF_CONFIG, zoomUtils, pdfErrorHandler } from "@/lib/pdf-config";
import { toast } from "sonner";

interface EnhancedPDFViewerProps {
  pdfUrl: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  scale?: number;
  onScaleChange?: (scale: number) => void;
  onPageClick?: (event: React.MouseEvent) => void;
  overlayContent?: React.ReactNode | ((pageNum: number, scale: number) => React.ReactNode);
  showToolbar?: boolean;
  className?: string;
  enableKeyboardNavigation?: boolean;
  isMobile?: boolean;
  continuousMode?: boolean;
}

export function EnhancedPDFViewer({
  pdfUrl,
  currentPage,
  onPageChange,
  scale = PDF_CONFIG.defaultScale,
  onScaleChange,
  onPageClick,
  overlayContent,
  showToolbar = true,
  className = "",
  enableKeyboardNavigation = true,
  isMobile = false,
  continuousMode = false
}: EnhancedPDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailsVisible, setThumbnailsVisible] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fileSource, setFileSource] = useState<string | Uint8Array>(pdfUrl);
  const [fallbackTried, setFallbackTried] = useState(false);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardNavigation) return;
    
    // Don't handle keyboard shortcuts when user is in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    const { code, ctrlKey, metaKey } = event;
    const isModifier = ctrlKey || metaKey;
    
    // Only prevent default for specific keys we're actually handling
    let shouldPreventDefault = false;

    if ((PDF_CONFIG.keyboardShortcuts.nextPage as readonly string[]).includes(code) && !isModifier) {
      if (currentPage < numPages) {
        onPageChange(currentPage + 1);
        shouldPreventDefault = true;
      }
    } else if ((PDF_CONFIG.keyboardShortcuts.prevPage as readonly string[]).includes(code) && !isModifier) {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
        shouldPreventDefault = true;
      }
    } else if ((PDF_CONFIG.keyboardShortcuts.firstPage as readonly string[]).includes(code)) {
      onPageChange(1);
      shouldPreventDefault = true;
    } else if ((PDF_CONFIG.keyboardShortcuts.lastPage as readonly string[]).includes(code)) {
      onPageChange(numPages);
      shouldPreventDefault = true;
    } else if ((PDF_CONFIG.keyboardShortcuts.zoomIn as readonly string[]).includes(code) && onScaleChange) {
      const newScale = zoomUtils.getNextZoomLevel(scale, 'in');
      onScaleChange(newScale);
      shouldPreventDefault = true;
    } else if ((PDF_CONFIG.keyboardShortcuts.zoomOut as readonly string[]).includes(code) && onScaleChange) {
      const newScale = zoomUtils.getNextZoomLevel(scale, 'out');
      onScaleChange(newScale);
      shouldPreventDefault = true;
    } else if ((PDF_CONFIG.keyboardShortcuts.resetZoom as readonly string[]).includes(code) && onScaleChange) {
      onScaleChange(PDF_CONFIG.defaultScale);
      shouldPreventDefault = true;
    }
    
    // Only prevent default if we actually handled the event
    if (shouldPreventDefault) {
      event.preventDefault();
    }
  }, [currentPage, numPages, onPageChange, scale, onScaleChange, enableKeyboardNavigation]);

  useEffect(() => {
    if (enableKeyboardNavigation) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enableKeyboardNavigation]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const handleDocumentLoadError = async (error: any) => {
    console.log("PDF Load Error:", error);
    
    // Try a blob fallback once (fetch entire file and feed as Uint8Array)
    if (!fallbackTried) {
      try {
        console.log("Attempting fallback fetch for PDF:", pdfUrl);
        const res = await fetch(pdfUrl, { 
          credentials: 'omit',
          mode: 'cors',
          headers: {
            'Accept': 'application/pdf,*/*'
          }
        });
        
        console.log("Fetch response status:", res.status, res.statusText);
        
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          console.log("Content-Type:", contentType);
          
          if (contentType && !contentType.includes('pdf')) {
            throw new Error(`Invalid content type: ${contentType}. Expected PDF.`);
          }
          
          const buf = await res.arrayBuffer();
          console.log("Buffer size:", buf.byteLength);
          
          if (buf.byteLength === 0) {
            throw new Error("PDF file is empty");
          }
          
          setFileSource(new Uint8Array(buf));
          setFallbackTried(true);
          setError(null);
          setIsLoading(true);
          return; // Let react-pdf retry with the blob source
        } else {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
      } catch (fetchError) {
        console.error("Fallback fetch failed:", fetchError);
        setError(`Failed to load PDF: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        setIsLoading(false);
        toast.error(`PDF loading failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        return;
      }
    }

    const errorMessage = pdfErrorHandler.getErrorMessage(error);
    setError(errorMessage);
    setIsLoading(false);
    toast.error(errorMessage);
  };

  const handleZoomChange = (newScale: number) => {
    const clampedScale = zoomUtils.clampScale(newScale);
    onScaleChange?.(clampedScale);
  };

  const goToPage = (page: number) => {
    const clampedPage = Math.max(1, Math.min(numPages, page));
    onPageChange(clampedPage);
  };

  if (error) {
    return (
      <Card className={`flex items-center justify-center h-96 ${className}`}>
        <CardContent className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">{error}</p>
          {error.includes("400") && (
            <p className="text-sm text-amber-600 mb-4">
              The PDF file appears to be corrupted or missing. Please re-upload the document.
            </p>
          )}
          <div className="space-x-2">
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => window.open(pdfUrl, '_blank')}
            >
              Open Direct Link
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className={`flex items-center gap-2 p-2 border-b bg-background ${isMobile ? 'overflow-x-auto' : 'gap-4 p-4'}`}>
          {/* Page Navigation - simplified for mobile */}
          {!continuousMode && !isMobile && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(1)}
                disabled={currentPage <= 1}
                title="First page (Home)"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Previous page (← or PageUp)"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2 min-w-0">
                <Label className="text-sm whitespace-nowrap">Page</Label>
                <Select
                  value={currentPage.toString()}
                  onValueChange={(value) => goToPage(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: numPages }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  of {numPages}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                title="Next page (→ or PageDown)"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(numPages)}
                disabled={currentPage >= numPages}
                title="Last page (End)"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {!continuousMode && !isMobile && <div className="h-6 w-px bg-border" />}

          {/* Zoom Controls - simplified for mobile */}
          {onScaleChange && (
            <div className="flex items-center gap-2">
              {!isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleZoomChange(zoomUtils.getNextZoomLevel(scale, 'out'))}
                  disabled={scale <= PDF_CONFIG.minScale}
                  title="Zoom out (-)"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              )}
              
              <Select
                value={scale.toString()}
                onValueChange={(value) => handleZoomChange(parseFloat(value))}
              >
                <SelectTrigger className={isMobile ? "w-16" : "w-20"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PDF_CONFIG.scaleSteps
                    .filter(step => isMobile ? step <= 1.5 : true) // Limit zoom on mobile
                    .map((scaleStep) => (
                    <SelectItem key={scaleStep} value={scaleStep.toString()}>
                      {zoomUtils.formatScalePercent(scaleStep)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!isMobile && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoomChange(zoomUtils.getNextZoomLevel(scale, 'in'))}
                    disabled={scale >= PDF_CONFIG.maxScale}
                    title="Zoom in (+)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoomChange(PDF_CONFIG.defaultScale)}
                    title="Reset zoom (0)"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {!isMobile && <div className="h-6 w-px bg-border" />}

          {/* Additional Controls - simplified for mobile */}
          <div className="flex items-center gap-2">
            {!isMobile && !continuousMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setThumbnailsVisible(!thumbnailsVisible)}
                title="Toggle thumbnails"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(pdfUrl, '_blank')}
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnails Sidebar - hidden on mobile or in continuous mode */}
        {thumbnailsVisible && numPages > 1 && !isMobile && !continuousMode && (
          <div className="w-48 border-r bg-muted/10 overflow-y-auto p-2">
            <div className="space-y-2">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  className={`cursor-pointer p-1 rounded border-2 transition-colors ${
                    pageNum === currentPage 
                      ? 'border-primary bg-primary/10' 
                      : 'border-transparent hover:border-muted-foreground/20'
                  }`}
                  onClick={() => goToPage(pageNum)}
                >
                  <Document file={fileSource as any}>
                    <Page
                      pageNumber={pageNum}
                      width={150}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                  <p className="text-xs text-center mt-1">Page {pageNum}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main PDF Viewer */}
        <div 
          ref={containerRef}
          className={`flex-1 overflow-auto bg-muted/10 ${isMobile ? 'p-2' : 'p-4'}`}
        >
          {isLoading && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}

          {/* Continuous mode for mobile - all pages in one scrollable container */}
          {(continuousMode || isMobile) ? (
            <div className="space-y-4">
              <Document
                file={fileSource as any}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading=""
                className="w-full"
              >
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div 
                    key={pageNum}
                    ref={pageNum === currentPage ? pageRef : undefined}
                    className="relative mb-4 flex justify-center"
                    onClick={onPageClick}
                  >
                    <div className="relative">
                       <Page
                         pageNumber={pageNum}
                         scale={scale}
                         renderTextLayer={PDF_CONFIG.defaultOptions.renderTextLayer}
                         renderAnnotationLayer={PDF_CONFIG.defaultOptions.renderAnnotationLayer}
                         className="shadow-lg rounded-lg"
                       />
                      
                      {/* Page number indicator */}
                      <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        {pageNum} / {numPages}
                      </div>
                      
                       {/* Custom overlay content for all pages in continuous mode */}
                       {overlayContent && 
                         (typeof overlayContent === 'function' 
                           ? overlayContent(pageNum, scale)
                           : (pageNum === currentPage && overlayContent))
                       }
                    </div>
                  </div>
                ))}
              </Document>
            </div>
          ) : (
            /* Single page mode for desktop */
            <div 
              ref={pageRef}
              className="relative inline-block"
              onClick={onPageClick}
            >
              <Document
                file={fileSource as any}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading=""
                className="inline-block"
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={PDF_CONFIG.defaultOptions.renderTextLayer}
                  renderAnnotationLayer={PDF_CONFIG.defaultOptions.renderAnnotationLayer}
                  className="shadow-lg"
                />
              </Document>
              
               {/* Custom overlay content */}
               {overlayContent && 
                 (typeof overlayContent === 'function' 
                   ? overlayContent(currentPage, scale)
                   : overlayContent)
               }
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      {enableKeyboardNavigation && (
        <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground">
          <span className="font-medium">Keyboard shortcuts:</span> 
          {' '}Arrow keys (page navigation), +/- (zoom), Home/End (first/last page), 0 (reset zoom)
        </div>
      )}
    </div>
  );
}