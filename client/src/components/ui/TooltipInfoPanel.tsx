import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { BookOpen } from "lucide-react";
import type { GlossaryTerm } from "@shared/schema";

interface TooltipInfoPanelProps {
  relevantTerms: GlossaryTerm[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  themeColor?: 'purple' | 'blue' | 'green' | 'pink';
  className?: string;
}

const themeConfig = {
  purple: {
    background: 'from-purple-900/40 via-purple-800/30 to-purple-900/40',
    border: 'border-purple-500/30',
    icon: 'text-purple-300',
    title: 'text-purple-200',
    term: 'text-purple-100',
    borderAccent: 'border-purple-400/50',
    tagBg: 'bg-purple-500/30',
    tagText: 'text-purple-200',
    tagBorder: 'border-purple-400/30'
  },
  blue: {
    background: 'from-blue-900/40 via-blue-800/30 to-blue-900/40',
    border: 'border-blue-500/30',
    icon: 'text-blue-300',
    title: 'text-blue-200',
    term: 'text-blue-100',
    borderAccent: 'border-blue-400/50',
    tagBg: 'bg-blue-500/30',
    tagText: 'text-blue-200',
    tagBorder: 'border-blue-400/30'
  },
  green: {
    background: 'from-green-900/40 via-green-800/30 to-green-900/40',
    border: 'border-green-500/30',
    icon: 'text-green-300',
    title: 'text-green-200',
    term: 'text-green-100',
    borderAccent: 'border-green-400/50',
    tagBg: 'bg-green-500/30',
    tagText: 'text-green-200',
    tagBorder: 'border-green-400/30'
  },
  pink: {
    background: 'from-pink-900/40 via-pink-800/30 to-pink-900/40',
    border: 'border-pink-500/30',
    icon: 'text-pink-300',
    title: 'text-pink-200',
    term: 'text-pink-100',
    borderAccent: 'border-pink-400/50',
    tagBg: 'bg-pink-500/30',
    tagText: 'text-pink-200',
    tagBorder: 'border-pink-400/30'
  }
};

export function TooltipInfoPanel({
  relevantTerms,
  isOpen,
  onOpenChange,
  themeColor = 'purple',
  className = ''
}: TooltipInfoPanelProps) {
  const theme = themeConfig[themeColor];

  if (relevantTerms.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleContent asChild>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`overflow-hidden ${className}`}
            >
              <div className={`p-4 bg-gradient-to-br ${theme.background} rounded-xl border ${theme.border} backdrop-blur-sm shadow-lg`}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={16} className={theme.icon} />
                  <h4 className={`text-sm font-semibold ${theme.title}`}>Wine Terms</h4>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {relevantTerms.slice(0, 5).map((term, index) => (
                    <motion.div
                      key={term.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.2 }}
                      className={`border-l-2 ${theme.borderAccent} pl-3 py-1`}
                    >
                      <h5 className={`text-sm font-medium ${theme.term} capitalize mb-1`}>
                        {term.term}
                      </h5>
                      <p className="text-xs text-white/90 leading-relaxed">
                        {term.definition}
                      </p>
                      {term.variations && term.variations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {term.variations.map((variation, i) => (
                            <span
                              key={i}
                              className={`px-2 py-0.5 ${theme.tagBg} ${theme.tagText} text-xs rounded-md border ${theme.tagBorder}`}
                            >
                              {variation}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
}