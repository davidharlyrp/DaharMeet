import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, ArrowRight, Lock, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createMeeting, validatePasscode, getMeeting } from '@/lib/api';

export function HomePage() {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [userName, setUserName] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<{ id: string; passcode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateMeeting = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const response = await createMeeting(userName);
    
    if (response.success && response.meeting) {
      setCreatedMeeting({
        id: response.meeting.id,
        passcode: response.meeting.passcode
      });
      setShowCreateDialog(true);
    } else {
      setError(response.error || 'Failed to create meeting');
    }
    
    setLoading(false);
  };

  const handleJoinClick = async () => {
    if (!meetingId.trim() || meetingId.length !== 8) {
      setError('Please enter a valid 8-digit meeting ID');
      return;
    }
    
    const response = await getMeeting(meetingId);
    
    if (response.success) {
      setShowJoinDialog(true);
      setError('');
    } else {
      setError('Meeting not found');
    }
  };

  const handleJoinMeeting = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!passcode.trim() || passcode.length !== 6) {
      setError('Please enter a valid 6-digit passcode');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const response = await validatePasscode(meetingId, passcode);
    
    if (response.success) {
      navigate(`/meet/${meetingId}`, { 
        state: { passcode, userName } 
      });
    } else {
      setError(response.error || 'Invalid passcode');
    }
    
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterCreatedMeeting = () => {
    if (createdMeeting) {
      navigate(`/meet/${createdMeeting.id}`, { 
        state: { 
          passcode: createdMeeting.passcode, 
          userName 
        } 
      });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-neutral-800 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white flex items-center justify-center">
            <Video className="w-6 h-6 text-black" />
          </div>
          <span className="text-xl font-bold text-white">E-Conference</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">Video Conferencing</h1>
            <p className="text-neutral-400">Secure, high-quality video meetings</p>
          </div>

          {/* Join Meeting */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 space-y-4">
            <h2 className="text-lg font-medium text-white">Join a Meeting</h2>
            <div className="space-y-3">
              <Input
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Enter 8-digit meeting ID"
                className="bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500 h-12"
              />
              <Button
                onClick={handleJoinClick}
                disabled={meetingId.length !== 8}
                className="w-full rounded-none bg-white text-black hover:bg-neutral-200 h-12 font-medium"
              >
                Join Meeting
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Create Meeting */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 space-y-4">
            <h2 className="text-lg font-medium text-white">Create New Meeting</h2>
            <div className="space-y-3">
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500 h-12"
              />
              <Button
                onClick={handleCreateMeeting}
                disabled={!userName.trim() || loading}
                className="w-full rounded-none bg-white text-black hover:bg-neutral-200 h-12 font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Meeting
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
        </div>
      </main>

      {/* Join Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-neutral-900 border-neutral-800 rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Enter Meeting Passcode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500"
            />
            <Input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit passcode"
              type="password"
              className="bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              onClick={handleJoinMeeting}
              disabled={passcode.length !== 6 || !userName.trim() || loading}
              className="w-full rounded-none bg-white text-black hover:bg-neutral-200"
            >
              Join
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-neutral-900 border-neutral-800 rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Meeting Created!</DialogTitle>
          </DialogHeader>
          {createdMeeting && (
            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-neutral-400">Meeting ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-neutral-800 px-3 py-2 text-white font-mono">
                      {createdMeeting.id}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(createdMeeting.id)}
                      className="rounded-none border-neutral-700"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Passcode</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-neutral-800 px-3 py-2 text-white font-mono">
                      {createdMeeting.passcode}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(createdMeeting.passcode)}
                      className="rounded-none border-neutral-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-neutral-400">
                Share these credentials with participants you want to invite.
              </p>
              <Button
                onClick={enterCreatedMeeting}
                className="w-full rounded-none bg-white text-black hover:bg-neutral-200"
              >
                Enter Meeting
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
