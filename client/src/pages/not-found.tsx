import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-primary">
      <Card className="w-full max-w-md mx-4 bg-gradient-card backdrop-blur-xl border-white/20">
        <CardContent className="pt-6 text-center">
          <div className="flex flex-col items-center mb-6">
            <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Page Not Found</h1>
            <p className="text-white/70">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <Link href="/">
            <Button className="w-full bg-gradient-button text-white font-semibold py-3">
              <Home className="mr-2" size={16} />
              Return Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
