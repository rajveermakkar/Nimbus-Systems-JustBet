import { Link } from "react-router-dom";
import Button from "../src/components/Button";
import heroImg from "./assets/Home/Hero1.png";
import React, { useEffect, useState, useContext } from "react";
import AuctionCard from "../src/components/auctions/AuctionCard";
import auctionService from "../src/services/auctionService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchDollar, faFileInvoice, faBullseye } from "@fortawesome/free-solid-svg-icons";
import { UserContext } from "../src/context/UserContext";
import auctionComingImg from "./assets/Home/auctionComing.png";
import { FaMobile } from "react-icons/fa";
import { FaCircleDollarToSlot } from "react-icons/fa6";
import { MdOutlinePayment } from "react-icons/md";

function AnimatedNumber({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = value / (duration / 16);
    let frame;
    function animate() {
      start += increment;
      if (start < value) {
        setDisplay(Math.floor(start));
        frame = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <span>{display.toLocaleString()}+</span>;
}

// Helper for placeholder countdown
function PlaceholderCountdown() {
  const [seconds, setSeconds] = useState(() => Math.floor(Math.random() * 30 * 60) + 60); // 1-30 min
  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds]);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return (
    <Button variant="secondary" size="lg" className="w-full opacity-80 cursor-not-allowed mt-4">
      Starting In: <span className="ml-2 font-mono tabular-nums">{m}:{s}</span>
    </Button>
  );
}

const placeholderAuction = {
  id: 'placeholder',
  title: 'Auction Coming Soon',
  description: 'Stay tuned for more exciting auctions!',
  image_url: auctionComingImg,
  current_highest_bid: 0,
  starting_price: 0,
  start_time: new Date(Date.now() + 10 * 3600 * 1000).toISOString(), // 10 hours from now
  end_time: new Date(Date.now() + 3600 * 1000).toISOString(),
  seller: { first_name: 'JustBet', last_name: 'Auction House' },
  type: 'settled',
  badge: 'Coming Soon',
  placeholder: true,
};

export default function Home() {
  // Ongoing auctions state
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useContext(UserContext);

  useEffect(() => {
    let isMounted = true;
    async function fetchAuctions() {
      setLoading(true);
      setError(null);
      try {
        // Fetch both live and settled auctions, then merge
        const [live, settled] = await Promise.all([
          auctionService.getLiveAuctions(),
          auctionService.getSettledAuctions()
        ]);
        // Only show auctions that are active (not ended)
        const now = new Date();
        const all = [...(live || []), ...(settled || [])].filter(a => new Date(a.end_time) > now);
        // Sort by end_time ascending (soonest ending first)
        all.sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
        if (isMounted) setAuctions(all);
      } catch (e) {
        if (isMounted) setError("Failed to load auctions");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchAuctions();
    return () => { isMounted = false; };
  }, []);

  // Fill up to 4 cards with placeholders if needed, but only if there are 1-3 real auctions
  const displayAuctions = auctions.slice(0, 4);
  const placeholders = displayAuctions.length > 0 && displayAuctions.length < 4
    ? Array.from({ length: 4 - displayAuctions.length }, (_, i) => ({ ...placeholderAuction, id: `placeholder-${i}` }))
    : [];
  const allCards = [...displayAuctions, ...placeholders];

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-gradient-to-r from-[#000000] to-[#2A2A72]">
      {/* Hero Section - center aligned text and buttons, purplish highlight */}
      <section className="w-full flex flex-col-reverse md:flex-row items-center justify-between px-16 py-4 gap-10 md:gap-0">
        {/* Left: Text & CTA */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-2">
            <span className="text-[#ecebe4]">Explore the </span>
            <span className="text-[#adbdff]">best auctions</span>
            <br />
            <span className="text-[#ecebe4]">and win big on </span>
            <span className="text-[#f4b860]">JustBet</span>
          </h1>
          <p className="text-lg md:text-xl mb-2 max-w-lg mx-auto text-[#daddd8]">
            Join the next-generation auction platform. Bid live, win rare items, and experience transparent, secure auctions.
          </p>
          <div className="flex gap-4 justify-center">
            {user ? (
              <Link to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'seller' ? '/seller/dashboard' : '/dashboard'}>
                <Button variant="primary" size="lg">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <Button variant="primary" size="lg">Register</Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" size="lg" className="hover:bg-white/20 hover:border-purple-300 hover:text-purple-200 hover:scale-105 transition">Login</Button>
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Right: Hero Image - NO shadow, NO border, NO nested card */}
        <div className="flex-1 flex items-center justify-center">
          <img src={heroImg} alt="Auction Hero" className="w-full max-w-lg md:max-w-2xl hidden sm:block" />
        </div>
      </section>
      {/* Stats Row */}
      <section className="w-full max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 gap-8 sm:flex sm:flex-row justify-center items-center gap-y-10 gap-x-12">
          <div className="flex flex-col items-center justify-center h-24">
            <span className="text-2xl md:text-3xl font-bold text-white mb-2">
              <AnimatedNumber value={500} />
            </span>
            <span className="text-white/70 text-sm md:text-base">Auctions</span>
          </div>
          <div className="flex flex-col items-center justify-center h-24">
            <span className="text-2xl md:text-3xl font-bold text-white mb-2">
              <AnimatedNumber value={400}/>
            </span>
            <span className="text-white/70 text-sm md:text-base">Winners</span>
          </div>
          <div className="flex flex-col items-center justify-center h-24">
            <span className="text-2xl md:text-3xl font-bold text-white mb-2">
              <AnimatedNumber value={5000}/>
            </span>
            <span className="text-white/70 text-sm md:text-base">Bids</span>
          </div>
          <div className="flex flex-col items-center justify-center h-24">
            <span className="text-2xl md:text-3xl font-bold text-white mb-2">
              <AnimatedNumber value={100}/>
            </span>
            <span className="text-white/70 text-sm md:text-base">Transparency</span>
          </div>
        </div>
      </section>
      {/* How It Works Section */}
      <section className="w-full max-w-5xl mx-auto px-4 pt-8 pb-12">
        <div className="flex flex-col items-center text-center mb-10">
          <span className="text-sm font-semibold text-purple-300 mb-2 tracking-widest uppercase">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            We made the process to get your <span className="relative inline-block"><span className="text-[#adbdff]">favorite</span><span className="absolute left-0 right-0 bottom-0 h-2 bg-purple-400/30 rounded-full -z-10" style={{filter:'blur(4px)'}}></span></span> items easy
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Join auctions in just a few steps. Select your product, place your bid, and pay securely if you win. It’s that simple!
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Step 1 */}
          <div className="bg-white/5 rounded-2xl flex flex-col items-center p-8 shadow-md">
            <div className="bg-gradient-to-br from-purple-400 to-blue-500 rounded-full w-20 h-20 flex items-center justify-center mb-4">
              <FaMobile className="text-white text-3xl" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select the product</h3>
            <p className="text-gray-300 mb-4">Browse and choose the item you want to bid on from our live and settled auctions.</p>
            <span className="text-2xl font-bold text-gray-400 mt-auto">01</span>
          </div>
          {/* Step 2 */}
          <div className="bg-white/5 rounded-2xl flex flex-col items-center p-8 shadow-md">
            <div className="bg-gradient-to-br from-purple-400 to-blue-500 rounded-full w-20 h-20 flex items-center justify-center mb-4">
              <FaCircleDollarToSlot className="text-white text-3xl" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Bid amount</h3>
            <p className="text-gray-300 mb-4">Enter your bid and compete with others in real time. The highest bid wins!</p>
            <span className="text-2xl font-bold text-gray-400 mt-auto">02</span>
          </div>
          {/* Step 3 */}
          <div className="bg-white/5 rounded-2xl flex flex-col items-center p-8 shadow-md">
            <div className="bg-gradient-to-br from-purple-400 to-blue-500 rounded-full w-20 h-20 flex items-center justify-center mb-4">
              <MdOutlinePayment className="text-white text-3xl" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Pay the amount</h3>
            <p className="text-gray-300 mb-4">The amount is automatically deducted from winner's wallet. No manual payment needed!</p>
            <span className="text-2xl font-bold text-gray-400 mt-auto">03</span>
          </div>
        </div>
        {/* Wallet Locking Info Box */}
        <div className="w-full my-10 px-0 md:px-0">
          <div className="relative w-full">
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              background: 'linear-gradient(90deg, #a084e8 0%, #6a11cb 100%)',
              filter: 'blur(8px)',
              opacity: 0.4,
              zIndex: 0
            }}></div>
            <div className="relative z-10 bg-gradient-to-r from-[#000000]/90 to-[#2A2A72]/90 border-2 border-purple-400/60 rounded-2xl p-8 md:p-12 text-center text-white shadow-xl">
              <h4 className="text-2xl font-bold mb-4 text-purple-200">How Wallet Locking Works</h4>
              <ol className="list-decimal list-inside text-left text-gray-200 max-w-2xl mx-auto space-y-3 text-lg">
                <li><span className="font-semibold text-purple-200">When you place a bid:</span> The bid amount is locked in your wallet and cannot be used elsewhere.</li>
                <li><span className="font-semibold text-purple-200">If you get outbid:</span> The locked amount is instantly released back to your wallet.</li>
                <li><span className="font-semibold text-purple-200">If you win:</span> The locked amount is automatically deducted to pay for your item. No extra steps needed!</li>
              </ol>
            </div>
          </div>
        </div>
      </section>
      {/* Ongoing Auctions Section */}
      <section className="w-full max-w-6xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Ongoing Auctions</h2>
          <Link to="/auctions" className="text-purple-300 hover:underline font-semibold text-base">Show More</Link>
        </div>
        {loading ? (
          <div className="text-center text-white/80 py-8">Loading auctions...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : auctions.length === 0 ? (
          <div className="text-center text-white/70 py-8">No auctions for now. Check back later!</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {allCards.map(auction => (
              <AuctionCard key={auction.id} auction={auction} actionLabel={auction.id.startsWith('placeholder') ? undefined : "View Auction"} badge={auction.badge} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
} 