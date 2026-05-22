import { useState } from "react";
import { Play, Maximize, Volume2, Pause, SkipForward, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface VideoPlayerProps {
  url: string;
  thumbnail?: string;
}

export function VideoPlayer({ url, thumbnail }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Simple check for YouTube/Vimeo
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo.com");

  if (isYoutube || isVimeo) {
    let embedUrl = url;
    if (isYoutube) {
      const videoId = url.split("v=")[1]?.split("&")[0] || url.split("/").pop();
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (isVimeo) {
      const videoId = url.split("/").pop();
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  // Native Player UI Placeholder (could use a library like Plyr or React-Player for full functionality)
  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black group">
      {!isPlaying && (
        <div 
          className="absolute inset-0 z-10 flex items-center justify-center bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: thumbnail ? `url(${thumbnail})` : 'none' }}
          onClick={() => setIsPlaying(true)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative w-20 h-20 rounded-full bg-primary/20 backdrop-blur-xl flex items-center justify-center text-white border border-white/20 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <Play size={32} fill="white" />
          </div>
        </div>
      )}
      
      <video 
        src={url} 
        className="w-full h-full object-contain"
        autoPlay={isPlaying}
        controls={isPlaying}
      />
    </div>
  );
}
