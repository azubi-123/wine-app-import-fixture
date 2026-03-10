import {useState, useMemo, useEffect} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DynamicTextRenderer } from '@/components/ui/DynamicTextRenderer';
import { extractRelevantTerms } from '@/lib/glossary-utils';
import { TooltipInfoPanel } from '@/components/ui/TooltipInfoPanel';
import { CheckCircle2, XCircle, Info, BookOpen } from 'lucide-react';
import { useGlossarySafe } from '@/contexts/GlossaryContext';
import { useHaptics } from '@/hooks/useHaptics';
import { ModernButton } from '@/components/ui/modern-button';

interface BooleanQuestionProps {
  question: {
    title: string;
    description?: string;
    category?: string;
    trueLabel?: string;
    falseLabel?: string;
    trueIcon?: boolean;
    falseIcon?: boolean;
  };
  value: boolean | null;
  onChange: (value: boolean) => void;
  setDisableNext?: (disabled: boolean) => void;
}

export function BooleanQuestion({ question, value, onChange, setDisableNext }: BooleanQuestionProps) {
  const trueLabel = question.trueLabel || 'Yes';
  const falseLabel = question.falseLabel || 'No';
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const glossaryContext = useGlossarySafe();
  const terms = glossaryContext?.terms || [];
  const { triggerHaptic } = useHaptics();

  useEffect(() => {
    if (value !== null && setDisableNext) {
      onChange(value);
    }else if (setDisableNext){
      setDisableNext(true);
    }

    return () => {
      if (setDisableNext) {
        setDisableNext(false)
      }
    }
  }, []);

  useEffect(() => {
    if (setDisableNext && value !== null) {
      setDisableNext(false);
    }
  }, [value]);
  
  // Extract all relevant glossary terms from the current slide content
  const relevantTerms = useMemo(() => {
    const allText = [question.title, question.description || ''].join(' ');
    return extractRelevantTerms(allText, terms);
  }, [question, terms]);

  const buttonVariants = {
    unselected: {
      scale: 1,
      opacity: 0.7,
    },
    selected: {
      scale: 1.05,
      opacity: 1,
    },
    hover: {
      scale: 1.02,
      transition: { duration: 0.2 }
    },
    tap: {
      scale: 0.98,
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="bg-gradient-card backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/20 shadow-2xl">
        <div className="space-y-6">
          {/* Category Badge and Info Button */}
          <div className="flex items-center justify-between">
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
          <h3 className="text-xl md:text-2xl font-semibold text-white text-center">
            <DynamicTextRenderer text={question.title} />
          </h3>

          {/* Question Description */}
          {question.description && (
            <p className="text-white/70 text-sm md:text-base text-center">
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

          {/* Boolean Options */}
          <div className="flex gap-4 justify-center pt-4">
            <motion.div
              variants={buttonVariants}
              initial="unselected"
              animate={value === true ? "selected" : "unselected"}
              whileHover="hover"
              whileTap="tap"
              className="flex-1 max-w-[200px]"
            >
              <Button
                variant={value === true ? "default" : "outline"}
                onClick={() => onChange(true)}
                className={`
                  w-full h-16 text-lg font-medium transition-all duration-200
                  ${value === true 
                    ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-green-500/50 shadow-lg shadow-green-900/25' 
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                  }
                `}
              >
                <div className="flex items-center justify-center space-x-2">
                  {question.trueIcon !== false && (
                    <CheckCircle2 className={`w-5 h-5 ${value === true ? 'animate-pulse' : ''}`} />
                  )}
                  <span>{trueLabel}</span>
                </div>
              </Button>
            </motion.div>

            <motion.div
              variants={buttonVariants}
              initial="unselected"
              animate={value === false ? "selected" : "unselected"}
              whileHover="hover"
              whileTap="tap"
              className="flex-1 max-w-[200px]"
            >
              <Button
                variant={value === false ? "default" : "outline"}
                onClick={() => onChange(false)}
                className={`
                  w-full h-16 text-lg font-medium transition-all duration-200
                  ${value === false 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-red-500/50 shadow-lg shadow-red-900/25' 
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                  }
                `}
              >
                <div className="flex items-center justify-center space-x-2">
                  {question.falseIcon !== false && (
                    <XCircle className={`w-5 h-5 ${value === false ? 'animate-pulse' : ''}`} />
                  )}
                  <span>{falseLabel}</span>
                </div>
              </Button>
            </motion.div>
          </div>

          {/* Visual Feedback */}
          {value !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-sm text-white/50">
                Your answer: <span className={`font-medium ${value ? 'text-green-400' : 'text-red-400'}`}>
                  {value ? trueLabel : falseLabel}
                </span>
              </p>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}