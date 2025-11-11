import { useState, useCallback, useRef } from 'react';

type DownloadState = 'idle' | 'downloading' | 'completed' | 'error';

interface UseDownloadStateReturn {
  state: DownloadState;
  startDownload: () => void;
  completeDownload: () => void;
  errorDownload: () => void;
  resetDownload: () => void;
  isDownloading: boolean;
}

export function useDownloadState(resetDelay: number = 2000): UseDownloadStateReturn {
  const [state, setState] = useState<DownloadState>('idle');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startDownload = useCallback(() => {
    setState('downloading');
  }, []);

  const completeDownload = useCallback(() => {
    setState('completed');
    
    // Auto-reset to idle after delay
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setState('idle');
    }, resetDelay);
  }, [resetDelay]);

  const errorDownload = useCallback(() => {
    setState('error');
    
    // Auto-reset to idle after delay
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setState('idle');
    }, resetDelay);
  }, [resetDelay]);

  const resetDownload = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState('idle');
  }, []);

  return {
    state,
    startDownload,
    completeDownload,
    errorDownload,
    resetDownload,
    isDownloading: state === 'downloading',
  };
}
