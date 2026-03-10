import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config"; // Assuming vite.config.ts is at the project root
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const, // Fix type issue
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false, // configFile is already loaded via import viteConfig from "../vite.config";
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Consider if process.exit(1) is too aggressive for all dev errors
        // process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Serve React app for all non-API routes to support client-side routing
  app.use(/^(?!\/api\/).*/, async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname, // Current directory (server/)
        "..", // Up to project root
        "client", // Into client/
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      // Cache-busting for /src/main.tsx in dev mode
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Correctly points to <project_root>/dist/public/
  const distPath = path.resolve(import.meta.dirname, "..", "dist/public");

  if (!fs.existsSync(distPath)) {
    const errorMsg = `Production build directory not found at: ${distPath}. Make sure to run 'npm run build' first.`;
    console.error(`[Express ERROR] ${errorMsg}`);
    // In a production scenario, you might want the server to fail hard if assets are missing.
    // Or, serve a minimal maintenance page, but throwing ensures the problem is noticed.
    throw new Error(errorMsg);
  }
  log(`Serving static files from: ${distPath}`, "Express");

  // Serve static assets from dist/public
  // Explicitly set Content-Type for JS/CSS to be absolutely sure.
  app.use(
    express.static(distPath, {
      index: false, // We'll handle SPA fallback manually
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript");
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css");
        }
      },
    }),
  );

  // SPA Fallback: Serve index.html for valid client-side routes
  // This should come after API routes and static asset serving.
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    // If the request is for an API endpoint, pass it to the next handler (likely your API router)
    if (req.path.startsWith("/api/")) {
      return next();
    }

    // If the request looks like it's for a static file (e.g., contains a common file extension)
    // but wasn't found by express.static, it should 404.
    // This prevents serving index.html for missing images, scripts, etc.
    // Common asset extensions:
    const assetExtensions =
      /\.(js|css|json|webmanifest|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|otf|map)$/i;
    if (assetExtensions.test(req.path)) {
      // Let it fall through to Express's default 404 handler or any subsequent error handlers
      return next();
    }

    // For all other GET requests (assumed to be client-side routes), serve the main HTML file.
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // This case should ideally not happen if your build is correct and index.html is in distPath
      log(`[Express ERROR] Main index.html not found at: ${indexPath}`);
      res
        .status(500)
        .send("Application critical error: Main HTML file not found.");
    }
  });
}
