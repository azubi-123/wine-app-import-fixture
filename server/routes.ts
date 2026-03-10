import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { trackGuestJoined } from "./audos-integration";
import { uploadMediaFile, deleteMediaFile, getMediaType, isSupabaseConfigured, verifyStorageBucket } from "./supabase-storage";
import { 
  insertSessionSchema,
  insertParticipantSchema,
  insertResponseSchema,
  insertSlideSchema,
  insertPackageWineSchema,
  type InsertSession
} from "@shared/schema";
import { z } from "zod";
// Note: Removed problematic reorderSlidesForWineSimple function
// Now using proven storage.batchUpdateSlidePositions instead
import { registerMediaProxyRoutes } from './routes/media-proxy';
import { registerUserRoutes } from './routes/user';
import { registerDashboardRoutes } from './routes/dashboard';
import { registerAuthRoutes } from './routes/auth';
import { registerTastingsRoutes } from './routes/tastings';
import { registerWinesRoutes } from './routes/wines';
import { registerSommelierChatRoutes } from './routes/sommelier-chat';

// Configure multer for file uploads with comprehensive image support
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    // Support all major media formats
    const allowedImageTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'image/bmp', 'image/tiff', 'image/avif', 'image/heic', 'image/heif'
    ];
    const allowedAudioTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/x-aac',
      'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac',
      'audio/3gpp', 'audio/3gpp2', 'audio/amr', 'audio/opus',
      'audio/vnd.wav', 'audio/L16', 'audio/pcm', 'audio/basic',
      'audio/aiff', 'audio/x-aiff', 'audio/midi', 'audio/x-midi',
      'audio/wma', 'audio/x-ms-wma', 'audio/ra', 'audio/x-realaudio',
      'audio/vorbis', 'audio/x-vorbis+ogg'
    ];
    const allowedVideoTypes = [
      'video/mp4', 'video/webm', 'video/quicktime', 
      'video/avi', 'video/x-msvideo',
      'video/x-matroska', 'video/mkv',
      'video/x-flv', 'video/flv',
      'video/x-ms-wmv', 'video/wmv',
      'video/3gpp', 'video/3gpp2',
      'video/mov', 'video/ogg', 'video/ogv'
    ];
    
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported image format: ${file.mimetype}`));
      }
    } else if (file.mimetype.startsWith('audio/')) {
      if (allowedAudioTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        // Check file extension as fallback for common audio files
        const fileName = file.originalname.toLowerCase();
        const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma', '.opus', '.aiff', '.amr', '.3gp'];
        const hasAudioExtension = audioExtensions.some(ext => fileName.endsWith(ext));
        
        if (hasAudioExtension) {
          console.log(`Audio file accepted by extension despite MIME type: ${file.mimetype} (${file.originalname})`);
          cb(null, true);
        } else {
          cb(new Error(`Unsupported audio format: ${file.mimetype} (file: ${file.originalname})`));
        }
      }
    } else if (file.mimetype.startsWith('video/')) {
      if (allowedVideoTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        // Check file extension as fallback for common video files
        const fileName = file.originalname.toLowerCase();
        const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.3gp', '.ogg', '.ogv'];
        const hasVideoExtension = videoExtensions.some(ext => fileName.endsWith(ext));
        
        if (hasVideoExtension) {
          console.log(`Video file accepted by extension despite MIME type: ${file.mimetype} (${file.originalname})`);
          cb(null, true);
        } else {
          cb(new Error(`Unsupported video format: ${file.mimetype} (file: ${file.originalname})`));
        }
      }
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Verify Supabase Storage configuration if configured
  if (isSupabaseConfigured()) {
    const storageCheck = await verifyStorageBucket();
    if (!storageCheck.success) {
      console.error("⚠️  Supabase Storage verification failed:", storageCheck.error);
      console.error("⚠️  Media uploads will not work properly until this is fixed.");
    }
  }
  
  // Validate package code
  app.get("/api/packages/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const pkg = await storage.getPackageByCode(code.toUpperCase());
      
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.json(pkg);
    } catch (error) {
      console.error("Error fetching package:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get slides for a package (now organized by wines)
  app.get("/api/packages/:code/slides", async (req, res) => {
    try {
      const { code } = req.params;
      const { participantId } = req.query;
      
      const pkg = await storage.getPackageByCode(code.toUpperCase());
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }

      // Check if participant is host and get session wine selections
      let isHost = false;
      let participant = null;
      if (participantId && participantId !== 'undefined' && participantId !== 'null') {
        try {
          participant = await storage.getParticipantById(participantId as string);
          if (participant) {
            isHost = participant.isHost || false;
          }
        } catch (error) {
          console.error(`Error fetching participant ${participantId}:`, error);
          // Continue without participant data
        }
      }

      // Check if this request is from a session that has wine selections
      let wines = await storage.getPackageWines(pkg.id);
      if (participant?.sessionId) {
        // Check if this session has custom wine selections
        const sessionWineSelections = await storage.getSessionWineSelections(participant.sessionId);
        if (sessionWineSelections.length > 0) {
          // Use session-specific wine selections, ordered by host preference
          wines = sessionWineSelections
            .filter(selection => selection.isIncluded)
            .sort((a, b) => a.position - b.position)
            .map(selection => selection.wine);
        }
      }

      let allSlides: any[] = [];

      // Fetch package-level slides (intros, transitions, etc.)
      const packageSlides = await storage.getSlidesByPackageId(pkg.id);
      // Add package context to each package-level slide
      const packageSlidesWithContext = packageSlides.map(slide => ({
        ...slide,
        packageInfo: {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description
        }
      }));
      allSlides = allSlides.concat(packageSlidesWithContext);

      // Get all wine slides in a single query (optimized)
      const wineIds = wines.map(w => w.id);
      const allWineSlides = wineIds.length > 0 
        ? await storage.getSlidesByPackageWineIds(wineIds)
        : [];
      
      // Group slides by wine ID for context addition
      const slidesByWineId = allWineSlides.reduce((acc, slide) => {
        if (!acc[slide.packageWineId!]) acc[slide.packageWineId!] = [];
        acc[slide.packageWineId!].push(slide);
        return acc;
      }, {} as Record<string, typeof allWineSlides>);
      
      // Add wine context to each slide
      for (const wine of wines) {
        const wineSlides = slidesByWineId[wine.id] || [];
        const slidesWithWineContext = wineSlides.map(slide => ({
          ...slide,
          wineInfo: {
            id: wine.id,
            wineName: wine.wineName,
            wineDescription: wine.wineDescription,
            wineImageUrl: wine.wineImageUrl,
            position: wine.position
          }
        }));
        allSlides = allSlides.concat(slidesWithWineContext);
      }

      // Sort all slides by global position to ensure correct order
      // Add stable sorting with ID fallback to prevent unstable ordering for duplicate positions
      allSlides.sort((a, b) => {
        const posA = a.globalPosition || 0;
        const posB = b.globalPosition || 0;
        if (posA !== posB) return posA - posB;
        // Fallback: sort by slide ID for stability when positions are equal
        return a.id.localeCompare(b.id);
      });

      // Filter host-only slides if not host
      if (!isHost) {
        allSlides = allSlides.filter((slide) => {
          const payload = slide.payloadJson as any;
          return !payload.for_host;
        });
      }

      res.json({ package: pkg, slides: allSlides, totalCount: allSlides.length, wines });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create session (with optional host participant)
  app.post("/api/sessions", async (req, res) => {
    try {
      const { packageId, packageCode, name, hostName, hostDisplayName, hostEmail, createHost } = req.body;
      
      let pkg;
      if (packageId) {
        // Find package by ID (for existing packages)
        const packages = Array.from((storage as any).packages.values());
        pkg = packages.find((p: any) => p.id === packageId);
      } else if (packageCode) {
        // Find package by code
        pkg = await storage.getPackageByCode(packageCode.toUpperCase());
      }
      
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }

      // Create the session
      const sessionInputData: InsertSession = {
        packageId: (pkg as any).id,
        completedAt: null,
        activeParticipants: 0
      };

      if (createHost) {
        sessionInputData.status = 'active'; // Set session to active if a host is being created
      }

      const session = await storage.createSession(sessionInputData);

      // If createHost is true, also create the host participant
      let hostParticipant = null;
      if (createHost) {
        const hostParticipantData = insertParticipantSchema.parse({
          sessionId: session.id,
          displayName: hostDisplayName || hostName || 'Host',
          email: hostEmail || '',
          isHost: true,
          progress: 0
        });

        hostParticipant = await storage.createParticipant(hostParticipantData);
        
        if (!hostParticipant) {
          return res.status(500).json({ message: "Failed to create host participant for the new session" });
        }
        
        // Update session participant count
        await storage.updateSessionParticipantCount(session.id, 1);
      }

      // Return both session and host participant info
      res.json({
        session,
        hostParticipantId: hostParticipant?.id || null
      });
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get session by package code
  app.get("/api/sessions/by-package/:packageCode", async (req, res) => {
    try {
      const { packageCode } = req.params;
      
      // Find package by code
      const pkg = await storage.getPackageByCode(packageCode.toUpperCase());
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }

      // Find the most recent active session for this package
      const allSessions = await storage.getAllSessions();
      const packageSessions = allSessions.filter(session => session.packageId === pkg.id);
      
      if (packageSessions.length === 0) {
        return res.status(404).json({ message: "No sessions found for this package" });
      }

      // Return the most recent session (you could also filter by status if needed)
      const latestSession = packageSessions.sort((a, b) => 
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      )[0];

      // Add package code to the response
      const sessionWithPackageCode = {
        ...latestSession,
        packageCode: pkg.code
      };

      res.json(sessionWithPackageCode);
    } catch (error) {
      console.error("Error getting session by package code:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Join session as participant
  app.post("/api/sessions/:sessionIdOrShortCode/participants", async (req, res) => {
    try {
      const { sessionIdOrShortCode } = req.params; // This can be either UUID or short_code
      
      // Validate the identifier parameter
      if (!sessionIdOrShortCode || sessionIdOrShortCode === 'undefined' || sessionIdOrShortCode === 'null') {
        console.error(`[JOIN_ERROR] Invalid session identifier provided: ${sessionIdOrShortCode}`);
        return res.status(400).json({ message: "Invalid session identifier. Please provide a valid session ID or code." });
      }

      // 1. Fetch the session using the provided identifier
      // storage.getSessionById handles both UUIDs and short_codes
      const session = await storage.getSessionById(sessionIdOrShortCode);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found. Please check the session code and try again." });
      }
      
      // Validate session.id is a proper UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!session.id || !uuidRegex.test(session.id)) {
        console.error(`[JOIN_ERROR] Invalid session UUID format: ${session.id}`);
        return res.status(500).json({ message: "Internal error: Invalid session ID format" });
      }

      // 2. Check session status
      if (session.status !== 'active') {
        return res.status(400).json({ message: "Session is not active. Please check with the host." });
      }

      // 3. Parse participant data from request body
      // Omit sessionId from initial parsing since we'll set it correctly
      let participantInputData;
      try {
        participantInputData = insertParticipantSchema
          .omit({ sessionId: true })
          .parse(req.body);
      } catch (parseError) {
        console.error(`[JOIN_ERROR] Failed to parse participant data:`, parseError);
        if (parseError instanceof z.ZodError) {
          return res.status(400).json({ 
            message: "Invalid participant data", 
            errors: parseError.errors 
          });
        }
        throw parseError;
      }

      // 4. Verify active host using the actual session UUID
      const currentParticipants = await storage.getParticipantsBySessionId(session.id);
      const hasActiveHost = currentParticipants.some(p => p.isHost);
      
      if (!hasActiveHost) {
        return res.status(400).json({ message: "Session does not have an active host. Please contact the session organizer." });
      }

      // 5. Check if participant with same email already exists in this session
      let existingParticipant = null;
      if (participantInputData.email) {
        existingParticipant = await storage.getParticipantByEmailInSession(session.id, participantInputData.email);
        
        if (existingParticipant) {
          // Update their display name if it changed
          if (existingParticipant.displayName !== participantInputData.displayName) {
            await storage.updateParticipantDisplayName(existingParticipant.id, participantInputData.displayName);
            existingParticipant.displayName = participantInputData.displayName;
          }
          
          // Update their last active time
          await storage.updateParticipantProgress(existingParticipant.id, existingParticipant.progressPtr || 0);
          
          return res.json({
            ...existingParticipant,
            isReturning: true
          });
        }
      }
      
      // 6. Create new participant if none exists
      const participantPayload = {
        ...participantInputData,
        sessionId: session.id  // CRITICAL FIX: Use actual session UUID, not short code
      };
      
      let newParticipant;
      try {
        newParticipant = await storage.createParticipant(participantPayload);
      } catch (dbError: any) {
        // Enhanced database error logging
        console.error(`[JOIN_ERROR_DB] Database error during participant creation:`, {
          error: dbError,
          errorMessage: dbError?.message,
          errorCode: dbError?.code,
          errorDetail: dbError?.detail,
          errorTable: dbError?.table,
          errorColumn: dbError?.column,
          errorConstraint: dbError?.constraint,
          participantPayload: participantPayload,
          sessionId: session.id,
          sessionShortCode: session.short_code
        });
        
        // Rethrow to be caught by outer catch block
        throw dbError;
      }
      
      if (!newParticipant || !newParticipant.id) {
        console.error(`[JOIN_ERROR] Failed to create participant - no participant returned`);
        return res.status(500).json({ message: "Failed to create participant. Please try again." });
      }

      // 7. Update participant count using the actual session UUID
      const updatedParticipantsList = await storage.getParticipantsBySessionId(session.id);
      await storage.updateSessionParticipantCount(session.id, updatedParticipantsList.length);

      if (newParticipant.email) {
        trackGuestJoined(newParticipant.email, newParticipant.displayName, session.short_code || undefined);
      }

      res.json(newParticipant);

    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[JOIN_ERROR] Validation error for participant data:", error.errors);
        return res.status(400).json({ message: "Invalid participant data", errors: error.errors });
      }

      // Log the full error for debugging
      console.error(`[JOIN_ERROR] Critical error in /api/sessions/${req.params.sessionIdOrShortCode}/participants:`, error);
      console.error(`[JOIN_ERROR] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      
      // Handle specific database errors
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as any;
        
        // PostgreSQL error codes
        if (dbError.code === '22P02') {
          // Invalid text representation (e.g., invalid UUID format)
          console.error("[JOIN_ERROR_DB] Invalid UUID format:", dbError.detail || dbError.message);
          return res.status(500).json({ 
            message: "Database error: Invalid session ID format. This may be due to using a short code where a UUID is expected.",
            errorCode: "INVALID_UUID_FORMAT"
          });
        }
        
        if (dbError.code === '23503') {
          // Foreign key violation
          console.error("[JOIN_ERROR_DB] Foreign key constraint violation:", dbError.detail || dbError.message);
          return res.status(500).json({ 
            message: "Database error: The session ID does not exist or is invalid. Please ensure you're using a valid session.",
            errorCode: "INVALID_SESSION_REFERENCE"
          });
        }
        
        if (dbError.code === '23505') {
          // Unique constraint violation
          console.error("[JOIN_ERROR_DB] Unique constraint violation:", dbError.detail || dbError.message);
          return res.status(409).json({ 
            message: "You may have already joined this session. Please refresh and try again.",
            errorCode: "DUPLICATE_PARTICIPANT"
          });
        }
      }
      
      // Generic error response with more context
      res.status(500).json({ 
        message: "Internal server error while attempting to join session. Please try again or contact support.",
        errorCode: "INTERNAL_ERROR",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get session participants
  app.get("/api/sessions/:sessionIdOrShortCode/participants", async (req, res) => {
    try {
      const { sessionIdOrShortCode } = req.params;
      
      // First, we need to resolve the session ID if a short code was provided
      // This mirrors the logic in the POST endpoint
      const session = await storage.getSessionById(sessionIdOrShortCode);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Now use the actual session UUID to get participants
      const participants = await storage.getParticipantsBySessionId(session.id);
      res.json(participants);
    } catch (error) {
      console.error("[GET_PARTICIPANTS_ERROR] Failed to get participants:", {
        sessionIdOrShortCode: req.params.sessionIdOrShortCode,
        error: error instanceof Error ? error.message : error
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update session status
  app.patch("/api/sessions/:sessionIdOrShortCode/status", async (req, res) => {
    try {
      const { sessionIdOrShortCode } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: "Invalid status provided in request body." });
      }
      
      // Resolve to actual session ID first
      const session = await storage.getSessionById(sessionIdOrShortCode);
      if (!session) {
        return res.status(404).json({ message: "Session not found." });
      }

      const updatedSession = await storage.updateSessionStatus(session.id, status);
      if (!updatedSession) {
        return res.status(404).json({ message: "Session not found or failed to update." });
      }
      
      res.json(updatedSession);
    } catch (error: any) {
      console.error(`Error updating session ${req.params.sessionIdOrShortCode} status:`, error);
      if (error.message?.includes('Invalid session status')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error updating session status." });
    }
  });

  // Package wines endpoint for wine selection
  app.get("/api/packages/:packageId/wines", async (req, res) => {
    try {
      const { packageId } = req.params;
      const wines = await storage.getPackageWines(packageId);
      res.json(wines);
    } catch (error) {
      console.error("Error fetching package wines:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Session Wine Selection Routes
  app.get("/api/sessions/:sessionId/wine-selections", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const selections = await storage.getSessionWineSelections(sessionId);
      res.json(selections);
    } catch (error) {
      console.error("Error fetching session wine selections:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/sessions/:sessionId/wine-selections", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { selections } = req.body;
      
      const savedSelections = await storage.createSessionWineSelections(sessionId, selections);
      res.json(savedSelections);
    } catch (error) {
      console.error("Error creating session wine selections:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/sessions/:sessionIdOrShortCode/wine-selections", async (req, res) => {
    try {
      const { sessionIdOrShortCode } = req.params;
      const { selections } = req.body;
      
      // Resolve to actual session ID first
      const session = await storage.getSessionById(sessionIdOrShortCode);
      if (!session) {
        return res.status(404).json({ message: "Session not found." });
      }
      
      const updatedSelections = await storage.updateSessionWineSelections(session.id, selections);
      res.json(updatedSelections);
    } catch (error) {
      console.error("Error updating session wine selections:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save response
  app.post("/api/responses", async (req, res) => {
    try {
      const validatedData = insertResponseSchema.parse(req.body);
      
      // First check if participant exists
      const participant = await storage.getParticipantById(validatedData.participantId!);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      // Try to update existing response first, create if it doesn't exist
      const response = await storage.updateResponse(
        validatedData.participantId!,
        validatedData.slideId!,
        validatedData.answerJson
      );
      
      // Update participant progress and lastActive
      const currentSlide = await storage.getSlideById(validatedData.slideId!);
      if (currentSlide) {
        // Get all slides for this participant's package to find the index
        const session = await storage.getSessionById(participant.sessionId!);
        if (session && session.packageId) {
          const pkg = await storage.getPackageById(session.packageId);
          if (pkg) {
            const packageWines = await storage.getPackageWines(pkg.id);
            let allSlides: any[] = [];
            
            // Get all slides in order
            for (const wine of packageWines) {
              const wineSlides = await storage.getSlidesByPackageWineId(wine.id);
              allSlides = allSlides.concat(wineSlides);
            }
            
            // Sort by global position
            allSlides.sort((a, b) => (a.globalPosition || 0) - (b.globalPosition || 0));
            
            // Filter host-only slides if participant is not host
            if (!participant.isHost) {
              allSlides = allSlides.filter(slide => !(slide.payloadJson as any)?.for_host);
            }
            
            // Find current slide index (1-based for progress)
            const slideIndex = allSlides.findIndex(s => s.id === currentSlide.id) + 1;
            
            if (slideIndex > 0) {
              const currentProgress = participant.progressPtr || 0;
              
              // Only update progress if moving forward
              if (slideIndex > currentProgress) {
                await storage.updateParticipantProgress(
                  participant.id,
                  slideIndex
                );
              } else {
                // Still update lastActive even if not moving forward
                await storage.updateParticipantProgress(
                  participant.id,
                  currentProgress
                );
              }
            }
          }
        }
      }
      
      res.json(response);
    } catch (error: any) {
      // console.log("POST /api/responses - Request body:", req.body);
      // console.log("POST /api/responses - Error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      
      // Handle participant not found errors specifically
      if (error.message === 'Participant not found') {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update response
  app.put("/api/responses/:participantId/:slideId", async (req, res) => {
    try {
      const { participantId, slideId } = req.params;
      const { answerJson } = req.body;

      const response = await storage.updateResponse(participantId, slideId, answerJson);
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get participant responses
  app.get("/api/participants/:participantId/responses", async (req, res) => {
    try {
      const { participantId } = req.params;
      
      // Validate participantId
      if (!participantId || participantId === 'undefined' || participantId === 'null') {
        return res.status(400).json({ message: "Invalid participant ID" });
      }
      
      const responses = await storage.getResponsesByParticipantId(participantId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching participant responses:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update participant progress
  app.patch("/api/participants/:participantId/progress", async (req, res) => {
    try {
      const { participantId } = req.params;
      const { progress } = req.body;
      
      if (typeof progress !== 'number' || progress < 0) {
        return res.status(400).json({ message: "Invalid progress value" });
      }
      
      const participant = await storage.getParticipantById(participantId);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      await storage.updateParticipantProgress(participantId, progress);
      res.json({ success: true, progress });
    } catch (error) {
      console.error("Error updating participant progress:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get slide responses (for host)
  app.get("/api/slides/:slideId/responses", async (req, res) => {
    try {
      const { slideId } = req.params;
      const responses = await storage.getResponsesBySlideId(slideId);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get session by ID
  app.get("/api/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Note: Participants endpoint is already defined above with proper sessionIdOrShortCode handling

  // Get aggregated analytics for a session
  app.get("/api/sessions/:sessionId/analytics", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const analyticsData = await storage.getAggregatedSessionAnalytics(sessionId);
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching session analytics:", error);
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({ message: "Session not found" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get participant-specific analytics for completion experience
  app.get("/api/sessions/:sessionId/participant-analytics/:participantId", async (req, res) => {
    try {
      const { sessionId, participantId } = req.params;
      const participantAnalytics = await storage.getParticipantAnalytics(sessionId, participantId);
      res.json(participantAnalytics);
    } catch (error) {
      console.error("Error fetching participant analytics:", error);
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({ message: "Session not found" });
      }
      if (error instanceof Error && error.message === 'Participant not found') {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get completion status for all participants in a session for a specific wine
  app.get("/api/sessions/:sessionId/completion-status", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { wineId } = req.query;
      
      if (!wineId) {
        return res.status(400).json({ message: "wineId query parameter is required" });
      }
      
      const completionStatus = await storage.getSessionCompletionStatus(sessionId, wineId as string);
      
      res.json(completionStatus);
    } catch (error) {
      console.error("Error fetching session completion status:", error);
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({ message: "Session not found" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get completion status for all participants in a session for a specific wine (RESTful URL format)
  app.get("/api/sessions/:sessionId/wines/:wineId/completion-status", async (req, res) => {
    try {
      const { sessionId, wineId } = req.params;
      
      const completionStatus = await storage.getSessionCompletionStatus(sessionId, wineId);
      
      res.json(completionStatus);
    } catch (error) {
      console.error("Error fetching wine completion status:", error);
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({ message: "Session not found" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Analyze sentiment for wine text responses
  app.post("/api/sessions/:sessionId/wines/:wineId/sentiment-analysis", async (req, res) => {
    try {
      const { sessionId, wineId } = req.params;
      
      // Get all text responses for this wine from all participants
      const textResponses = await storage.getWineTextResponses(sessionId, wineId);
      
      if (textResponses.length === 0) {
        return res.json({
          sessionId,
          wineId,
          message: "No text responses found for sentiment analysis",
          results: []
        });
      }
      
      // Import OpenAI client dynamically to avoid dependency issues if not configured
      const { analyzeWineTextResponsesForSummary } = await import('./openai-client.js');
      
      // Perform summary analysis instead of sentiment scoring - convert format for OpenAI client
      const formattedResponses = textResponses.map(response => ({
        slideId: response.slideId,
        questionTitle: response.questionText,
        textContent: response.answerText
      }));
      
      const summaryResults = await analyzeWineTextResponsesForSummary(formattedResponses, wineId, sessionId);
      
      // Save sentiment results to database - convert WineTextAnalysis to array format for compatibility
      const resultsArray = [{
        wineId,
        participantId: summaryResults.participantId,
        overallSentiment: summaryResults.overallSentiment,
        textResponses: summaryResults.textResponses,
        timestamp: new Date().toISOString()
      }];
      
      await storage.saveSentimentAnalysis(sessionId, wineId, resultsArray);
      
      res.json({
        sessionId,
        wineId,
        totalResponses: textResponses.length,
        results: summaryResults,
        analysisType: 'summary', // Indicate this is summary-based analysis
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("❌ Error performing text summary analysis:", error);
      
      // Provide fallback analysis if OpenAI fails
      if (error instanceof Error && (error.message?.includes('OpenAI') || error.message?.includes('API'))) {
        try {
          const { getFallbackSentimentAnalysis } = await import('./openai-client.js');
          const textResponses = await storage.getWineTextResponses(req.params.sessionId, req.params.wineId);
          
          // Create fallback analysis for each response with summary focus
          const fallbackResults = textResponses.map(response => ({
            ...response,
            sentiment: getFallbackSentimentAnalysis(response.answerText),
            summary: `Fallback summary for: ${response.answerText.substring(0, 100)}...`
          }));
          
          res.json({
            sessionId: req.params.sessionId,
            wineId: req.params.wineId,
            totalResponses: textResponses.length,
            results: fallbackResults,
            fallback: true,
            analysisType: 'fallback_summary',
            timestamp: new Date().toISOString()
          });
        } catch (fallbackError) {
          console.error("❌ Fallback text summary analysis failed:", fallbackError);
          res.status(500).json({ message: "Text summary analysis unavailable" });
        }
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Step 4: Calculate question averages for a wine
  app.post('/api/sessions/:sessionId/wines/:wineId/calculate-averages', async (req, res) => {
    try {
      const { sessionId, wineId } = req.params;
      
      if (!sessionId || !wineId) {
        return res.status(400).json({ 
          message: "sessionId and wineId parameters are required" 
        });
      }

      // Resolve to actual session UUID if a short code is provided
      const session = await storage.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      const resolvedSessionId = session.id;

      // Calculate averages for all questions in this wine
      const questionAverages = await storage.calculateWineQuestionAverages(resolvedSessionId, wineId);
      
      if (questionAverages.length === 0) {
        return res.json({
          sessionId,
          wineId,
          message: "No questions found for average calculation",
          questions: {},
          results: []
        });
      }
      
      // Transform data into the format expected by frontend
      const questionsMap: Record<string, any> = {};
      
      questionAverages.forEach((question, index) => {
        const questionId = question.slideId || `question-${index}`;
        
        // Include scale and multiple_choice when average is available
        if ((question.questionType === 'scale' || question.questionType === 'multiple_choice') && 
            question.averageScore !== null && question.averageScore !== undefined) {
          questionsMap[questionId] = {
            id: questionId,
            questionId: questionId,
            slideId: question.slideId,
            questionTitle: question.questionTitle,
            title: question.questionTitle,
            question: question.questionTitle,
            average: parseFloat(question.averageScore.toFixed(1)),
            avg: parseFloat(question.averageScore.toFixed(1)),
            value: parseFloat(question.averageScore.toFixed(1)),
            participantCount: question.totalResponses,
            participants: question.totalResponses,
            count: question.totalResponses,
            responseCount: question.totalResponses,
            scaleMax: question.questionType === 'scale' ? 10 : (question.questionType === 'multiple_choice' ? 10 : 1), // Adjust max based on type
            scale_max: question.questionType === 'scale' ? 10 : (question.questionType === 'multiple_choice' ? 10 : 1),
            questionType: question.questionType,
            responseDistribution: question.responseDistribution,
            timestamp: question.timestamp
          };
        } else if (question.questionType === 'boolean') {
          // Always include boolean questions even if averageScore is null
          questionsMap[questionId] = {
            id: questionId,
            questionId: questionId,
            slideId: question.slideId,
            questionTitle: question.questionTitle,
            title: question.questionTitle,
            question: question.questionTitle,
            average: null,
            avg: null,
            value: null,
            participantCount: question.totalResponses,
            participants: question.totalResponses,
            count: question.totalResponses,
            responseCount: question.totalResponses,
            scaleMax: 1,
            scale_max: 1,
            questionType: question.questionType,
            responseDistribution: question.responseDistribution,
            timestamp: question.timestamp
          };
        }
        // Handle text questions differently - include summaries instead of scores
        else if (question.questionType === 'text' && question.totalResponses > 0) {
          // For text questions, we don't show numerical averages but include the summary
          questionsMap[questionId] = {
            id: questionId,
            questionId: questionId,
            slideId: question.slideId,
            questionTitle: question.questionTitle,
            title: question.questionTitle,
            question: question.questionTitle,
            average: null, // No numerical average for text questions
            avg: null,
            value: null,
            participantCount: question.totalResponses,
            participants: question.totalResponses,
            count: question.totalResponses,
            responseCount: question.totalResponses,
            scaleMax: null, // No scale for text questions
            scale_max: null,
            questionType: question.questionType,
            responseDistribution: question.responseDistribution,
            textSummary: question.responseDistribution?.summary || 'No summary available',
            keywords: question.responseDistribution?.keywords || [],
            sentiment: question.responseDistribution?.sentiment || 'neutral',
            timestamp: question.timestamp,
            hasTextResponses: true,
            isTextQuestion: true // Flag to help frontend handle differently
          };
        }
      });
      
      // Enrich boolean questions with user names and accurate counts from session responses
      try {
        const sessionParticipants = await storage.getParticipantsBySessionId(resolvedSessionId);
        const participantIdToName = new Map<string, string>();
        const validParticipantIds = new Set<string>();
        for (const p of sessionParticipants) {
          if (p?.id) {
            validParticipantIds.add(p.id);
            participantIdToName.set(p.id, p.displayName || p.email || 'Participant');
          }
        }

        // Iterate only boolean questions
        const booleanEntries = Object.entries(questionsMap).filter(([, q]) => q.questionType === 'boolean');
        for (const [, q] of booleanEntries) {
          const slideId = q.slideId;
          if (!slideId) continue;
          try {
            const slideResponses = await storage.getResponsesBySlideId(slideId);
            // Filter to current session participants
            const filtered = slideResponses.filter((r: any) => r?.participantId && validParticipantIds.has(r.participantId));

            let yesUsers: string[] = [];
            let noUsers: string[] = [];

            for (const r of filtered) {
              const ans = r?.answerJson;
              let val: boolean | null = null;
              if (typeof ans === 'boolean') {
                val = ans;
              } else if (typeof ans === 'string') {
                if (ans.toLowerCase() === 'true' || ans.toLowerCase() === 'yes' || ans === '1') val = true;
                else if (ans.toLowerCase() === 'false' || ans.toLowerCase() === 'no' || ans === '0') val = false;
              } else if (ans && typeof ans === 'object' && 'value' in ans) {
                if (typeof (ans as any).value === 'boolean') val = (ans as any).value;
              }

              const name = participantIdToName.get(r.participantId!) ?? 'Participant';
              if (val === true) yesUsers.push(name);
              else if (val === false) noUsers.push(name);
            }

            const totalCount = yesUsers.length + noUsers.length;
            // Build enriched distribution even if zeros, so frontend can still render labels
            const enrichedDistribution = [
              {
                option: 'true',
                optionText: 'Yes',
                count: yesUsers.length,
                percentage: totalCount > 0 ? Math.round((yesUsers.length / totalCount) * 100) : 0,
                users: yesUsers
              },
              {
                option: 'false',
                optionText: 'No',
                count: noUsers.length,
                percentage: totalCount > 0 ? Math.round((noUsers.length / totalCount) * 100) : 0,
                users: noUsers
              }
            ];

            q.responseDistribution = enrichedDistribution;
            // Keep participantCount as-is from averages; do not override average
          } catch (enrichErr) {
            console.warn('Warning: failed to enrich boolean distribution for slide', slideId, enrichErr);
          }
        }
      } catch (enrichOuterErr) {
        console.warn('Warning: boolean distribution enrichment skipped:', enrichOuterErr);
      }

      res.json({
        sessionId: resolvedSessionId,
        wineId,
        totalQuestions: questionAverages.length,
        scaleQuestions: Object.keys(questionsMap).length,
        questions: questionsMap, // Frontend expects this structure
        data: questionsMap, // Alternative path for frontend parsing
        averages: questionsMap, // Another alternative path
        results: questionAverages, // Keep original for compatibility
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Error calculating question averages:", error);
      res.status(500).json({ 
        message: "Failed to calculate question averages",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/api/sessions/:sessionId/wines/:wineId/comparable-questions', async (req, res) => {
    try {
        const { sessionId, wineId } = req.params;

        if (!sessionId || !wineId) {
            return res.status(400).json({
            message: "sessionId and wineId parameters are required"
            });
        }

        // Fetch comparabel questions for this wine
        const comparabelQuestions = await storage.getComparabelQuestions(sessionId, wineId);

        if (comparabelQuestions.length === 0) {
            return res.json({
            sessionId,
            wineId,
            message: "No comparabel questions found for this wine",
            questions: []
            });
        }

        res.json({
            sessionId,
            wineId,
            totalQuestions: comparabelQuestions.length,
            questions: comparabelQuestions
        });
    }
    catch (error) {
        console.error("Error fetching comparabel questions:", error);
        res.status(500).json({
          message: "Failed to fetch comparabel questions",
          error: error instanceof Error ? error.message : String(error)
        });
    }
  });

  //endpoint to update comparabel questions for a wine
  app.put('/api/slides/:slideId/comparable-questions', async (req, res) => {
    try {
      const { slideId } = req.params;

      if (!slideId) {
        return res.status(400).json({ message: "Invalid request data" });
      }

      // Update the comparable questions for the slide
      const updatedSlide = await storage.updateSlideComparableQuestions(slideId);

      if (!updatedSlide) {
        return res.status(404).json({ message: "Slide not found" });
      }

      res.json(updatedSlide);
    } catch (error) {
      console.error("Error updating comparable questions:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // Step 5: Timer and Skip Option
  // Note: Step 5 is implemented on the frontend by orchestrating Steps 3 and 4.
  // When a participant finishes early and the 2-minute timer is running:
  // - Skip button triggers processTextAnswersAndShowAverages()
  // - Timer expiry also triggers processTextAnswersAndShowAverages()
  // - This function calls the Step 3 sentiment-analysis endpoint followed by Step 4 calculate-averages endpoint

  // Data export endpoints

  // Export session analytics as CSV
  app.get("/api/sessions/:sessionId/export/csv", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Get analytics data
      const analyticsData = await storage.getAggregatedSessionAnalytics(sessionId);
      
      // Get all responses for detailed export
      const responses = await storage.getSessionResponses(sessionId);
      
      // Build CSV content
      let csv = 'Session Analytics Export\n';
      csv += `Session ID:,${analyticsData.sessionId}\n`;
      csv += `Session Name:,${analyticsData.sessionName}\n`;
      csv += `Package:,${analyticsData.packageName}\n`;
      csv += `Total Participants:,${analyticsData.totalParticipants}\n`;
      csv += `Completed Participants:,${analyticsData.completedParticipants}\n`;
      csv += `Average Progress:,${analyticsData.averageProgressPercent}%\n`;
      csv += '\n';
      
      // Question-by-question breakdown
      csv += 'Question Analytics\n';
      csv += 'Position,Title,Type,Total Responses,Details\n';
      
      for (const slide of analyticsData.slidesAnalytics) {
        csv += `${slide.slidePosition},"${slide.slideTitle.replace(/"/g, '""')}",${slide.questionType || 'N/A'},${slide.totalResponses},`;
        
        if (slide.questionType === 'multiple_choice' && slide.aggregatedData.optionsSummary) {
          // Format multiple choice options
          const optionsText = slide.aggregatedData.optionsSummary
            .map((opt: any) => `${opt.optionText}: ${opt.count} (${opt.percentage}%)`)
            .join(' | ');
          csv += `"${optionsText.replace(/"/g, '""')}"\n`;
          
          if (slide.aggregatedData.notesSubmittedCount) {
            csv += `,,,,"Notes submitted: ${slide.aggregatedData.notesSubmittedCount}"\n`;
          }
        } else if (slide.questionType === 'scale' && slide.aggregatedData.averageScore !== undefined) {
          csv += `"Average: ${slide.aggregatedData.averageScore}, Range: ${slide.aggregatedData.minScore}-${slide.aggregatedData.maxScore}"\n`;
        } else {
          csv += '"No response data"\n';
        }
      }
      
      csv += '\n';
      
      // Detailed responses section
      csv += 'Detailed Participant Responses\n';
      csv += 'Participant,Email,Question,Answer,Notes,Timestamp\n';
      
      for (const response of responses) {
        const answer = response.responseType === 'scale' 
          ? response.scaleValue?.toString() || 'N/A'
          : response.selectedOptionText || 'N/A';
        
        csv += `"${response.participantName.replace(/"/g, '""')}",`;
        csv += `"${(response.participantEmail || 'N/A').replace(/"/g, '""')}",`;
        csv += `"${response.slideTitle.replace(/"/g, '""')}",`;
        csv += `"${answer.replace(/"/g, '""')}",`;
        csv += `"${(response.notes || '').replace(/"/g, '""')}",`;
        csv += `"${new Date(response.answeredAt).toLocaleString()}"\n`;
      }
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="wine-tasting-session-${sessionId}-analytics.csv"`);
      res.send(csv);
      
    } catch (error) {
      console.error("Error exporting session analytics:", error);
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({ message: "Session not found" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get participant by ID
  app.get("/api/participants/:participantId", async (req, res) => {
    try {
      const { participantId } = req.params;
      
      // Validate participantId
      if (!participantId || participantId === 'undefined' || participantId === 'null') {
        return res.status(400).json({ message: "Invalid participant ID" });
      }
      
      const participant = await storage.getParticipantById(participantId);
      
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      res.json(participant);
    } catch (error) {
      console.error("Error fetching participant:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get glossary terms
  app.get("/api/glossary", async (_req, res) => {
    try {
      const terms = await storage.getGlossaryTerms();
      res.json(terms);
    } catch (error) {
      console.error("Error fetching glossary:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/wine-characteristics", async (_req, res) => {
    try {
      const characteristics = await storage.getWineCharacteristics();
      res.json(characteristics);
    } catch (error) {
      console.error("Error fetching wine characteristics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create package with server-generated code
  app.post("/api/packages", async (req, res) => {
    try {
      const { name, description, imageUrl } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Package name is required" });
      }

      // Generate a unique code on the server
      const uniqueCode = await storage.generateUniqueShortCode(6);

      const pkg = await storage.createPackage({
        code: uniqueCode,
        name,
        description,
        imageUrl: imageUrl || "", // Include image URL if provided
      });

      res.status(201).json(pkg); // Use 201 Created for successful creation
    } catch (error) {
      console.error("Error creating package:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create or update package intro slide
  app.post("/api/packages/:packageId/intro", async (req, res) => {
    try {
      const { packageId } = req.params;
      const { title, description, imageUrl } = req.body;

      // Get package details
      const pkg = await storage.getPackageById(packageId);
      if (!pkg) {
        return res.status(404).json({ message: "Package not found" });
      }

      // Check if package intro already exists at package level
      const existingPackageSlides = await storage.getSlidesByPackageId(packageId);
      const existingIntro = existingPackageSlides.find(s => (s.payloadJson as any)?.is_package_intro === true);

      if (existingIntro) {
        // Update existing intro
        const updatedSlide = await storage.updateSlide(existingIntro.id, {
          payloadJson: {
            ...(existingIntro.payloadJson as any),
            title: title || `Welcome to ${pkg.name}`,
            description: description || 'You are about to embark on a journey through exceptional wines.',
            package_name: pkg.name,
            package_image: imageUrl || pkg.imageUrl || (existingIntro.payloadJson as any).package_image,
            background_image: imageUrl || pkg.imageUrl || (existingIntro.payloadJson as any).background_image,
            is_package_intro: true
          }
        });
        res.json({ slide: updatedSlide, action: 'updated' });
      } else {
        // Create new intro slide at package level using createPackageSlide
        const introSlide = await storage.createPackageSlide({
          packageId: packageId,
          position: 0, // Always first
          type: 'interlude',
          section_type: 'intro',
          payloadJson: {
            title: title || `Welcome to ${pkg.name}`,
            description: description || 'You are about to embark on a journey through exceptional wines.',
            is_package_intro: true,
            package_name: pkg.name,
            package_image: imageUrl || pkg.imageUrl,
            background_image: imageUrl || pkg.imageUrl || "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800&h=600&fit=crop"
          }
        });
        res.json({ slide: introSlide, action: 'created' });
      }
    } catch (error) {
      console.error("Error managing package intro:", error);
      res.status(500).json({ message: "Failed to manage package intro" });
    }
  });

  // Mock profile endpoints removed -- no client references, returned hardcoded data

  // Slide templates endpoint
  app.get("/api/slide-templates", async (req, res) => {
    try {
      // Return slide templates from our predefined list
      const slideTemplates = [
        { id: 'visual-assessment', name: 'Visual Assessment', type: 'question', sectionType: 'intro' },
        { id: 'aroma-intensity', name: 'Aroma Intensity', type: 'question', sectionType: 'deep_dive' },
        { id: 'tasting-notes', name: 'Tasting Notes', type: 'question', sectionType: 'deep_dive' },
        { id: 'body-assessment', name: 'Body Assessment', type: 'question', sectionType: 'deep_dive' },
        { id: 'tannin-level', name: 'Tannin Level', type: 'question', sectionType: 'deep_dive' },
        { id: 'acidity-level', name: 'Acidity Level', type: 'question', sectionType: 'deep_dive' },
        { id: 'finish-length', name: 'Finish Length', type: 'question', sectionType: 'ending' },
        { id: 'overall-impression', name: 'Overall Impression', type: 'question', sectionType: 'ending' }
      ];
      res.json(slideTemplates);
    } catch (error) {
      console.error("Error fetching slide templates:", error);
      res.status(500).json({ message: "Failed to fetch slide templates" });
    }
  });

  // Duplicate slides from one wine to another
  app.post("/api/wines/:wineId/duplicate-slides", async (req: Request, res: Response) => {
    try {
      const { wineId } = req.params;
      const { targetWineId, replaceExisting } = req.body;

      if (!targetWineId) {
        return res.status(400).json({ error: "Target wine ID is required" });
      }

      if (wineId === targetWineId) {
        return res.status(400).json({ error: "Source and target wines cannot be the same" });
      }

      const result = await storage.duplicateWineSlides(
        wineId, 
        targetWineId, 
        Boolean(replaceExisting)
      );

      res.json({
        success: true,
        duplicatedCount: result.count,
        targetWineId,
        message: `Successfully duplicated ${result.count} slides`
      });
    } catch (error) {
      console.error("Error duplicating wine slides:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to duplicate slides" 
      });
    }
  });

  // Package management endpoints for sommelier dashboard
  app.get("/api/packages", async (req, res) => {
    try {
      const packages = await storage.getAllPackagesWithWines();
      res.json(packages);
    } catch (error) {
      console.error("Error fetching packages:", error);
      res.status(500).json({ message: "Failed to fetch packages" });
    }
  });



  app.patch("/api/packages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedPackage = await storage.updatePackage(id, updateData);
      res.json(updatedPackage);
    } catch (error) {
      console.error("Error updating package:", error);
      res.status(500).json({ message: "Failed to update package" });
    }
  });

  app.delete("/api/packages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackage(id);
      res.json({ message: "Package deleted successfully" });
    } catch (error) {
      console.error("Error deleting package:", error);
      res.status(500).json({ message: "Failed to delete package" });
    }
  });

  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:sessionId/participants", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const participants = await storage.getParticipantsBySessionId(sessionId);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching session participants:", error);
      res.status(500).json({ message: "Failed to fetch session participants" });
    }
  });

  // Duplicate GET /api/packages/:packageId/wines removed -- already registered at line 566

  app.post("/api/packages/:packageId/wines", async (req, res) => {
    try {
      const { packageId } = req.params;
      const wineData = { ...req.body, packageId };
      const newWine = await storage.createPackageWineFromDashboard(wineData);
      res.json(newWine);
    } catch (error) {
      console.error("Error creating wine:", error);
      res.status(500).json({ message: "Failed to create wine" });
    }
  });

  app.patch("/api/packages/:packageId/wines/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedWine = await storage.updatePackageWine(id, updateData);
      res.json(updatedWine);
    } catch (error) {
      console.error("Error updating wine:", error);
      res.status(500).json({ message: "Failed to update wine" });
    }
  });

  app.delete("/api/packages/:packageId/wines/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackageWine(id);
      res.json({ message: "Wine deleted successfully" });
    } catch (error) {
      console.error("Error deleting wine:", error);
      res.status(500).json({ message: "Failed to delete wine" });
    }
  });

  // Slides management endpoints
  app.get("/api/packages/:packageId/wines/:wineId/slides", async (req, res) => {
    try {
      const { wineId } = req.params;
      const slides = await storage.getSlidesByPackageWineId(wineId);
      res.json(slides);
    } catch (error) {
      console.error("Error fetching slides:", error);
      res.status(500).json({ message: "Failed to fetch slides" });
    }
  });

  app.post("/api/packages/:packageId/wines/:wineId/slides", async (req, res) => {
    try {
      const { wineId } = req.params;
      const slideData = { ...req.body, packageWineId: wineId };
      const newSlide = await storage.createSlide(slideData);
      res.json(newSlide);
    } catch (error) {
      console.error("Error creating slide:", error);
      res.status(500).json({ message: "Failed to create slide" });
    }
  });

  // Direct slide management endpoints for slide editor
  app.get("/api/slides/:packageWineId", async (req, res) => {
    try {
      const { packageWineId } = req.params;
      const slides = await storage.getSlidesByPackageWineId(packageWineId);
      res.json(slides);
    } catch (error) {
      console.error("Error fetching slides:", error);
      res.status(500).json({ error: "Failed to fetch slides" });
    }
  });

  app.post("/api/slides", async (req, res) => {
    try {
      const validatedData = insertSlideSchema.parse(req.body);
      const slide = await storage.createSlide(validatedData);
      res.json({ slide });
    } catch (error: any) {
      console.error("Error creating slide:", error);
      
      // Provide specific error messages based on error type
      if (error.message?.includes('Cannot create slide with invalid or empty payload')) {
        return res.status(400).json({ 
          error: "Invalid slide configuration",
          message: "Slide must have valid content. Please check your slide settings and try again.",
          details: error.message
        });
      }
      
      if (error.message?.includes('createSlide requires packageWineId')) {
        return res.status(400).json({ 
          error: "Missing wine context",
          message: "This slide must be associated with a specific wine. Please select a wine first.",
          details: error.message
        });
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid slide data",
          message: "The slide data format is incorrect. Please check all required fields.",
          details: error.errors || error.message
        });
      }
      
      // Generic fallback
      res.status(500).json({ 
        error: "Failed to create slide",
        message: "An unexpected error occurred while creating the slide. Please try again.",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.patch("/api/slides/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const slide = await storage.updateSlide(id, req.body);
      
      res.json({ slide });
    } catch (error) {
      console.error("❌ API: Error updating slide:", {
        slideId: req.params.id,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        requestBody: req.body,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ error: "Failed to update slide" });
    }
  });

  app.delete("/api/slides/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSlide(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting slide:", error);
      res.status(500).json({ error: "Failed to delete slide" });
    }
  });

  // Update single slide position - using fractional indexing
  app.put("/api/slides/:slideId/position", async (req, res) => {
    try {
      const { slideId } = req.params;
      const { newPosition } = req.body;
      
      // Validate inputs
      if (!slideId) {
        return res.status(400).json({ message: "Invalid slideId" });
      }
      
      if (typeof newPosition !== 'number' || newPosition < 0) {
        console.error(`❌ Invalid position value:`, { newPosition, type: typeof newPosition });
        return res.status(400).json({ message: "Position must be a positive number" });
      }
      
      console.log(`🎯 Updating slide ${slideId} to position ${newPosition}`);
      
      // Use the new simple storage method
      await storage.updateSlidePosition(slideId, newPosition);
      
      console.log(`✅ Successfully updated slide position`);
      res.json({ message: "Slide position updated successfully", slideId, newPosition });
    } catch (error: any) {
      console.error("❌ Failed to update slide position:", {
        error: error.message,
        slideId: req.params.slideId,
        newPosition: req.body.newPosition,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({ 
        message: "Failed to update slide position",
        error: 'Internal server error'
      });
    }
  });

  // NEW: Endpoint for the slide editor to get all package data
  app.get("/api/packages/:code/editor", async (req, res) => {
    try {
      const { code } = req.params;
      const data = await storage.getPackageWithWinesAndSlides(code);
      if (!data) {
        return res.status(404).json({ message: "Package not found" });
      }
      res.json(data);
    } catch (error) {
      console.error("Error fetching package editor data:", error);
      res.status(500).json({ error: "Failed to fetch package data" });
    }
  });


  // Position Recovery and Smart Reordering Endpoints
  
  // Detect and fix slides stuck at temporary positions
  app.post("/api/slides/recover-positions", async (req, res) => {
    try {
      console.log('🔧 Position recovery endpoint called');
      const result = await storage.performPositionRecovery();
      
      if (result.recovered) {
        res.json({ 
          success: true, 
          message: "Position recovery completed successfully",
          details: result.details
        });
      } else {
        res.json({ 
          success: true, 
          message: "No position issues found",
          details: result.details
        });
      }
    } catch (error: any) {
      console.error("Error in position recovery:", error);
      res.status(500).json({ 
        success: false,
        message: "Position recovery failed", 
        error: 'Internal server error'
      });
    }
  });

  // Smart swap two slides (for adjacent moves)
  app.post("/api/slides/smart-swap", async (req, res) => {
    try {
      const { slideId1, slideId2 } = req.body;
      
      if (!slideId1 || !slideId2) {
        return res.status(400).json({ 
          message: "Both slideId1 and slideId2 are required" 
        });
      }
      
      await storage.smartSwapSlides(slideId1, slideId2);
      res.json({ 
        success: true, 
        message: "Slides swapped successfully" 
      });
    } catch (error: any) {
      console.error("Error in smart swap:", error);
      res.status(500).json({ 
        success: false,
        message: "Smart swap failed", 
        error: 'Internal server error'
      });
    }
  });

  // Direct position assignment (for quick repositioning)
  app.post("/api/slides/assign-position", async (req, res) => {
    try {
      const { slideId, targetPosition, packageWineId } = req.body;
      
      if (!slideId || typeof targetPosition !== 'number') {
        return res.status(400).json({ 
          message: "slideId and targetPosition are required" 
        });
      }
      
      await storage.assignSlidePosition(slideId, targetPosition, packageWineId);
      res.json({ 
        success: true, 
        message: "Slide position assigned successfully" 
      });
    } catch (error: any) {
      console.error("Error in position assignment:", error);
      res.status(500).json({ 
        success: false,
        message: "Position assignment failed", 
        error: 'Internal server error'
      });
    }
  });

  // Batch update slide positions
  app.post("/api/slides/batch-update-positions", async (req, res) => {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ 
          message: "Updates array is required" 
        });
      }
      
      // Validate all updates
      for (const update of updates) {
        if (!update.slideId || typeof update.position !== 'number') {
          return res.status(400).json({ 
            message: "Each update must have slideId and position" 
          });
        }
        // section_type is optional for section changes
      }
      
      await storage.batchUpdateSlidePositions(updates);
      res.json({ 
        success: true, 
        message: `${updates.length} slide positions updated successfully` 
      });
    } catch (error: any) {
      console.error("Error in batch position update:", error);
      res.status(500).json({ 
        success: false,
        message: "Batch position update failed", 
        error: 'Internal server error'
      });
    }
  });

  // /api/packages-with-wines removed -- duplicate of /api/packages

  // Modern wine management endpoints
  app.post("/api/wines", async (req, res) => {
    try {
      const validatedData = insertPackageWineSchema.parse(req.body);
      const wine = await storage.createPackageWineFromDashboard(validatedData);
      res.json({ wine });
    } catch (error) {
      console.error("Error creating wine:", error);
      res.status(500).json({ error: "Failed to create wine" });
    }
  });

  app.patch("/api/wines/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const wine = await storage.updatePackageWine(id, req.body);
      res.json({ wine });
    } catch (error) {
      console.error("Error updating wine:", error);
      res.status(500).json({ error: "Failed to update wine" });
    }
  });

  app.delete("/api/wines/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePackageWine(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting wine:", error);
      res.status(500).json({ error: "Failed to delete wine" });
    }
  });

  // Legacy /api/package-wines endpoints removed -- use /api/wines instead

  // Analytics overview endpoint removed -- was never called by any client code
  // and had N+1 query issues (200+ queries at 100 sessions)

  // Comprehensive media upload endpoint supporting all image formats up to 10MB
  console.log("📁 Registering comprehensive media upload endpoints...");
  
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const { mimetype, buffer, originalname, size } = req.file;
      
      // No file size restrictions - allow unlimited size for all media types

      // Check if Supabase is configured for production uploads
      if (!isSupabaseConfigured()) {
        // For local development, return a base64 data URL
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimetype};base64,${base64}`;
        return res.json({ 
          url: dataUrl,
          message: "File processed locally (Supabase not configured)",
          filename: originalname,
          size: size,
          type: mimetype
        });
      }

      // For production uploads with Supabase
      const { entityId, entityType } = req.body; // slide ID, wine ID, or package ID

      // Validate entityType
      if (!entityType || !['slide', 'wine', 'package'].includes(entityType)) {
        return res.status(400).json({ message: "Valid entity type (slide, wine, or package) is required" });
      }

      // Check if entityId is a temporary ID (not a valid UUID)
      const isTemporaryId = entityId && !entityId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // For temporary IDs or missing IDs, we'll store NULL in entity_id and keep the temp ID in metadata
      const dbEntityId = (!entityId || isTemporaryId) ? null : entityId;
      const originalEntityId = entityId || `${entityType}-temp-${Date.now()}`;

      // Validate file type
      let mediaType = getMediaType(mimetype);
      
      // Fallback for M4A files with non-standard MIME types
      if (!mediaType && originalname.toLowerCase().endsWith('.m4a')) {
        console.log(`M4A file detected with MIME type: ${mimetype}, treating as audio`);
        mediaType = 'audio';
      }
      
      if (!mediaType) {
        return res.status(400).json({ 
          message: `Unsupported file type: ${mimetype} (file: ${originalname}). Supported types: images (JPEG, PNG, WebP, GIF, AVIF, HEIC, etc.), audio (MP3, M4A, WAV, AAC, OGG, WebM), video (MP4, WebM, MOV)` 
        });
      }

      // Upload to Supabase Storage
      const storageUrl = await uploadMediaFile(buffer, originalname, mimetype, originalEntityId);
      
      // Generate unique public ID
      const publicId = await storage.generateUniqueMediaPublicId();
      
      // Create media record in database with error recovery
      let mediaRecord;
      try {
        mediaRecord = await storage.createMedia({
          publicId,
          sommelierId: null, // TODO: Add when auth is implemented
          entityType: entityType as 'slide' | 'wine' | 'package',
          entityId: dbEntityId, // NULL for temporary IDs
          mediaType: mediaType as 'video' | 'audio' | 'image',
          fileName: originalname,
          mimeType: mimetype,
          fileSize: buffer.length,
          storageUrl,
          thumbnailUrl: null, // TODO: Generate thumbnails for images/videos
          duration: null, // TODO: Extract duration for audio/video
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalEntityId: originalEntityId, // Store temp ID here for later reference
            isTemporary: isTemporaryId || !entityId
          },
          isPublic: true // Files are uploaded to public bucket, so mark as public
        });
      } catch (dbError: any) {
        // Check if error is due to missing media table
        if (dbError.message?.includes('relation "media" does not exist')) {
          console.error('[MEDIA_UPLOAD] CRITICAL ERROR: Media table does not exist!');
          console.error('[MEDIA_UPLOAD] Run "npm run db:push" to create the media table');
          
          // Return a helpful error response
          return res.status(500).json({
            message: "Database schema is out of sync. Media table is missing.",
            error: "Please contact your administrator to run database migrations.",
            technicalDetails: "Run 'npm run db:push' to apply migrations"
          });
        }
        
        // Re-throw other database errors
        throw dbError;
      }

      res.json({
        publicId: mediaRecord.publicId,
        accessUrl: `/api/media/${mediaRecord.publicId}/stream`,
        mediaType,
        fileName: originalname,
        fileSize: buffer.length
      });
    } catch (error) {
      // Detailed error logging
      console.error("Media upload failed:", {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        requestDetails: {
          fileName: req.file?.originalname,
          fileSize: req.file?.size,
          mimeType: req.file?.mimetype,
          entityId: req.body?.entityId,
          entityType: req.body?.entityType
        },
        timestamp: new Date().toISOString()
      });
      
      // Determine appropriate status code and message
      let statusCode = 500;
      let errorMessage = "Failed to upload media";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Map specific errors to appropriate status codes
        if (error.message.includes('bucket') || error.message.includes('not found')) {
          statusCode = 503; // Service unavailable
          errorMessage = "Storage service is not properly configured. Please contact support.";
        } else if (error.message.includes('access denied') || error.message.includes('RLS')) {
          statusCode = 403; // Forbidden
          errorMessage = "Storage access denied. Please check your permissions.";
        } else if (error.message.includes('size')) {
          statusCode = 413; // Payload too large
        } else if (error.message.includes('Unsupported')) {
          statusCode = 415; // Unsupported media type
        }
      }
      
      res.status(statusCode).json({ 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      });
    }
  });

  app.delete("/api/upload/media", async (req, res) => {
    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        return res.status(503).json({ 
          message: "Media deletion is not available. Supabase Storage is not configured." 
        });
      }

      const { fileUrl } = req.body;
      
      if (!fileUrl) {
        return res.status(400).json({ message: "File URL is required" });
      }

      await deleteMediaFile(fileUrl);
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      // Detailed error logging for delete operations
      console.error("Media deletion failed:", {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        fileUrl: req.body?.fileUrl,
        timestamp: new Date().toISOString()
      });
      
      // Don't fail if file is already deleted
      if (error instanceof Error && error.message.includes('not found')) {
        res.json({ message: "File deleted successfully (or already deleted)" });
      } else {
        res.status(500).json({ 
          message: error instanceof Error ? error.message : "Failed to delete media",
          error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
        });
      }
    }
  });

  // Register auth routes (solo tasting)
  registerAuthRoutes(app);

  // Register solo tasting routes
  registerTastingsRoutes(app);

  // Register wine recognition & intelligence routes
  registerWinesRoutes(app);

  // Register dashboard routes
  registerDashboardRoutes(app);


  // Register sommelier chat routes
  registerSommelierChatRoutes(app);

  // Register media proxy routes
  registerMediaProxyRoutes(app);

  // Register user routes (onboarding)
  registerUserRoutes(app);

  console.log("✅ All routes registered successfully!");
  const httpServer = createServer(app);
  return httpServer;
}
