import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@ds/contexts/AuthContext.jsx';
import { ViewportProvider } from '@ds/contexts/ViewportContext.jsx';
import App from './App.jsx';
import './styles/index.css';

// AuthProvider + ViewportProvider come straight from 908-doha-ui so
// design-system components that consult them (TaskCard, NoteCard,
// MemberAvatar etc.) work as-is. Their underlying Supabase / auth
// libs are swapped for local stubs by the dsStubPlugin in
// vite.config.js — see src/providers/dsStubs/.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ViewportProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ViewportProvider>
  </React.StrictMode>,
);
