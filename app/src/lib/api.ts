import type { CreateMeetingResponse, Meeting } from '@/types';

const API_URL = import.meta.env.VITE_API_URL;

export async function createMeeting(hostName: string, meetingName: string): Promise<CreateMeetingResponse> {
  const response = await fetch(`${API_URL}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ hostName, meetingName })
  });

  return response.json();
}

export async function getMeeting(meetingId: string): Promise<{ success: boolean; meeting?: Meeting; error?: string }> {
  const response = await fetch(`${API_URL}/api/meetings/${meetingId}`);
  return response.json();
}

export async function validatePasscode(meetingId: string, passcode: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/meetings/${meetingId}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ passcode })
  });

  return response.json();
}
