import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Wine, Sparkles, ArrowRight, GraduationCap, MessageCircle, User, Camera, Users, MapPin, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Hero Section */}
      <motion.section
        className="pt-16 pb-8 px-4 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="relative w-28 h-28 mx-auto mb-6"
          variants={itemVariants}
        >
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-xl" />
          <div className="absolute inset-2 bg-purple-400/20 rounded-full blur-md" />
          <img
            src="/logo-cata.svg"
            alt="Cata"
            className="relative w-full h-full drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
          />
        </motion.div>

        <motion.h1
          className="text-4xl font-bold text-white mb-3"
          variants={itemVariants}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Your Personal Sommelier
        </motion.h1>

        <motion.p
          className="text-lg text-white/80 max-w-sm mx-auto mb-8 leading-relaxed"
          variants={itemVariants}
        >
          Discover wines you'll love through guided tastings that learn your unique palate.
        </motion.p>

        <motion.div variants={itemVariants}>
          <Button
            onClick={() => setLocation("/home")}
            className="w-full max-w-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-6 text-lg rounded-2xl shadow-lg"
          >
            Start Tasting
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>

        <motion.p
          className="mt-4 text-white/50 text-sm"
          variants={itemVariants}
        >
          Already have an account?{" "}
          <button
            onClick={() => setLocation("/login")}
            className="text-purple-300 hover:text-purple-200 underline"
          >
            Sign In
          </button>
        </motion.p>
      </motion.section>

      {/* Trust Metrics */}
      <motion.section
        className="py-8 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex justify-center gap-4 max-w-md mx-auto">
          <MetricCard icon={Wine} value="500+" label="Wines" />
          <MetricCard icon={User} value="Real" label="Sommeliers" />
          <MetricCard icon={Sparkles} value="AI" label="Insights" />
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        className="py-10 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-xl font-semibold text-white text-center mb-2">
          Everything You Need
        </h2>
        <p className="text-white/60 text-sm text-center max-w-xs mx-auto mb-8">
          From casual tastings to building your collection
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <FeatureCard
            icon={Users}
            title="Group Tastings"
            description="All the software to host a wine dinner — guided questions, live voting, shared insights"
          />
          <FeatureCard
            icon={Camera}
            title="Snap & Learn"
            description="Photo any bottle, we'll guide you through tasting it properly and save your notes"
          />
          <FeatureCard
            icon={BookOpen}
            title="Guided Journeys"
            description="Pick wines at your local shop, follow sommelier-designed tastings at home"
          />
          <FeatureCard
            icon={MapPin}
            title="Take Action"
            description="Know exactly what to order at restaurants or add to your collection"
          />
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        className="py-10 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-xl font-semibold text-white text-center mb-8">
          How It Works
        </h2>

        <div className="space-y-6 max-w-sm mx-auto">
          <StepCard
            number={1}
            title="Taste & Rate"
            description="Rate wines on aroma, taste, finish and more"
          />
          <StepCard
            number={2}
            title="Build Your Profile"
            description="AI + real sommeliers learn your unique palate"
          />
          <StepCard
            number={3}
            title="Take Action"
            description="Know what to order, collect, and explore"
          />
        </div>
      </motion.section>

      {/* Bottom CTA */}
      <motion.section
        className="py-8 px-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <Button
          onClick={() => setLocation("/home")}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10 py-5 px-8 rounded-xl"
        >
          Start Your Wine Journey
        </Button>
      </motion.section>

      {/* Sommelier Value Prop */}
      <motion.section
        className="py-10 px-4 border-t border-white/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <h3 className="text-lg font-medium text-white text-center mb-2">
          Powered by Real Sommeliers
        </h3>
        <p className="text-white/60 text-sm text-center max-w-xs mx-auto mb-6">
          Every tasting and journey is crafted by certified sommeliers. Get live guidance or have experts review your palate.
        </p>

        <div className="max-w-sm mx-auto space-y-4">
          {/* For Wine Professionals */}
          <p className="text-white/40 text-xs text-center uppercase tracking-wide">
            For Wine Professionals
          </p>

          {/* Sommelier Dashboard */}
          <button
            onClick={() => setLocation("/sommelier")}
            className="w-full bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-colors text-left"
          >
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 rounded-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Sommelier Dashboard</p>
              <p className="text-white/50 text-sm">Create and manage wine tastings</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/40" />
          </button>

          {/* Contact Team */}
          <button
            onClick={() => window.location.href = "mailto:hello@cata.wine"}
            className="w-full bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-colors text-left"
          >
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-2.5 rounded-lg">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Contact Our Team</p>
              <p className="text-white/50 text-sm">Partner with us or get enterprise access</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/40" />
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-8">
          Cata - Premium Wine Tasting Experience
        </p>
      </motion.section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Wine;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center flex-1">
      <Icon className="w-5 h-5 text-purple-400 mx-auto mb-2" />
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-sm">{number}</span>
      </div>
      <div>
        <h3 className="text-white font-medium mb-1">{title}</h3>
        <p className="text-white/60 text-sm">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Wine;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
      <Icon className="w-6 h-6 text-purple-400 mb-2" />
      <h3 className="text-white font-medium text-sm mb-1">{title}</h3>
      <p className="text-white/50 text-xs">{description}</p>
    </div>
  );
}
