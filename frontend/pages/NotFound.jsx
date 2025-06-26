import React from 'react';
import { useNavigate } from 'react-router-dom';
import Illustration404 from './assets/404 error with people holding the numbers-amico.svg';
import Button from '../src/components/Button';

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white px-4">
      <div className="flex flex-col items-center w-full" style={{ marginBottom: '1.2rem'}}>
        <img src={Illustration404} alt="404 Not Found" className="w-full max-w-xs h-auto" style={{maxWidth: '320px', marginBottom: '0.5rem'}} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Uh oh! Sorry, this page doesn't exist.</h1>
      <p className="text-white/80 mb-6 text-center max-w-md mx-auto">The page you are looking for was not found or has been moved.</p>
      <Button
        variant="primary"
        onClick={() => navigate('/')}
        className="mx-auto"
      >
        Go Home
      </Button>
    </div>
  );
}

export default NotFound; 