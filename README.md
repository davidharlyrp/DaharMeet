# E-Conference

Aplikasi video conferencing seperti Google Meet dan Zoom dengan fitur real-time video call, screen sharing, dan chat.

## Fitur

- **Create Meeting**: Buat meeting baru dengan ID 8 digit dan passcode 6 digit
- **Join Meeting**: Gabung ke meeting dengan ID dan passcode
- **Video Call**: WebRTC-based video call dengan multiple participants
- **Screen Sharing**: Share screen dengan lock mechanism (hanya 1 orang bisa share)
- **Chat**: Real-time chat dalam meeting
- **Participants List**: Lihat daftar peserta dan status mereka

## Tech Stack

### Frontend
- React + TypeScript
- Tailwind CSS
- Socket.IO Client
- WebRTC
- React Router

### Backend
- Node.js + Express
- Socket.IO (WebSocket)
- File-based storage (JSON)

## Struktur Project

```
/mnt/okcomputer/output/
├── app/                    # Frontend React
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── hooks/          # Custom hooks (useSocket, useWebRTC)
│   │   ├── pages/          # HomePage, MeetingPage
│   │   ├── lib/            # API client
│   │   └── types/          # TypeScript types
│   └── dist/               # Build output
├── backend/                # Backend Node.js
│   ├── server.js           # Main server file
│   └── data/               # JSON data storage
└── README.md
```

## Cara Menjalankan

### 1. Jalankan Backend

```bash
cd /mnt/okcomputer/output/backend
npm start
```

Backend akan berjalan di `http://localhost:3001`

### 2. Jalankan Frontend

Development mode:
```bash
cd /mnt/okcomputer/output/app
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

### 3. Build untuk Production

```bash
cd /mnt/okcomputer/output/app
npm run build
```

Build output ada di folder `dist/`

## Cara Menggunakan

1. Buka aplikasi di browser
2. **Create Meeting**: Masukkan nama Anda, klik "Create Meeting"
3. Copy Meeting ID dan Passcode, bagikan ke peserta lain
4. **Join Meeting**: Masukkan 8-digit Meeting ID, klik "Join Meeting"
5. Masukkan passcode dan nama Anda
6. Dalam meeting:
   - Klik icon mic untuk on/off microphone
   - Klik icon video untuk on/off camera
   - Klik icon monitor untuk share screen (hanya 1 orang bisa share)
   - Klik icon chat untuk membuka panel chat
   - Klik icon users untuk melihat daftar peserta

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings` | Create new meeting |
| GET | `/api/meetings/:id` | Get meeting info |
| POST | `/api/meetings/:id/validate` | Validate passcode |

## WebSocket Events

### Client → Server
- `join-meeting`: Join a meeting
- `offer`: Send WebRTC offer
- `answer`: Send WebRTC answer
- `ice-candidate`: Send ICE candidate
- `media-state-change`: Update mic/cam state
- `request-screen-share`: Request to share screen
- `stop-screen-share`: Stop sharing screen
- `send-message`: Send chat message

### Server → Client
- `user-joined`: New user joined
- `user-left`: User left
- `offer`: Receive WebRTC offer
- `answer`: Receive WebRTC answer
- `ice-candidate`: Receive ICE candidate
- `media-state-changed`: User media state changed
- `screen-share-started`: Someone started sharing
- `screen-share-stopped`: Someone stopped sharing
- `new-message`: New chat message

## Design

- **Style**: Modern, minimalis, monochrome
- **Corners**: Square (tidak rounded)
- **Colors**: Neutral palette (black, white, grays)
- **Layout**: Compact dan functional
