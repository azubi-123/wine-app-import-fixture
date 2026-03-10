import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useHaptics } from "@/hooks/useHaptics";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import type { User } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

type QuizStep = "knowledge" | "vibe" | "food" | "drinks" | "occasion";

interface QuizAnswers {
  knowledgeLevel: string | null;
  wineVibe: string | null;
  foodPreferences: string[];
  drinkPreferences: string[];
  occasion: string | null;
}

interface OptionCard {
  value: string;
  emoji: string;
  title: string;
  description: string;
}

// ============================================================================
// QUIZ DATA
// ============================================================================

const KNOWLEDGE_OPTIONS: OptionCard[] = [
  {
    value: "beginner",
    emoji: "\u{1F331}",
    title: "I'm brand new",
    description: "Never really explored wine",
  },
  {
    value: "casual",
    emoji: "\u{1F377}",
    title: "I know what I like",
    description: "I have favorites but couldn't tell you why",
  },
  {
    value: "enthusiast",
    emoji: "\u{1F4DA}",
    title: "Getting into it",
    description: "I read labels and ask questions at wine shops",
  },
  {
    value: "nerd",
    emoji: "\u{1F9E0}",
    title: "Full wine nerd",
    description: "I could talk terroir all day",
  },
  {
    value: "not_sure",
    emoji: "\u{1F937}",
    title: "Not sure yet",
    description: "I'm still figuring it out",
  },
];

const VIBE_OPTIONS: OptionCard[] = [
  {
    value: "bold",
    emoji: "\u{1F525}",
    title: "Bold & Intense",
    description: "Big reds, full body, wow factor",
  },
  {
    value: "light",
    emoji: "\u{1F338}",
    title: "Light & Fresh",
    description: "Crisp whites, delicate ros\u00E9s, easy-drinking",
  },
  {
    value: "sweet",
    emoji: "\u{1F36F}",
    title: "Sweet & Fruity",
    description: "Moscato, Riesling, fruit-forward wines",
  },
  {
    value: "adventurous",
    emoji: "\u{1F3B2}",
    title: "Surprise me",
    description: "I'll try anything once",
  },
  {
    value: "not_sure",
    emoji: "\u{1F937}",
    title: "Not sure yet",
    description: "I'm still figuring it out",
  },
];

const FOOD_OPTIONS: OptionCard[] = [
  { value: "italian", emoji: "\u{1F35D}", title: "Italian", description: "" },
  { value: "sushi", emoji: "\u{1F363}", title: "Sushi", description: "" },
  { value: "bbq", emoji: "\u{1F525}", title: "BBQ", description: "" },
  { value: "cheese", emoji: "\u{1F9C0}", title: "Cheese", description: "" },
  { value: "spicy", emoji: "\u{1F336}\uFE0F", title: "Spicy", description: "" },
  { value: "seafood", emoji: "\u{1F990}", title: "Seafood", description: "" },
  { value: "steak", emoji: "\u{1F969}", title: "Steak", description: "" },
  { value: "veggie", emoji: "\u{1F957}", title: "Veggie", description: "" },
  { value: "chocolate", emoji: "\u{1F36B}", title: "Chocolate", description: "" },
  { value: "salads", emoji: "\u{1F96C}", title: "Fresh Salads", description: "" },
  { value: "comfort", emoji: "\u{1F35F}", title: "Comfort Food", description: "" },
];

const DRINK_OPTIONS: OptionCard[] = [
  { value: "black_coffee", emoji: "\u2615", title: "Black Coffee", description: "" },
  { value: "iced_latte", emoji: "\u{1F9CB}", title: "Iced Latte", description: "" },
  { value: "tea", emoji: "\u{1FAD6}", title: "Tea", description: "" },
  { value: "sparkling_water", emoji: "\u{1F4A7}", title: "Sparkling Water", description: "" },
  { value: "apple_juice", emoji: "\u{1F34E}", title: "Apple Juice", description: "" },
  { value: "lemonade", emoji: "\u{1F34B}", title: "Lemonade", description: "" },
  { value: "cola", emoji: "\u{1F964}", title: "Cola", description: "" },
  { value: "kombucha", emoji: "\u{1FAD9}", title: "Kombucha", description: "" },
];

const OCCASION_OPTIONS: OptionCard[] = [
  {
    value: "learning",
    emoji: "\u{1F4A1}",
    title: "Learning for fun",
    description: "I just want to know more about wine",
  },
  {
    value: "go_to_bottle",
    emoji: "\u{1F3AF}",
    title: "Finding my go-to bottle",
    description: "I want a reliable everyday pick",
  },
  {
    value: "impress",
    emoji: "\u2728",
    title: "Impressing at dinners",
    description: "I want to sound smart at restaurants",
  },
  {
    value: "date_night",
    emoji: "\u{1F496}",
    title: "Date night picks",
    description: "I need wine for special occasions",
  },
  {
    value: "not_sure",
    emoji: "\u{1F937}",
    title: "Not sure yet",
    description: "I'm just exploring",
  },
];

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
};

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function StepHeader({
  step,
  totalSteps,
  onBack,
}: {
  step: number;
  totalSteps: number;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 mb-8">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      ) : (
        <div />
      )}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i < step
                ? "w-6 bg-purple-500"
                : i === step
                  ? "w-6 bg-purple-400"
                  : "w-3 bg-white/20"
            }`}
          />
        ))}
      </div>
      <div className="text-white/40 text-sm">
        {step + 1} of {totalSteps}
      </div>
    </div>
  );
}

function SingleSelectStep({
  title,
  subtitle,
  options,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  options: OptionCard[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  const { triggerHaptic } = useHaptics();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-white/50 mb-8">{subtitle}</p>
      <div className="space-y-3">
        {options.map((option, i) => (
          <motion.button
            key={option.value}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            onClick={() => {
              triggerHaptic("selection");
              onSelect(option.value);
            }}
            className={`w-full text-left px-5 py-4 rounded-2xl border transition-all duration-200 ${
              selected === option.value
                ? "bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-900/20"
                : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{option.emoji}</span>
              <div>
                <span className="text-white font-medium block">
                  {option.title}
                </span>
                {option.description && (
                  <span className="text-white/40 text-sm">
                    {option.description}
                  </span>
                )}
              </div>
              {selected === option.value && (
                <Check className="w-5 h-5 text-purple-400 ml-auto" />
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function MultiSelectStep({
  title,
  subtitle,
  options,
  selected,
  onToggle,
}: {
  title: string;
  subtitle: string;
  options: OptionCard[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const { triggerHaptic } = useHaptics();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-white/50 mb-8">{subtitle}</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option, i) => {
          const isSelected = selected.includes(option.value);
          return (
            <motion.button
              key={option.value}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              onClick={() => {
                triggerHaptic("selection");
                onToggle(option.value);
              }}
              className={`text-center px-4 py-5 rounded-2xl border transition-all duration-200 ${
                isSelected
                  ? "bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-900/20"
                  : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20"
              }`}
            >
              <span className="text-3xl block mb-2">{option.emoji}</span>
              <span className="text-white font-medium text-sm">
                {option.title}
              </span>
              {isSelected && (
                <Check className="w-4 h-4 text-purple-400 mx-auto mt-2" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OnboardingQuiz() {
  const [step, setStep] = useState<QuizStep>("knowledge");
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({
    knowledgeLevel: null,
    wineVibe: null,
    foodPreferences: [],
    drinkPreferences: [],
    occasion: null,
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const justSaved = useRef(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Auth check — redirect if already completed onboarding
  const { data: authData, isLoading: authLoading } = useQuery<{
    user: User & { onboardingCompleted: boolean };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  useEffect(() => {
    // Redirect users who already completed onboarding away from quiz.
    // Skip if we just saved — our onSuccess navigates to /home?pierre=welcome
    // and we don't want this guard to override that with /home.
    if (authData?.user?.onboardingCompleted && !justSaved.current) {
      setLocation("/home");
    }
  }, [authData, setLocation]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authData?.user) {
      setLocation("/home");
    }
  }, [authLoading, authData, setLocation]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: QuizAnswers | { skip: true }) => {
      const res = await apiRequest("POST", "/api/user/onboarding", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      justSaved.current = true;
      sessionStorage.setItem("pierre_welcome", "true");
      // Update cache immediately so HomeV2 sees onboardingCompleted: true
      // and doesn't redirect back to /onboarding (eliminates bounce delay).
      // Include onboardingData so Pierre's welcome message is personalized.
      const onboardingData = "skip" in variables ? null : variables;
      queryClient.setQueryData(["/api/auth/me"], (old: any) => {
        if (!old?.user) return old;
        return { ...old, user: { ...old.user, onboardingCompleted: true, onboardingData } };
      });
      setLocation("/home");
    },
    onError: () => {
      setSaveError("Something went wrong. Please try again.");
    },
  });

  // Step navigation
  const steps: QuizStep[] = ["knowledge", "vibe", "food", "drinks", "occasion"];
  const currentStepIndex = steps.indexOf(step);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setDirection(1);
      setStep(steps[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setDirection(-1);
      setStep(steps[prevIndex]);
    }
  };

  const handleComplete = () => {
    setSaveError(null);
    saveMutation.mutate(answers);
  };

  const handleSkip = () => {
    setSaveError(null);
    saveMutation.mutate({ skip: true });
  };

  const toggleFood = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      foodPreferences: prev.foodPreferences.includes(value)
        ? prev.foodPreferences.filter((f) => f !== value)
        : [...prev.foodPreferences, value],
    }));
  };

  const toggleDrink = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      drinkPreferences: prev.drinkPreferences.includes(value)
        ? prev.drinkPreferences.filter((d) => d !== value)
        : [...prev.drinkPreferences, value],
    }));
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary flex flex-col">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-8">
        <StepHeader
          step={currentStepIndex}
          totalSteps={steps.length}
          onBack={currentStepIndex > 0 ? goBack : undefined}
        />

        <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {step === "knowledge" && (
              <motion.div
                key="knowledge"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <SingleSelectStep
                  title="Let's get to know you"
                  subtitle="How much do you know about wine?"
                  options={KNOWLEDGE_OPTIONS}
                  selected={answers.knowledgeLevel}
                  onSelect={(value) => {
                    setAnswers((prev) => ({
                      ...prev,
                      knowledgeLevel: value,
                    }));
                    setTimeout(() => {
                      setDirection(1);
                      setStep("vibe");
                    }, 300);
                  }}
                />
              </motion.div>
            )}

            {step === "vibe" && (
              <motion.div
                key="vibe"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <SingleSelectStep
                  title="What's your style?"
                  subtitle="Pick what sounds most like you"
                  options={VIBE_OPTIONS}
                  selected={answers.wineVibe}
                  onSelect={(value) => {
                    setAnswers((prev) => ({ ...prev, wineVibe: value }));
                    setTimeout(() => {
                      setDirection(1);
                      setStep("food");
                    }, 300);
                  }}
                />
              </motion.div>
            )}

            {step === "food" && (
              <motion.div
                key="food"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <MultiSelectStep
                  title="What flavors do you reach for?"
                  subtitle="Your food taste tells us a lot about wines you'll love"
                  options={FOOD_OPTIONS}
                  selected={answers.foodPreferences}
                  onToggle={toggleFood}
                />

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={goNext}
                  className="w-full mt-8 py-4 rounded-2xl font-semibold text-white transition-all duration-200 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:scale-[0.98]"
                >
                  Continue
                </motion.button>
              </motion.div>
            )}

            {step === "drinks" && (
              <motion.div
                key="drinks"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <MultiSelectStep
                  title="What do you usually drink?"
                  subtitle="This tells us more about your palate than you'd think"
                  options={DRINK_OPTIONS}
                  selected={answers.drinkPreferences}
                  onToggle={toggleDrink}
                />

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={goNext}
                  className="w-full mt-8 py-4 rounded-2xl font-semibold text-white transition-all duration-200 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:scale-[0.98]"
                >
                  Continue
                </motion.button>
              </motion.div>
            )}

            {step === "occasion" && (
              <motion.div
                key="occasion"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <SingleSelectStep
                  title="What brings you here?"
                  subtitle="Helps Pierre give you the right kind of advice"
                  options={OCCASION_OPTIONS}
                  selected={answers.occasion}
                  onSelect={(value) => {
                    const updated = { ...answers, occasion: value };
                    setAnswers(updated);
                    // Final step — submit after selection
                    setTimeout(() => {
                      setSaveError(null);
                      saveMutation.mutate(updated);
                    }, 300);
                  }}
                />

                {saveMutation.isPending && (
                  <div className="flex justify-center mt-8">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        {saveError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm text-center mt-4"
          >
            {saveError}
          </motion.p>
        )}

        {/* Skip link */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={handleSkip}
          disabled={saveMutation.isPending}
          className="text-white/30 hover:text-white/50 text-sm py-4 transition-colors"
        >
          Skip for now
        </motion.button>
      </div>
    </div>
  );
}
