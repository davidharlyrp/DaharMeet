import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useRecording } from '@/hooks/useRecording';
import { VideoTile } from '@/components/VideoTile';
import { MeetingControls } from '@/components/MeetingControls';
import { ChatPanel } from '@/components/ChatPanel';
import { ParticipantsPanel } from '@/components/ParticipantsPanel';
import { CameraSettingsModal } from '@/components/CameraSettingsModal';
import { getMeeting, validatePasscode } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Participant, Message, CameraSettings } from '@/types';
import { toast } from 'sonner';
import { ArrowRight, Copy, Eye, EyeOff, Users, ChevronLeft, ChevronRight } from 'lucide-react';

export function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Direct URL access: passcode/userName may come from state OR from inline form
  const statePasscode = location.state?.passcode;
  const stateUserName = location.state?.userName;

  const [meetingName, setMeetingName] = useState<string>('');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [meetingExists, setMeetingExists] = useState<boolean | null>(null); // null = checking
  const [needsAuth, setNeedsAuth] = useState(false);

  // Final credentials used for the actual meeting join
  const [passcode, setPasscode] = useState(statePasscode || '');
  const [userName, setUserName] = useState(stateUserName || '');

  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [screenSharer, setScreenSharer] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
    flipH: false,
    flipV: false,
    rotation: 0
  });
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  // Refs to avoid stale closures in callbacks
  const currentUserIdRef = useRef<string>('');
  const webRTCRef = useRef<typeof webRTC>(null!);

  // Handle user joined
  const handleUserJoined = useCallback((userId: string, name: string, participant: Participant) => {
    setParticipants(prev => ({ ...prev, [userId]: participant }));
    toast.info(`${name} joined the meeting`);

    // Create offer for new user - use ref to avoid stale closure
    if (userId !== currentUserIdRef.current && currentUserIdRef.current) {
      webRTCRef.current?.createOffer(userId);
    }
  }, []);

  // Handle user left
  const handleUserLeft = useCallback((userId: string, name: string) => {
    setParticipants(prev => {
      const newParticipants = { ...prev };
      delete newParticipants[userId];
      return newParticipants;
    });
    webRTCRef.current?.removePeer(userId);
    toast.info(`${name} left the meeting`);
  }, []);

  // Handle offer
  const handleOffer = useCallback((senderId: string, _senderName: string, offer: RTCSessionDescriptionInit) => {
    webRTCRef.current?.handleOffer(senderId, offer);
  }, []);

  // Handle answer
  const handleAnswer = useCallback((senderId: string, answer: RTCSessionDescriptionInit) => {
    webRTCRef.current?.handleAnswer(senderId, answer);
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback((senderId: string, candidate: RTCIceCandidateInit) => {
    webRTCRef.current?.handleIceCandidate(senderId, candidate);
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

  // Handle participant camera settings changed
  const handleParticipantCameraSettingsChanged = useCallback((userId: string, settings: CameraSettings) => {
    setParticipants(prev => {
      if (prev[userId]) {
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            cameraSettings: settings
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
    onNewMessage: handleNewMessage,
    onParticipantCameraSettingsChanged: handleParticipantCameraSettingsChanged
  });

  const webRTC = useWebRTC({
    onOffer: socket.sendOffer,
    onAnswer: socket.sendAnswer,
    onIceCandidate: socket.sendIceCandidate,
    onScreenShareEnded: () => {
      // Called when browser's native "Stop sharing" button is clicked
      socket.stopScreenShare();
    }
  });

  // Keep ref in sync
  useEffect(() => {
    webRTCRef.current = webRTC;
  });

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const recording = useRecording({
    localStream: webRTC.localStream,
    remoteStreams: webRTC.remoteStreams,
    meetingId: meetingId || '',
    userName,
  });

  // Initial check: if we have state auth, join immediately.
  // Otherwise, check if meeting exists.
  useEffect(() => {
    const checkMeeting = async () => {
      if (!meetingId) {
        navigate('/');
        return;
      }

      const response = await getMeeting(meetingId);
      if (response.success && response.meeting) {
        setMeetingName(response.meeting.meetingName);
        setMeetingExists(true);
        if (passcode && userName) {
          // Have credentials from location.state → Join
          joinMeetingClient(passcode, userName);
        } else {
          // Need credentials → Show form
          setNeedsAuth(true);
        }
      } else {
        setMeetingExists(false);
      }
    };

    checkMeeting();

    return () => {
      webRTC.cleanup();
    };
  }, [meetingId]); // Run once on mount or meetingId change

  const joinMeetingClient = async (currentPasscode: string, currentUserName: string) => {
    // Initialize media first - acquires stream but starts with tracks DISABLED
    await webRTC.initializeMedia(true, true);

    // Join with mic/cam OFF (tracks are disabled)
    const response = await socket.joinMeeting(meetingId!, currentPasscode, currentUserName, false, false);

    if (response.success && response.userId) {
      setCurrentUserId(response.userId);
      currentUserIdRef.current = response.userId;
      setParticipants(response.participants || {});
      setMessages(response.messages || []);
      setScreenSharer(response.screenSharer || null);
      setNeedsAuth(false);
      setIsJoined(true);

      toast.success('Joined meeting successfully');
    } else {
      toast.error(response.error || 'Failed to join meeting');
      if (!location.state) {
        // If they came via direct link and failed, let them try again
        setNeedsAuth(true);
      } else {
        // Came from home page and failed, go back
        navigate('/');
      }
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinUserName.trim() || joinPasscode.length !== 6) return;

    setJoinLoading(true);
    setJoinError('');

    const response = await validatePasscode(meetingId!, joinPasscode);
    if (response.success) {
      setPasscode(joinPasscode);
      setUserName(joinUserName);
      await joinMeetingClient(joinPasscode, joinUserName);
    } else {
      setJoinError(response.error || 'Invalid passkey');
    }
    setJoinLoading(false);
  };

  // Update media state to others
  useEffect(() => {
    if (isJoined) {
      socket.updateMediaState(webRTC.isMicOn, webRTC.isCamOn);
    }
  }, [webRTC.isMicOn, webRTC.isCamOn, isJoined]);

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebar) return;
      // Calculate new width: viewport width - mouse X position
      // because sidebar is on the right side
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth >= 160 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
    };

    if (isDraggingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // prevent selection while dragging
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDraggingSidebar]);

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
      // Prompt user to pick a screen first before telling the backend
      const stream = await webRTC.startScreenShare();
      if (stream) {
        // Once screen is selected & allowed, request lock from backend
        const response = await socket.requestScreenShare();
        if (response.success) {
          toast.success('Screen sharing started');
        } else {
          // If backend rejects (e.g., someone else already sharing), stop the local stream
          webRTC.stopScreenShare();
          toast.error(response.error || 'Cannot share screen');
        }
      } else {
        // User cancelled the prompt, no action needed on backend
        toast.info('Screen sharing canceled');
      }
    }
  };

  // Handle toggle recording
  const handleToggleRecording = async () => {
    if (recording.isRecording) {
      recording.stopRecording();
      toast.info('Recording stopped. Uploading...');
    } else {
      const success = await recording.startRecording();
      if (success) {
        toast.success('Recording started');
      } else {
        toast.error('Failed to start recording');
      }
    }
  };

  // Handle send message
  const handleSendMessage = (text: string) => {
    socket.sendMessage(text);
  };

  // Handle leave
  const handleLeave = () => {
    if (recording.isRecording) {
      recording.stopRecording();
    }
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

  const [showPasskey, setShowPasskey] = useState(false);

  const handleCopyPasskey = () => {
    navigator.clipboard.writeText(passcode);
    toast.success('Passkey copied to clipboard');
  };
  if (meetingExists === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white">Checking meeting...</p>
        </div>
      </div>
    );
  }

  if (meetingExists === false) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Meeting Not Found</h1>
            <p className="text-neutral-400">The meeting you are trying to join does not exist or has ended.</p>
          </div>
          <Button onClick={() => navigate('/')} className="w-full bg-white text-black hover:bg-neutral-200 rounded-none h-12 text-md font-medium">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (needsAuth && !isJoined) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Join Meeting</h1>
            <p className="text-neutral-400 font-mono">{meetingName}</p>
          </div>

          <form onSubmit={handleJoinSubmit} className="bg-neutral-900 border border-neutral-800 p-6 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={joinUserName}
                  onChange={(e) => setJoinUserName(e.target.value)}
                  placeholder="Your Name"
                  required
                  className="bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500 h-11"
                />
              </div>
              <div className="space-y-2">
                <Input
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit Passkey"
                  type="password"
                  required
                  className="bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500 h-11"
                />
              </div>
            </div>

            {joinError && (
              <p className="text-red-400 text-sm text-center bg-red-400/10 p-2 border border-red-400/20">{joinError}</p>
            )}

            <Button
              type="submit"
              disabled={joinPasscode.length !== 6 || !joinUserName.trim() || joinLoading}
              className="w-full bg-white text-black hover:bg-neutral-200 rounded-none h-11 font-medium"
            >
              {joinLoading ? 'Joining...' : 'Join Now'}
              {!joinLoading && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white">Joining {meetingName || 'meeting'}...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen bg-neutral-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4">
        <div className="grid grid-cols-2 items-center gap-x-2 text-[10px] md:text-sm w-28 md:w-40">
          <span className="text-white font-medium bg-red-500 w-fit">Meeting ID</span>
          <span className="text-white font-medium bg-blue-500 w-20 md:w-24">: {meetingId}</span>
          <span className="text-white font-medium bg-red-500 w-fit">Passkey</span>
          <span className="text-white font-medium bg-blue-500 flex items-center gap-2 w-20 md:w-24">: {showPasskey ? passcode : '••••••'}
            <button onClick={() => setShowPasskey(!showPasskey)}>
              {showPasskey ? <EyeOff className="w-3 h-3 cursor-pointer hover:text-white" /> : <Eye className="w-3 h-3 cursor-pointer hover:text-white" />}
            </button>
            {showPasskey && (
              <button onClick={handleCopyPasskey}>
                <Copy className="w-3 h-3 cursor-pointer hover:text-white" />
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white font-medium">
            {meetingName && meetingName.length > 15 ? meetingName.substring(0, 15) + '..' : meetingName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neutral-400 text-[10px] md:text-sm flex items-center gap-1">
            <Users className="w-3 h-3 md:hidden" />
            {Object.keys(participants).length} <span className="hidden md:block">participants</span>
          </span>
          {isAnyoneScreenSharing && (
            <span className="text-green-400 text-[10px] md:text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              Screen sharing
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <div className="flex-1 flex overflow-hidden">
          {isAnyoneScreenSharing ? (
            /* Theater Mode: Screen Share Main, Others Sidebar */
            <div className="flex md:flex-row flex-col overflow-hidden w-full relative">
              <div className="flex-1 bg-neutral-900 p-2 overflow-hidden relative">
                {screenShareStream ? (
                  <VideoTile
                    stream={screenShareStream}
                    userName={screenSharer === currentUserId ? 'Your Screen' : (participants[screenSharer!]?.name || 'User') + "'s Screen"}
                    isMicOn={false}
                    isCamOn={true}
                    isScreenShare={true}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                    <p className="text-white">Connecting to screen share...</p>
                  </div>
                )}

                {/* Toggle Button for Video Grid Sidebar */}
                <button
                  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-neutral-800 hover:bg-neutral-700 text-white p-1.5 rounded-l-md border border-r-0 border-neutral-700 z-10 transition-colors shadow-lg hidden md:block"
                  title={isSidebarVisible ? "Hide Video Grid" : "Show Video Grid"}
                >
                  {isSidebarVisible ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>

              {/* Resizer Handle */}
              {isSidebarVisible && (
                <div
                  className="w-1 cursor-col-resize hover:bg-neutral-500 bg-neutral-800 transition-colors z-10 hidden md:block"
                  onMouseDown={(e) => { e.preventDefault(); setIsDraggingSidebar(true); }}
                />
              )}

              {/* Sidebar in Theater Mode */}
              {isSidebarVisible && (
                <div
                  className={`bg-neutral-950 p-2 overflow-y-auto space-y-2 flex-shrink-0 md:border-l border-neutral-800 ${isDraggingSidebar ? 'pointer-events-none' : ''}`}
                  style={{ width: window.innerWidth < 768 ? '100%' : `${sidebarWidth}px` }}
                >
                  <VideoTile
                    stream={webRTC.localStream}
                    userName={userName}
                    isMicOn={webRTC.isMicOn}
                    isCamOn={webRTC.isCamOn}
                    isLocal={true}
                    cameraSettings={cameraSettings}
                    className="w-full aspect-video"
                  />
                  {videoStreams.map(([peerId, stream]) => (
                    <VideoTile
                      key={peerId}
                      stream={stream}
                      userName={participants[peerId]?.name || 'Unknown'}
                      isMicOn={participants[peerId]?.isMicOn || false}
                      isCamOn={participants[peerId]?.isCamOn || false}
                      cameraSettings={participants[peerId]?.cameraSettings}
                      className="w-full aspect-video"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Grid Mode: All Participants in a responsive grid */
            <div className="participant-grid flex-1 bg-neutral-950 p-4 grid gap-4 items-center auto-rows-min overflow-y-auto max-h-[calc(100vh-120px)]"
              style={{
                // Calculate columns: at least 1, at most 4
                // We use auto-fill with a minimum width that naturally allows 4 on typical screens
                // but we also cap the template columns if participants are few
                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${Object.keys(participants).length <= 0 ? '500px' :
                  Object.keys(participants).length < 2 ? '400px' :
                    Object.keys(participants).length < 4 ? '300px' : '250px'
                  }), 1fr))`
              }}>
              {/* To strictly enforce max 4 columns on large screens while keeping it responsive,
                  we can also use a max-width on the grid or logic. 
                  However, "repeat(auto-fit...)" is the standard approach.
                  For strictly max 4, we use: */}
              <style dangerouslySetInnerHTML={{
                __html: `
                @media (min-width: 1200px) {
                  .participant-grid {
                    grid-template-columns: repeat(${Math.min(Object.keys(participants).length + 1, 4)}, 1fr) !important;
                  }
                }
              `}} />
              <VideoTile
                stream={webRTC.localStream}
                userName={userName}
                isMicOn={webRTC.isMicOn}
                isCamOn={webRTC.isCamOn}
                isLocal={true}
                cameraSettings={cameraSettings}
                className="w-full min-h-[240px] h-[300px]"
              />
              {Array.from(webRTC.remoteStreams.entries()).map(([peerId, stream]) => (
                <VideoTile
                  key={peerId}
                  stream={stream}
                  userName={participants[peerId]?.name || 'Unknown'}
                  isMicOn={participants[peerId]?.isMicOn || false}
                  isCamOn={participants[peerId]?.isCamOn || false}
                  cameraSettings={participants[peerId]?.cameraSettings}
                  className="w-full min-h-[240px] h-[300px]"
                />
              ))}

              {Object.keys(participants).length === 0 && (
                <div className="col-span-full flex items-center justify-center py-20">
                  <p className="text-neutral-500 text-sm">Waiting for others to join...</p>
                </div>
              )}
            </div>
          )}
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
        isRecording={recording.isRecording}
        recordingDuration={recording.recordingDuration}
        isUploading={recording.isUploading}
        showChat={showChat}
        showParticipants={showParticipants}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onToggleSettings={() => setShowSettingsModal(true)}
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

      <CameraSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={cameraSettings}
        onChange={(newSettings) => {
          setCameraSettings(newSettings);
          socket.updateCameraSettings(newSettings);
        }}
      />
    </div>
  );
}
