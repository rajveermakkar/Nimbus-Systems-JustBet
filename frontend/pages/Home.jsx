import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e]">
      <div className="flex flex-col items-center justify-center gap-6 bg-white/10 backdrop-blur-xl rounded-xl shadow-xl p-10 border border-white/20">
        <div className="flex flex-col items-center gap-2 mb-2 select-none">
          <i className="fa-solid fa-gavel text-4xl text-white"></i>
          <span className="text-3xl font-bold text-white tracking-wide">JustBet</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to JustBet</h1>
        <div className="flex gap-6">
          <Link to="/login" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition">Login</Link>
        </div>
      </div>
    </div>
  );
} 