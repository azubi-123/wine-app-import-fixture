import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SessionRestoreModalProps {
  isOpen: boolean;
  sessionData: {
    sessionId: string;
    participantId: string;
    joinedAt: number;
  } | null;
  onRestore: () => void;
  onStartFresh: () => void;
}

export function SessionRestoreModal({ 
  isOpen, 
  sessionData, 
  onRestore, 
  onStartFresh 
}: SessionRestoreModalProps) {
  const [, setLocation] = useLocation();

  if (!sessionData) return null;

  const joinedTime = new Date(sessionData.joinedAt).toLocaleTimeString();

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Welcome back!
          </DialogTitle>
          <DialogDescription className="text-center">
            You have an active tasting session from {joinedTime}. 
            Would you like to continue where you left off?
          </DialogDescription>
        </DialogHeader>
        
        <motion.div 
          className="flex flex-col gap-3 mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button 
            onClick={onRestore}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Continue Session
          </Button>
          
          <Button 
            onClick={onStartFresh}
            variant="outline" 
            className="w-full"
          >
            Start Fresh
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}