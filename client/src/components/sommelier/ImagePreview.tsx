import { X } from "lucide-react";

interface ImagePreviewProps {
  src: string;
  onRemove: () => void;
}

export function ImagePreview({ src, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative inline-block mb-2">
      <img
        src={src}
        alt="Preview"
        className="h-16 w-16 object-cover rounded-lg border border-zinc-700"
      />
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center hover:bg-zinc-600"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  );
}
