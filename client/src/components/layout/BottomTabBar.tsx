import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Wine, GraduationCap, User, Plus } from "lucide-react";

type TabId = "tastings" | "journeys" | "profile";

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Wine;
  path: string;
}

const tabs: Tab[] = [
  { id: "tastings", label: "Tastings", icon: Wine, path: "/home" },
  { id: "journeys", label: "Journeys", icon: GraduationCap, path: "/home/journeys" },
  { id: "profile", label: "Profile", icon: User, path: "/home/profile" },
];

interface BottomTabBarProps {
  onStartTasting?: () => void;
}

export function BottomTabBar({ onStartTasting }: BottomTabBarProps) {
  const [location, setLocation] = useLocation();

  // Determine active tab based on current path
  const getActiveTab = (): TabId => {
    if (location.startsWith("/home/journeys")) return "journeys";
    if (location.startsWith("/home/profile")) return "profile";
    return "tastings";
  };

  const activeTab = getActiveTab();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-t border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around max-w-lg mx-auto relative">
          {/* Left tabs */}
          <TabButton
            tab={tabs[0]}
            isActive={activeTab === tabs[0].id}
            onPress={() => setLocation(tabs[0].path)}
          />

          {/* Center FAB */}
          <div className="relative -mt-4">
            <motion.button
              onClick={onStartTasting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30"
            >
              <Plus className="w-7 h-7 text-white" />
            </motion.button>
            <span className="text-white/60 text-[10px] mt-1 block text-center">Taste</span>
          </div>

          {/* Middle tab */}
          <TabButton
            tab={tabs[1]}
            isActive={activeTab === tabs[1].id}
            onPress={() => setLocation(tabs[1].path)}
          />

          {/* Right tab */}
          <TabButton
            tab={tabs[2]}
            isActive={activeTab === tabs[2].id}
            onPress={() => setLocation(tabs[2].path)}
          />
        </div>
      </div>
    </nav>
  );
}

interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ tab, isActive, onPress }: TabButtonProps) {
  const Icon = tab.icon;

  return (
    <button
      onClick={onPress}
      className={`flex flex-col items-center py-3 px-4 min-w-[60px] transition-colors ${
        isActive ? "text-purple-400" : "text-white/50 hover:text-white/70"
      }`}
    >
      <motion.div
        animate={{ scale: isActive ? 1.1 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Icon className="w-6 h-6" />
      </motion.div>
      <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute -bottom-0.5 w-12 h-0.5 bg-purple-400 rounded-full"
        />
      )}
    </button>
  );
}

export default BottomTabBar;
