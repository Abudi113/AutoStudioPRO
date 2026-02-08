
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRoutes from './src/Routes';

import { AuthProvider } from './context/AuthContext';
import { CreditsProvider } from './context/CreditsContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <CreditsProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppRoutes />
          </LanguageProvider>
        </ThemeProvider>
      </CreditsProvider>
    </AuthProvider>
  </React.StrictMode>
);
