import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Camera, X, AlertCircle } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: () => void;
  className?: string;
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { triggerHaptic } = useHaptics();

  const startScanning = async () => {
    try {
      setError(null);
      setIsScanning(true);
      triggerHaptic('selection');

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera if available
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start QR detection
        startQRDetection();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied. Please allow camera permission and try again.');
      setHasPermission(false);
      setIsScanning(false);
      onError?.();
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startQRDetection = async () => {
    try {
      const { BrowserQRCodeReader } = await import('@zxing/library');
      const codeReader = new BrowserQRCodeReader();
      
      if (videoRef.current) {
        // Set up continuous scanning
        const scanLoop = async () => {
          try {
            const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current!);
            if (result) {
              const text = result.getText();
              triggerHaptic('success');
              onScan(text.trim().toUpperCase());
              stopScanning();
              return;
            }
          } catch (scanError) {
            // Continue scanning - no QR code found yet
          }
          
          // Continue scanning if still active
          if (isScanning && videoRef.current) {
            setTimeout(scanLoop, 100);
          }
        };
        
        scanLoop();
      }
    } catch (err) {
      console.error('QR detection error:', err);
      setError('QR code scanning not supported on this device.');
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  if (!isScanning) {
    return (
      <motion.div
        className={`bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl ${className}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-4">
            <Camera className="text-white" size={32} />
          </div>
          
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Scan QR Code</h3>
            <p className="text-white/70 mb-6">
              Point your camera at the QR code on your wine package
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-red-300 bg-red-500/20 p-3 rounded-xl"
            >
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          <Button
            onClick={startScanning}
            disabled={hasPermission === false}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl text-white font-semibold shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:transform-none"
          >
            <Camera className="mr-2" size={16} />
            {hasPermission === false ? 'Camera Access Denied' : 'Start QR Scanner'}
          </Button>
          
          {hasPermission === false && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-amber-500/20 border border-amber-400/30 rounded-xl"
            >
              <p className="text-amber-200 text-sm text-center">
                Please enable camera permissions in your browser settings and refresh the page.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`relative bg-black rounded-3xl overflow-hidden shadow-2xl ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <video
        ref={videoRef}
        className="w-full aspect-square object-cover"
        playsInline
        muted
      />
      
      {/* QR Scanner overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-48 h-48 sm:w-56 sm:h-56">
          {/* Scanner corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white drop-shadow-lg"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white drop-shadow-lg"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white drop-shadow-lg"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white drop-shadow-lg"></div>
          
          {/* Scanning line animation */}
          <motion.div
            className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent drop-shadow-lg"
            animate={{ y: [0, 192, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Corner accents */}
          <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-blue-400 opacity-80"></div>
          <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-blue-400 opacity-80"></div>
          <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-blue-400 opacity-80"></div>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-blue-400 opacity-80"></div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4">
        <Button
          onClick={stopScanning}
          variant="ghost"
          size="sm"
          className="bg-black/50 hover:bg-black/70 text-white"
        >
          <X size={20} />
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-white text-sm bg-black/50 rounded-lg px-4 py-2">
          Position QR code within the frame
        </p>
      </div>
    </motion.div>
  );
}