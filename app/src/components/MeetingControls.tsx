import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PhoneOff, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  canShareScreen: boolean;
  showChat: boolean;
  showParticipants: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
}

export function MeetingControls({
  isMicOn,
  isCamOn,
  isScreenSharing,
  canShareScreen,
  showChat,
  showParticipants,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
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
      
      {/* Center - Screen share & Leave */}
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
          variant="destructive"
          size="icon"
          onClick={onLeave}
          className="rounded-none bg-red-600 hover:bg-red-700"
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Right - Panel toggles */}
      <div className="flex items-center gap-2">
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
