import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DynamicTextRenderer } from '@/components/ui/DynamicTextRenderer';
import { extractRelevantTerms } from '@/lib/glossary-utils';
import { TooltipInfoPanel } from '@/components/ui/TooltipInfoPanel';
import { Progress } from '@/components/ui/progress';
import { useGlossarySafe } from '@/contexts/GlossaryContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useDebounce } from '@/hooks/useDebounce';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Info, Mic, MicOff, Loader2 } from 'lucide-react';
import { ModernButton } from '@/components/ui/modern-button';
import { useToast } from '@/hooks/use-toast';

interface TextQuestionProps {
  question: {
    title: string;
    description?: string;
    placeholder?: string;
    maxLength?: number;
    minLength?: number;
    rows?: number;
    category?: string;
  };
  value: string;
  onChange: (value: string) => void;
}

export function TextQuestion({ question, value = '', onChange }: TextQuestionProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const glossaryContext = useGlossarySafe();
  const terms = glossaryContext?.terms || [];
  const { triggerHaptic } = useHaptics();
  const { toast } = useToast();

  // Handle transcription when recording completes
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    triggerHaptic('success');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success && data.text) {
        // Append transcribed text to existing value
        const newValue = localValue.trim()
          ? `${localValue.trim()} ${data.text}`
          : data.text;
        setLocalValue(newValue);
        toast({
          title: "Transcribed!",
          description: "Your voice note has been added."
        });
      } else {
        throw new Error(data.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(false);
    }
  }, [localValue, toast, triggerHaptic]);

  const { isRecording, isSupported, startRecording, stopRecording, error: recorderError } = useAudioRecorder({
    onRecordingComplete: handleRecordingComplete,
    maxDuration: 60
  });

  // Show error toast if recorder has an error
  useEffect(() => {
    if (recorderError) {
      toast({
        title: "Recording error",
        description: recorderError,
        variant: "destructive"
      });
    }
  }, [recorderError, toast]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      triggerHaptic('success');
    } else {
      startRecording();
      triggerHaptic('selection');
    }
  }, [isRecording, startRecording, stopRecording, triggerHaptic]);

  // Debounce the value to reduce the number of onChange calls
  const debouncedValue = useDebounce(localValue, 300);

  useEffect(() => {
    if (value === '') {
    onChange(' ');
    }
  }, []);
  
  // Extract all relevant glossary terms from the current slide content
  const relevantTerms = useMemo(() => {
    const allText = [question.title, question.description || ''].join(' ');
    return extractRelevantTerms(allText, terms);
  }, [question, terms]);
  
  // Sync with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Call onChange when debounced value changes - with additional safety checks
  useEffect(() => {
    if (debouncedValue !== value) {
      // Use requestAnimationFrame to ensure DOM is updated before onChange
      requestAnimationFrame(() => {
        onChange(debouncedValue);
      });
    }
  }, [debouncedValue, onChange, value]);

  const handleChange = (newValue: string) => {
    // Respect maxLength if provided
    if (question.maxLength && newValue.length > question.maxLength) {
      return;
    }
    setLocalValue(newValue);
    triggerHaptic('selection');
  };

  const characterCount = localValue.length;
  const maxLength = question.maxLength || 500;
  const progress = (characterCount / maxLength) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="bg-gradient-card backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/20 shadow-2xl">
        <div className="space-y-4">
          {/* Category Badge and Info Button */}
          <div className="flex items-center justify-between mb-2">
            {question.category && (
              <span className="px-3 py-1 bg-purple-600/20 text-purple-300 text-xs font-medium rounded-full">
                {question.category}
              </span>
            )}
            {relevantTerms.length > 0 && (
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsInfoPanelOpen(!isInfoPanelOpen);
                }}
                className="text-purple-300 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all duration-200"
              >
                <Info size={16} />
              </ModernButton>
            )}
          </div>

          {/* Question Title */}
          <h3 className="text-xl md:text-2xl font-semibold text-white">
            <DynamicTextRenderer text={question.title} />
          </h3>

          {/* Question Description */}
          {question.description && (
            <p className="text-white/70 text-sm md:text-base">
              <DynamicTextRenderer text={question.description} />
            </p>
          )}

          {/* Inline Tooltip Info Panel */}
          <TooltipInfoPanel
            relevantTerms={relevantTerms}
            isOpen={isInfoPanelOpen}
            onOpenChange={setIsInfoPanelOpen}
            themeColor="purple"
          />

          {/* Text Input Area */}
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={localValue}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={question.placeholder || "Type your answer here..."}
                rows={question.rows || 4}
                className={`
                  w-full bg-white/10 border-white/20 text-white
                  placeholder:text-white/40 resize-none pr-14
                  transition-all duration-200
                  ${isFocused ? 'border-purple-400/50 bg-white/15' : ''}
                `}
              />

              {/* Voice Recording Button */}
              {isSupported && (
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={toggleRecording}
                  disabled={isTranscribing}
                  className={`
                    absolute right-2 bottom-2 p-2 rounded-full
                    transition-all duration-200
                    ${isRecording
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'text-purple-300 hover:text-white hover:bg-white/10'
                    }
                  `}
                  title={isRecording ? "Stop recording" : "Record voice note"}
                >
                  {isTranscribing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isRecording ? (
                    <MicOff size={20} className="animate-pulse" />
                  ) : (
                    <Mic size={20} />
                  )}
                </ModernButton>
              )}

              {/* Recording indicator */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute top-2 right-2 flex items-center gap-2 bg-red-500/20 px-2 py-1 rounded-full"
                  >
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs text-red-400">Recording...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Focus indicator */}
              {isFocused && (
                <motion.div
                  layoutId="focus-indicator"
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 rounded-lg border-2 border-purple-400/30" />
                  <div className="absolute inset-0 rounded-lg bg-purple-400/5" />
                </motion.div>
              )}
            </div>

            {/* Character Count & Progress */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/50">
                  {question.minLength && characterCount < question.minLength && (
                    <span className="text-yellow-400">
                      Minimum {question.minLength} characters required
                    </span>
                  )}
                </span>
                <span className={`
                  transition-colors duration-200
                  ${characterCount > maxLength * 0.9 ? 'text-yellow-400' : 'text-white/50'}
                  ${characterCount >= maxLength ? 'text-red-400' : ''}
                `}>
                  {characterCount}/{maxLength}
                </span>
              </div>
              
              {/* Visual progress bar */}
              <Progress 
                value={progress} 
                className="h-1 bg-white/10"
              />
            </div>

            {/* Helper text */}
            {localValue.length === 0 && (
              <p className="text-white/40 text-xs mt-2">
                Share your thoughts and observations about this wine
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}