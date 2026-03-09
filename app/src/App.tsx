import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { HomePage } from '@/pages/HomePage';
import { MeetingPage } from '@/pages/MeetingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/meet/:meetingId" element={<MeetingPage />} />
      </Routes>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#171717',
            color: '#fff',
            border: '1px solid #262626',
            borderRadius: '0',
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
