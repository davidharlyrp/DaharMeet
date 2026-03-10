import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, Users, Circle, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  canShareScreen: boolean;
  isRecording: boolean;
  recordingDuration: number;
  isUploading: boolean;
  showChat: boolean;
  showParticipants: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleSettings: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export function MeetingControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  canShareScreen,
  isRecording,
  recordingDuration,
  isUploading,
  showChat,
  showParticipants,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleRecording,
  onToggleSettings,
  onToggleChat,
  onToggleParticipants,
  onLeave
}: MeetingControlsProps) {
  return (
    <div className="h-16 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between px-4">
      {/* Left - Media controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleMic}
          className={`rounded-none ${isMicOn ? 'bg-neutral-800 border-neutral-700' : 'bg-red-600 border-red-600 hover:bg-red-700'}`}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onToggleCam}
          className={`rounded-none ${isCamOn ? 'bg-neutral-800 border-neutral-700' : 'bg-red-600 border-red-600 hover:bg-red-700'}`}
        >
          {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
      </div>

      {/* Center - Screen share, Record & Leave */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleScreenShare}
          disabled={!canShareScreen && !isScreenSharing}
          className={`rounded-none ${isScreenSharing ? 'bg-green-600 border-green-600' : 'bg-neutral-800 border-neutral-700'} ${!canShareScreen && !isScreenSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </Button>

        <Button
          variant="outline"
          onClick={onToggleRecording}
          disabled={isUploading}
          className={`rounded-none gap-1.5 px-3 ${isRecording ? 'bg-red-600 border-red-600 hover:bg-red-700' : 'bg-neutral-800 border-neutral-700'} ${isUploading ? 'opacity-50' : ''}`}
        >
          <Circle className={`w-3 h-3 ${isRecording ? 'fill-white text-white animate-pulse' : 'fill-red-500 text-red-500'}`} />
          {isRecording ? (
            <span className="text-xs font-mono">{formatDuration(recordingDuration)}</span>
          ) : isUploading ? (
            <span className="text-xs">Uploading...</span>
          ) : (
            <span className="text-xs">REC</span>
          )}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          onClick={onLeave}
          className="rounded-none bg-red-600 hover:bg-red-700"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Right - Panel toggles */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleSettings}
          className="rounded-none bg-neutral-800 border-neutral-700"
        >
          <Settings className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleParticipants}
          className={`rounded-none ${showParticipants ? 'bg-neutral-700 border-neutral-600' : 'bg-neutral-800 border-neutral-700'}`}
        >
          <Users className="w-5 h-5" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onToggleChat}
          className={`rounded-none ${showChat ? 'bg-neutral-700 border-neutral-600' : 'bg-neutral-800 border-neutral-700'}`}
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
