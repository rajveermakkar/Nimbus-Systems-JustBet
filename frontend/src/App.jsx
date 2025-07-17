import { BrowserRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import './App.css';
import AppRoutes from './AppRoutes';
import Footer from "./components/Footer";
import ScrollToTop from './components/ScrollToTop';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />
      <AppRoutes />
      <Footer />
    </BrowserRouter>
  );
}

export default App
