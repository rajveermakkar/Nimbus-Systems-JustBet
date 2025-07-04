import { BrowserRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import './App.css';
import AppRoutes from './AppRoutes';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App
