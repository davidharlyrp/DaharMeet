import { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  userName: string;
  isMicOn: boolean;
  isCamOn: boolean;
  isLocal?: boolean;
  isScreenShare?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  userName,
  isMicOn,
  isCamOn,
  isLocal = false,
  isScreenShare = false,
  className = ''
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-neutral-900 overflow-hidden ${className}`}>
      {((isCamOn || isScreenShare) && stream) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-contain ${isLocal && !isScreenShare ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
          <div className="w-16 h-16 rounded-full bg-neutral-700 flex items-center justify-center">
            <span className="text-xl font-medium text-neutral-400">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* User info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            {userName} {isLocal && '(You)'}
          </span>
          <div className="flex items-center gap-2">
            {isMicOn ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <MicOff className="w-4 h-4 text-red-400" />
            )}
            {isCamOn ? (
              <Video className="w-4 h-4 text-white" />
            ) : (
              <VideoOff className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      </div>

      {isScreenShare && (
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 text-xs text-white font-medium">
          Sharing Screen
        </div>
      )}
    </div>
  );
}
