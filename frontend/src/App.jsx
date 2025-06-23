import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import UserDashboard from '../pages/UserDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import NotAuthorized from '../pages/NotAuthorized';
import ProtectedRoute from '../pages/ProtectedRoute';
import Home from '../pages/Home';
import ResetPassword from '../pages/ResetPassword';
import VerifyEmail from '../pages/VerifyEmail';
import ResendVerification from '../pages/ResendVerification';
import SellerDashboard from '../pages/SellerDashboard';
import CreateListing from '../pages/CreateListing';
import Toast from './components/Toast';
import SellerRequestForm from '../pages/SellerRequestForm';

function App() {
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };

  return (
    <BrowserRouter>
      <Navbar />
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login showToast={showToast} />} />
        <Route path="/register" element={<Register showToast={showToast} />} />
        <Route path="/forgot-password" element={<ForgotPassword showToast={showToast} />} />
        <Route path="/reset-password" element={<ResetPassword showToast={showToast} />} />
        <Route path="/verify-email" element={<VerifyEmail showToast={showToast} />} />
        <Route path="/resend-verification" element={<ResendVerification showToast={showToast} />} />
        <Route path="/dashboard" element={<UserDashboard showToast={showToast} />} />
        <Route path="/seller/dashboard" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <SellerDashboard showToast={showToast} />
          </ProtectedRoute>
        } />
        <Route path="/seller/create-listing" element={
          <ProtectedRoute allowedRoles={['seller']}>
            <CreateListing showToast={showToast} />
          </ProtectedRoute>
        } />
        <Route path="/seller/request" element={<SellerRequestForm showToast={showToast} />} />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard showToast={showToast} />
          </ProtectedRoute>
        } />
        <Route path="/not-authorized" element={<NotAuthorized showToast={showToast} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
