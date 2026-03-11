import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { BuildScreen } from './pages/BuildScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/build/:slug" element={<BuildScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
