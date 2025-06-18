import { useNavigate } from "react-router-dom";
import Navbar from "../src/components/Navbar";

export default function NotAuthorized() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("justbetUser"));

  const handleLogout = () => {
    localStorage.removeItem("justbetUser");
    navigate("/login");
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      <Navbar />
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-3xl font-bold text-white mb-4">Not authorized</h2>
        <p className="text-lg text-gray-200">You do not have permission to view this page.</p>
      </div>
    </div>
  );
} 