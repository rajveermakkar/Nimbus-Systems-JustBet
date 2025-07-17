import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ImHammer2 } from "react-icons/im";

const faqs = [
  {
    question: "How do I register for JustBet?",
    answer: "Click the Register link in the footer or the top navigation, fill out the form, and verify your email to get started.",
  },
  {
    question: "How do I participate in live auctions?",
    answer: "Go to Live Auctions from the footer or main menu, select an auction, and place your bid in real time.",
  },
  {
    question: "How do I contact support?",
    answer: "Visit the Contact page and fill out the form, or email us directly at support@justbet.com.",
  },
];

export default function Footer() {
  const [openFaq, setOpenFaq] = useState(null);

  // Smooth scroll to top handler
  const handleScrollToTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className="w-full min-h-[180px] bg-[#0B0B2C]/70 backdrop-blur-md border-t-1 border-purple-400/60 relative py-10 flex items-center"
    >
      <div className="max-w-6xl mx-auto px-4 flex flex-col gap-8 w-full">
        {/* Top Row: Logo left, links right */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 w-full">
          {/* Logo/Brand */}
          <div className="flex-shrink-0 flex items-center justify-center md:justify-start md:items-start mb-8 md:mb-0 w-full md:w-auto">
            <Link to="/" className="flex items-center">
              <ImHammer2 className="text-4xl md:text-3xl text-[#adbdff] mr-2" />
              <span className="text-3xl md:text-4xl font-extrabold text-[#adbdff] tracking-wide select-none">JustBet</span>
            </Link>
          </div>
          {/* Footer Links: horizontal on desktop, two columns on mobile */}
          <div className="grid grid-cols-2 gap-6 sm:flex sm:flex-row sm:gap-8 w-full md:justify-end">
            {/* Explore */}
            <div className="min-w-[140px]">
              <div className="font-semibold text-[#adbdff] mb-2">Explore</div>
              <ul className="space-y-1">
                <li><a href="/auctions" className="hover:underline text-gray-200">All Auctions</a></li>
                <li><a href="/live-auctions" className="hover:underline text-gray-200">Live Auctions</a></li>
                <li><a href="/settled-auctions" className="hover:underline text-gray-200">Settled Auctions</a></li>
              </ul>
            </div>
            {/* Account */}
            <div className="min-w-[120px]">
              <div className="font-semibold text-[#adbdff] mb-2">Account</div>
              <ul className="space-y-1">
                <li><a href="/login" className="hover:underline text-gray-200">Login</a></li>
                <li><a href="/register" className="hover:underline text-gray-200">Register</a></li>
              </ul>
            </div>
            {/* About */}
            <div className="min-w-[140px]">
              <div className="font-semibold text-[#adbdff] mb-2">About</div>
              <ul className="space-y-1">
                <li><a href="/about" className="hover:underline text-gray-200">About Us</a></li>
                <li><a href="/about#team" className="hover:underline text-gray-200">Meet Our Team</a></li>
                <li><a href="/about#mission" className="hover:underline text-gray-200">Our Mission</a></li>
              </ul>
            </div>
            {/* Contact */}
            <div className="min-w-[120px]">
              <div className="font-semibold text-[#adbdff] mb-2">Contact</div>
              <ul className="space-y-1">
                <li><a href="/contact" className="hover:underline text-gray-200">Write us at Contact</a></li>
                <li><a href="mailto:support@justbet.com" className="hover:underline text-gray-200">support@justbet.com</a></li>
              </ul>
            </div>
          </div>
        </div>
        {/* Bottom Row: Copyright, Terms, Back to top */}
        <div className="flex flex-col md:flex-row items-center justify-between border-t border-white/10 pt-4 text-[#adbdff] text-sm gap-2 w-full">
          <div>&copy; {new Date().getFullYear()} JustBet</div>
          <Link to="/terms" className="hover:underline text-[#adbdff]">Terms of Service</Link>
          <a href="#top" className="flex items-center gap-1 hover:underline text-grey-200" onClick={handleScrollToTop}><span>Back to top</span> <i className="fas fa-arrow-up text-xs"></i></a>
        </div>
      </div>
    </footer>
  );
} 