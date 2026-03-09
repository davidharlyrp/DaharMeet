import { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoTile } from '@/components/VideoTile';
import { MeetingControls } from '@/components/MeetingControls';
import { ChatPanel } from '@/components/ChatPanel';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { getMeeting } from '@/lib/api';
import type { Participant, Message } from '@/types';
import { toast } from 'sonner';

export function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { passcode, userName } = location.state || {};
  const [meetingName, setMeetingName] = useState<string>('');

  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [screenSharer, setScreenSharer] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);

  // Handle user joined
  const handleUserJoined = useCallback((userId: string, name: string, participant: Participant) => {
    setParticipants(prev => ({ ...prev, [userId]: participant }));
    toast.info(`${name} joined the meeting`);

    // Create offer for new user
    if (userId !== currentUserId) {
      webRTC.createOffer(userId);
    }
  }, [currentUserId]);

  // Handle user left
  const handleUserLeft = useCallback((userId: string, name: string) => {
    setParticipants(prev => {
      const newParticipants = { ...prev };
      delete newParticipants[userId];
      return newParticipants;
    });
    webRTC.removePeer(userId);
    toast.info(`${name} left the meeting`);
  }, []);

  // Handle offer
  const handleOffer = useCallback((senderId: string, _senderName: string, offer: RTCSessionDescriptionInit) => {
    webRTC.handleOffer(senderId, offer);
  }, []);

  // Handle answer
  const handleAnswer = useCallback((senderId: string, answer: RTCSessionDescriptionInit) => {
    webRTC.handleAnswer(senderId, answer);
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback((senderId: string, candidate: RTCIceCandidateInit) => {
    webRTC.handleIceCandidate(senderId, candidate);
  }, []);

  // Handle media state changed
  const handleMediaStateChanged = useCallback((userId: string, isMicOn: boolean, isCamOn: boolean) => {
    setParticipants(prev => {
      if (prev[userId]) {
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            isMicOn,
            isCamOn
          }
        };
      }
      return prev;
    });
  }, []);

  // Handle screen share started
  const handleScreenShareStarted = useCallback((userId: string, userName: string) => {
    setScreenSharer(userId);
    toast.info(`${userName} started sharing their screen`);
  }, []);

  // Handle screen share stopped
  const handleScreenShareStopped = useCallback((userId: string) => {
    setScreenSharer(prev => prev === userId ? null : prev);
  }, []);

  // Handle new message
  const handleNewMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const socket = useSocket({
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onOffer: handleOffer,
    onAnswer: handleAnswer,
    onIceCandidate: handleIceCandidate,
    onMediaStateChanged: handleMediaStateChanged,
    onScreenShareStarted: handleScreenShareStarted,
    onScreenShareStopped: handleScreenShareStopped,
    onNewMessage: handleNewMessage
  });

  const webRTC = useWebRTC({
    onOffer: socket.sendOffer,
    onAnswer: socket.sendAnswer,
    onIceCandidate: socket.sendIceCandidate
  });

  // Join meeting on mount
  useEffect(() => {
    if (!passcode || !userName) {
      navigate('/');
      return;
    }

    const join = async () => {
      // Fetch meeting info to get the name
      const meetingInfo = await getMeeting(meetingId!);
      if (meetingInfo.success && meetingInfo.meeting) {
        setMeetingName(meetingInfo.meeting.meetingName);
      }

      // Initialize media first
      await webRTC.initializeMedia(true, true);

      // Join via socket
      const response = await socket.joinMeeting(meetingId!, passcode, userName);

      if (response.success && response.userId) {
        setCurrentUserId(response.userId);
        setParticipants(response.participants || {});
        setMessages(response.messages || []);
        setScreenSharer(response.screenSharer || null);
        setIsJoined(true);

        // Create offers for existing participants
        if (response.participants) {
          Object.keys(response.participants).forEach(peerId => {
            if (peerId !== response.userId) {
              webRTC.createOffer(peerId);
            }
          });
        }

        toast.success('Joined meeting successfully');
      } else {
        toast.error(response.error || 'Failed to join meeting');
        navigate('/');
      }
    };

    join();

    return () => {
      webRTC.cleanup();
    };
  }, []);

  // Update media state to others
  useEffect(() => {
    if (isJoined) {
      socket.updateMediaState(webRTC.isMicOn, webRTC.isCamOn);
    }
  }, [webRTC.isMicOn, webRTC.isCamOn, isJoined]);

  // Handle toggle mic
  const handleToggleMic = () => {
    webRTC.toggleMic();
  };

  // Handle toggle cam
  const handleToggleCam = () => {
    webRTC.toggleCam();
  };

  // Handle toggle screen share
  const handleToggleScreenShare = async () => {
    if (webRTC.isScreenSharing) {
      webRTC.stopScreenShare();
      socket.stopScreenShare();
    } else {
      const response = await socket.requestScreenShare();
      if (response.success) {
        const stream = await webRTC.startScreenShare();
        if (stream) {
          toast.success('Screen sharing started');
        } else {
          toast.error('Failed to start screen sharing');
        }
      } else {
        toast.error(response.error || 'Cannot share screen');
      }
    }
  };

  // Handle send message
  const handleSendMessage = (text: string) => {
    socket.sendMessage(text);
  };

  // Handle leave
  const handleLeave = () => {
    webRTC.cleanup();
    navigate('/');
  };

  // Get screen share stream
  const getScreenShareStream = () => {
    if (screenSharer === currentUserId) {
      return webRTC.screenStream;
    }
    // Find screen share stream from remote
    if (screenSharer) {
      return webRTC.remoteStreams.get(screenSharer) || null;
    }
    return null;
  };

  const screenShareStream = getScreenShareStream();
  const isAnyoneScreenSharing = screenSharer !== null;
  const canShareScreen = !isAnyoneScreenSharing || webRTC.isScreenSharing;

  // Filter video streams (exclude screen share)
  const videoStreams = Array.from(webRTC.remoteStreams.entries()).filter(
    ([peerId]) => peerId !== screenSharer
  );

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white">Joining meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-neutral-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">Meeting ID: {meetingId}</span>
          <div className='h-6 w-0.5 bg-white' />
          <span className="text-white font-medium">Passcode: {passcode}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{meetingName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neutral-400 text-sm">
            {Object.keys(participants).length} participants
          </span>
          {isAnyoneScreenSharing && (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              Screen sharing
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex">
          {/* Screen Share / Main Video */}
          <div className={`${isAnyoneScreenSharing ? 'flex-[2]' : 'flex-1'} bg-neutral-900 p-4`}>
            {isAnyoneScreenSharing && screenShareStream ? (
              <VideoTile
                stream={screenShareStream}
                userName={screenSharer === currentUserId ? 'Your Screen' : participants[screenSharer!]?.name + "'s Screen"}
                isMicOn={false}
                isCamOn={true}
                isScreenShare={true}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-neutral-700 flex items-center justify-center mx-auto">
                    <span className="text-4xl font-medium text-neutral-400">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white text-lg">{userName} (You)</p>
                  <p className="text-neutral-400 text-sm">Waiting for others to join...</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Grid */}
          <div className="w-80 bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto">
            {/* Local video */}
            <div className="mb-4">
              <VideoTile
                stream={webRTC.localStream}
                userName={userName}
                isMicOn={webRTC.isMicOn}
                isCamOn={webRTC.isCamOn}
                isLocal={true}
                className="w-full aspect-video"
              />
            </div>

            {/* Remote videos */}
            <div className="space-y-4">
              {videoStreams.map(([peerId, stream]) => (
                <VideoTile
                  key={peerId}
                  stream={stream}
                  userName={participants[peerId]?.name || 'Unknown'}
                  isMicOn={participants[peerId]?.isMicOn || false}
                  isCamOn={participants[peerId]?.isCamOn || false}
                  className="w-full aspect-video"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Side Panels */}
        {showChat && (
          <ChatPanel
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={handleSendMessage}
          />
        )}

        {showParticipants && (
          <ParticipantsPanel
            participants={participants}
            currentUserId={currentUserId}
            screenSharer={screenSharer}
          />
        )}
      </div>

      {/* Controls */}
      <MeetingControls
        isMicOn={webRTC.isMicOn}
        isCamOn={webRTC.isCamOn}
        isScreenSharing={webRTC.isScreenSharing}
        canShareScreen={canShareScreen}
        showChat={showChat}
        showParticipants={showParticipants}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleChat={() => {
          setShowChat(!showChat);
          setShowParticipants(false);
        }}
        onToggleParticipants={() => {
          setShowParticipants(!showParticipants);
          setShowChat(false);
        }}
        onLeave={handleLeave}
      />
    </div>
  );
}
