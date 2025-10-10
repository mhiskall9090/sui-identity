import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import LandingPage from './pages/LandingPage';
import KycPage from './pages/KycPage';
import User from './pages/User';
import GovernmentDecryptionPage from './pages/GovernmentDecryptionPage';
import AdminLogin from './pages/AdminLogin';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App outfit">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/kyc" element={<KycPage />} />
          <Route path="/dashboard" element={<User />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<GovernmentDecryptionPage />} />
          <Route path="/admin/decrypt" element={<GovernmentDecryptionPage />} />
        </Routes>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          toastStyle={{
            backgroundColor: '#1a1d29',
            color: '#00BFFF',
            border: '1px solid #00BFFF',
            borderRadius: '12px',
            fontFamily: 'Outfit, sans-serif'
          }}
          progressClassName="toast-progress"
        />
      </div>
    </Router>
  );
};

export default App;
