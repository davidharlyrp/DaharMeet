import { Mic, MicOff, Video, VideoOff, Monitor } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Participant } from '@/types';

interface ParticipantsPanelProps {
  participants: Record<string, Participant>;
  currentUserId: string;
  screenSharer: string | null;
}

export function ParticipantsPanel({ participants, currentUserId, screenSharer }: ParticipantsPanelProps) {
  const participantList = Object.values(participants);
  
  return (
    <div className="w-72 bg-neutral-900 border-l border-neutral-800 flex flex-col">
      <div className="h-12 border-b border-neutral-800 flex items-center px-4">
        <h3 className="font-medium text-white">Participants ({participantList.length})</h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {participantList.map((participant) => {
            const isCurrentUser = participant.id === currentUserId;
            const isScreenSharing = participant.id === screenSharer;
            
            return (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 hover:bg-neutral-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-neutral-700 flex items-center justify-center">
                    <span className="text-sm font-medium text-neutral-300">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-white">
                      {participant.name} {isCurrentUser && '(You)'}
                    </span>
                    {isScreenSharing && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <Monitor className="w-3 h-3" />
                        Sharing screen
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {participant.isMicOn ? (
                    <Mic className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <MicOff className="w-4 h-4 text-red-400" />
                  )}
                  {participant.isCamOn ? (
                    <Video className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <VideoOff className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
