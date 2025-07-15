import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../src/context/UserContext";
import Button from "../src/components/Button";

function UserDashboard() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  // Card data
  const cards = [
    {
      title: "Browse Auctions",
      description: "Discover amazing items",
      icon: "fa-solid fa-search",
      bg: "bg-blue-600",
      onClick: () => navigate("/auctions"),
    },
    {
      title: "My Winnings",
      description: "Auctions you've won",
      icon: "fa-solid fa-trophy",
      bg: "bg-green-600",
      onClick: () => navigate("/my-winnings"),
    },
    {
      title: "Bid History",
      description: "Track your bids",
      icon: "fa-solid fa-clock-rotate-left",
      bg: "bg-purple-600",
      onClick: () => navigate("/my-bid-history"),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] via-[#2a2a72] to-[#63e] text-white flex flex-col items-center justify-center py-10">
      {/* Welcome Card */}
      <div className="w-[95%] mx-auto md:w-full md:mx-auto max-w-3xl mb-6">
        <div className="rounded-xl bg-white/10 shadow-lg p-6 flex flex-col gap-2 items-start">
          <h2 className="text-xl font-semibold mb-1 text-left">Buyer Dashboard</h2>
          <p className="text-gray-200 text-sm mb-0 text-left">Welcome back, {user?.firstName} {user?.lastName}!</p>
          <p className="text-gray-400 text-xs text-left">Discover amazing products and auctions</p>
        </div>
      </div>

      {/* Become a Seller Card */}
      {user?.role === "buyer" && (
        <div className="w-[95%] mx-auto md:w-full md:mx-auto max-w-3xl mb-6">
          <div className="rounded-xl bg-white/10 shadow-lg p-6 flex flex-col items-start gap-2">
            <h3 className="text-base font-semibold mb-1 text-left">Want to start selling?</h3>
            <p className="text-gray-300 text-xs mb-2 text-left">Join our community of verified sellers and start earning today. Apply for seller status to unlock advanced features.</p>
            <Button
              variant="primary"
              size="md"
              className="mt-2 px-6 py-2"
              onClick={() => navigate("/seller/request")}
            >
              <i className="fa-solid fa-store mr-2"></i>
              Become a Seller
            </Button>
          </div>
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl bg-white/10 shadow-xl md:shadow-lg p-5 flex flex-col w-[95%] mx-auto md:w-auto md:mx-0 cursor-pointer hover:bg-white/20 transition min-h-[120px] items-center md:items-start"
            onClick={card.onClick}
          >
            <div className={`w-10 h-10 flex mb-3 rounded-full ${card.bg} items-center justify-center mx-auto md:mx-0`}>
              <i className={`${card.icon} text-lg text-white`}></i>
            </div>
            <h4 className="text-base font-semibold mb-1 text-left">{card.title}</h4>
            <p className="text-gray-300 text-left text-xs">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserDashboard; 