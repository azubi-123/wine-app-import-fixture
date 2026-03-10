import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth";
import { getWineCharacteristics, isWineIntelligenceAvailable } from "../wine-intelligence";
import { recognizeWineFromImage, isRecognitionAvailable } from "../services/wineRecognitionService";
import multer from "multer";

// Configure multer for file uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Register wine-related routes
 */
export function registerWinesRoutes(app: Express): void {

  /**
   * Recognize wine from photo using GPT Vision
   * POST /api/solo/wines/recognize
   */
  app.post("/api/solo/wines/recognize", requireAuth, upload.single('image'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          recognized: false,
          error: "No image provided"
        });
      }

      const result = await recognizeWineFromImage(file.buffer, file.mimetype, file.originalname);

      if (!result.recognized) {
        return res.status(result.error?.includes('not available') ? 503 : 200).json(result);
      }

      return res.json(result);

    } catch (error) {
      console.error("[Wine Recognition] Error:", error);
      return res.json({
        recognized: false,
        error: "Failed to process image"
      });
    }
  });

  /**
   * Get wine characteristics (typical profile for this wine)
   * POST /api/solo/wines/characteristics
   */
  app.post("/api/solo/wines/characteristics", requireAuth, async (req: Request, res: Response) => {
    try {
      const { wineName, wineRegion, grapeVariety, wineType } = req.body;

      if (!wineName) {
        return res.status(400).json({ error: "Wine name is required" });
      }

      if (!isWineIntelligenceAvailable()) {
        return res.status(503).json({
          error: "Wine intelligence is not available (OpenAI not configured)"
        });
      }

      const characteristics = await getWineCharacteristics(
        wineName,
        wineRegion,
        grapeVariety,
        wineType
      );

      if (!characteristics) {
        return res.json({
          found: false,
          message: "Could not determine characteristics for this wine"
        });
      }

      return res.json({
        found: true,
        characteristics,
        message: characteristics.source === 'cache'
          ? "Retrieved from cache"
          : "Fetched wine profile"
      });

    } catch (error) {
      console.error("[Wine Characteristics] Error:", error);
      return res.status(500).json({ error: "Failed to get wine characteristics" });
    }
  });

  /**
   * Check wine intelligence availability
   * GET /api/solo/wines/status
   */
  app.get("/api/solo/wines/status", async (req: Request, res: Response) => {
    return res.json({
      recognitionAvailable: isRecognitionAvailable(),
      characteristicsAvailable: isWineIntelligenceAvailable()
    });
  });
}
