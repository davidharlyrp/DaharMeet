export interface Participant {
  id: string;
  name: string;
  socketId: string;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface Meeting {
  id: string;
  passcode: string;
  hostName: string;
  meetingName: string;
  participantCount: number;
}

export interface JoinMeetingResponse {
  success: boolean;
  userId?: string;
  participants?: Record<string, Participant>;
  messages?: Message[];
  screenSharer?: string | null;
  error?: string;
}

export interface CreateMeetingResponse {
  success: boolean;
  meeting?: Meeting;
  error?: string;
}

export interface MediaStreamState {
  stream: MediaStream | null;
  isMicOn: boolean;
  isCamOn: boolean;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}
