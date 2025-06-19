import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("justbetUser"));

  const handleLogout = () => {
    localStorage.removeItem("justbetUser");
    navigate("/login");
  };

  return (
    <nav className="w-full flex items-center justify-between px-8 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="flex items-center gap-2 select-none">
        <i className="fa-solid fa-gavel text-2xl text-white"></i>
        <span className="text-xl font-bold text-white tracking-wide">JustBet</span>
      </div>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-white text-base font-medium">
            {user.firstName} {user.lastName} <span className="text-gray-300">({user.role})</span>
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold transition"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
} 