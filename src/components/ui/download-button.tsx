import * as React from "react";
import { Download, Check, Loader2 } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDownloadState } from "@/hooks/useDownloadState";

interface DownloadButtonProps extends Omit<ButtonProps, 'onClick'> {
  onDownload: () => Promise<void> | void;
  downloadingText?: string;
  completedText?: string;
}

export const DownloadButton = React.forwardRef<HTMLButtonElement, DownloadButtonProps>(
  ({ onDownload, downloadingText, completedText, className, children, disabled, ...props }, ref) => {
    const { state, startDownload, completeDownload, errorDownload, isDownloading } = useDownloadState();

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isDownloading) return;

      startDownload();
      
      try {
        await onDownload();
        completeDownload();
      } catch (error) {
        console.error('Download error:', error);
        errorDownload();
      }
    };

    const getIcon = () => {
      switch (state) {
        case 'downloading':
          return <Loader2 className="h-3 w-3 animate-spin" />;
        case 'completed':
          return <Check className="h-3 w-3" />;
        case 'error':
          return <Download className="h-3 w-3" />;
        default:
          return <Download className="h-3 w-3" />;
      }
    };

    const getButtonClass = () => {
      switch (state) {
        case 'downloading':
          return "ring-2 ring-primary ring-opacity-60 animate-pulse";
        case 'completed':
          return "ring-2 ring-success ring-opacity-60";
        case 'error':
          return "ring-2 ring-destructive ring-opacity-60";
        default:
          return "";
      }
    };

    const getText = () => {
      switch (state) {
        case 'downloading':
          return downloadingText || "Downloading...";
        case 'completed':
          return completedText || "Downloaded";
        default:
          return children;
      }
    };

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={disabled || isDownloading}
        className={cn(
          "transition-all duration-200",
          getButtonClass(),
          className
        )}
        {...props}
      >
        {getIcon()}
        {getText() && <span className="ml-2">{getText()}</span>}
      </Button>
    );
  }
);

DownloadButton.displayName = "DownloadButton";
