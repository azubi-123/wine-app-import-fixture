import { motion } from "framer-motion";
import { User, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";

interface AromaDiagramProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AromaDiagram({ isOpen, onClose }: AromaDiagramProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-br from-purple-900/95 to-indigo-900/95 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
            <User className="w-6 h-6 text-purple-300" />
            How to Smell Wine
          </h2>
          
          {/* Visual Diagram */}
          <div className="bg-white/5 rounded-xl p-4 space-y-4">
            <div className="relative mx-auto w-32 h-32">
              {/* Wine Glass Illustration */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Glass */}
                <path
                  d="M25 20 L75 20 L70 40 L65 70 L35 70 L30 40 Z"
                  fill="rgba(139, 69, 19, 0.3)"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                />
                {/* Wine surface */}
                <ellipse cx="50" cy="40" rx="20" ry="3" fill="rgba(139, 69, 19, 0.6)" />
                
                {/* Aroma particles */}
                {[...Array(6)].map((_, i) => (
                  <motion.circle
                    key={i}
                    cx={45 + Math.random() * 10}
                    cy={30 - i * 3}
                    r="1"
                    fill="rgba(255,255,255,0.7)"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      cy: [40, 10]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.3,
                      repeat: Infinity,
                      repeatDelay: 1
                    }}
                  />
                ))}
                
                {/* Nose illustration */}
                <motion.path
                  d="M45 5 L50 15 L55 5"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </svg>
            </div>
          </div>
          
          {/* Step Instructions */}
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-white font-medium">Gentle Swirl</h3>
                <p className="text-white/70 text-sm">
                  Gently swirl the wine to release volatile compounds. Don't be aggressive - just a few gentle circles.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-white font-medium">First Sniff</h3>
                <p className="text-white/70 text-sm">
                  Take a quick, light sniff to get your initial impression. What do you notice first?
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-white font-medium">Deep Inhale</h3>
                <p className="text-white/70 text-sm">
                  Put your nose deeper into the glass and take a longer, deeper sniff. Focus on different scent layers.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="text-white font-medium">Analyze & Describe</h3>
                <p className="text-white/70 text-sm">
                  Think about what you smell: fruits, flowers, spices, earth, or other scents. Trust your instincts.
                </p>
              </div>
            </div>
          </div>
          
          {/* Tips */}
          <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4">
            <h3 className="text-amber-200 font-medium mb-2 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Pro Tips
            </h3>
            <ul className="text-amber-200/80 text-sm space-y-1">
              <li>• Your first impression is often the most accurate</li>
              <li>• Take breaks between sniffs to avoid nose fatigue</li>
              <li>• There are no wrong answers - describe what YOU smell</li>
              <li>• Common aromas: fruits, flowers, herbs, spices, earth</li>
            </ul>
          </div>
          
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}