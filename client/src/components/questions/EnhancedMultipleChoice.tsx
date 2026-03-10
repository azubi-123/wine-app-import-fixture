import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DynamicTextRenderer } from "@/components/ui/DynamicTextRenderer";
import { AromaDiagram } from "@/components/AromaDiagram";
import { ChevronDown, ChevronUp, User, MessageCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Option {
  id: string;
  text: string;
  description?: string;
}

interface EnhancedMultipleChoiceProps {
  slideId: string;
  question: {
    title: string;
    description?: string;
    category?: string;
    options: Option[];
    allow_multiple?: boolean;
    allow_notes?: boolean;
  };
  value: {
    selected: string[];
    notes?: string;
  };
  onChange: (value: { selected: string[]; notes?: string }) => void;
}

export function EnhancedMultipleChoice({ slideId, question, value, onChange }: EnhancedMultipleChoiceProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showAromaDiagram, setShowAromaDiagram] = useState(false);
  
  const isAromaQuestion = question.category?.toLowerCase().includes('aroma') || 
                         question.title.toLowerCase().includes('aroma');
  
  const handleOptionToggle = (optionId: string) => {
    let newSelected: string[];
    
    if (question.allow_multiple) {
      newSelected = value.selected.includes(optionId)
        ? value.selected.filter(id => id !== optionId)
        : [...value.selected, optionId];
    } else {
      newSelected = value.selected.includes(optionId) ? [] : [optionId];
    }
    
    onChange({ ...value, selected: newSelected });
  };
  
  const handleNotesChange = (notes: string) => {
    onChange({ ...value, notes });
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 bg-gradient-card backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-xl">
      {/* Question Header */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
            <DynamicTextRenderer text={question.title} />
          </h3>
          
          {isAromaQuestion && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAromaDiagram(true)}
              className="text-purple-300 hover:text-white hover:bg-white/10 p-2"
              title="How to smell wine"
            >
              <User className="w-5 h-5" />
            </Button>
          )}
        </div>
        
        {question.description && (
          <p className="text-white/70 text-sm md:text-base leading-relaxed">
            <DynamicTextRenderer text={question.description} />
          </p>
        )}
        
        {question.category && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-full border border-purple-300/30">
            <span className="text-purple-200 text-sm font-medium">
              {question.category}
            </span>
          </div>
        )}
        
        <div className="text-xs text-white/50">
          {question.allow_multiple ? "Select all that apply" : "Select one option"}
        </div>
      </div>
      
      {/* Sommelier Context */}
      {isAromaQuestion && (
        <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-blue-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-200">
              <strong>Remember what Sommelier Nick said:</strong> "Take your time with the aroma. Swirl gently and let the wine tell its story through scent."
            </div>
          </div>
        </div>
      )}
      
      {/* Options Grid */}
      <div className="grid gap-3">
        {question.options.map((option) => {
          const isSelected = value.selected.includes(option.id);
          
          return (
            <motion.button
              key={`${slideId}-${option.id}`}
              onClick={() => handleOptionToggle(option.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border-purple-400/50 shadow-lg'
                  : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-3">
                {/* Selection Indicator */}
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 border-white'
                    : 'border-white/40'
                }`}>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-full h-full rounded-full bg-white flex items-center justify-center"
                    >
                      <div className="w-2 h-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full" />
                    </motion.div>
                  )}
                </div>
                
                {/* Option Content */}
                <div className="flex-1">
                  <div className="text-white font-medium">
                    <DynamicTextRenderer text={option.text} />
                  </div>
                  {option.description && (
                    <div className="text-white/60 text-sm mt-1">
                      <DynamicTextRenderer text={option.description} />
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      
      {/* Additional Notes Dropdown */}
      {question.allow_notes && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            onClick={() => setShowNotes(!showNotes)}
            className="w-full flex items-center justify-between text-white/70 hover:text-white hover:bg-white/5 p-3 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>Add personal notes</span>
              {value.notes && value.notes.trim() && (
                <div className="w-2 h-2 bg-purple-400 rounded-full" />
              )}
            </div>
            {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          
          <AnimatePresence>
            {showNotes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Textarea
                  value={value.notes || ""}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Add your personal observations, memories, or thoughts about this wine..."
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 min-h-[80px] resize-none"
                />
                <div className="text-xs text-white/50 mt-2">
                  Your personal notes help build your wine tasting profile
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* Selection Summary */}
      {value.selected.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-sm text-white/70 mb-2">Your selections:</div>
          <div className="flex flex-wrap gap-2">
            {value.selected.map((selectedId) => {
              const option = question.options.find(opt => opt.id === selectedId);
              return option ? (
                <span
                  key={selectedId}
                  className="px-2 py-1 bg-gradient-to-r from-purple-500/30 to-indigo-500/30 rounded-lg text-white text-xs border border-purple-400/30"
                >
                  {option.text}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
      
      {/* Aroma Diagram Modal */}
      <AromaDiagram 
        isOpen={showAromaDiagram} 
        onClose={() => setShowAromaDiagram(false)} 
      />
    </div>
  );
}