import React from "react";
// Removed FontAwesomeIcon import
// Removed faGithub import

const team = [
  {
    name: "Rajveer Singh",
    avatar: "https://ui-avatars.com/api/?name=Rajveer+Singh&background=6a11cb&color=fff&size=128",
    github: "https://github.com/rajveermakkar",
    linkedin: "https://www.linkedin.com/in/rajveersingh08/"
  },
  {
    name: "Dhaval Sutariya",
    avatar: "https://ui-avatars.com/api/?name=Dhaval+Sutariya&background=6a11cb&color=fff&size=128",
    github: "https://github.com/dhavalsutariya/",
    linkedin: "https://www.linkedin.com/in/dhavalsutariya/"
  },
  {
    name: "Nirlep Tamboli",
    avatar: "https://ui-avatars.com/api/?name=Nirlep+Tamboli&background=6a11cb&color=fff&size=128",
    github: "https://github.com/NirlepTamboli ",
    linkedin: "https://www.linkedin.com/in/nirlep-tamboli-496753289"
  },
  {
    name: "Tania",
    avatar: "https://ui-avatars.com/api/?name=Tania&background=6a11cb&color=fff&size=128",
    github: "https://github.com/tania2300",
    linkedin: "https://www.linkedin.com/in/tania-655019211"
  },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-r from-[#000000] to-[#2A2A72]">
      {/* Hero Card Section */}
      <section className="w-full flex justify-center items-center px-2 py-12">
        <div className="w-full max-w-5xl p-[2px] rounded-3xl bg-gradient-to-r from-[#6a11cb] to-[#2575fc]">
          <div className="rounded-3xl bg-black/80 border border-white/20 backdrop-blur-md flex flex-col md:flex-row">
            {/* Left: Text */}
            <div className="flex-1 p-8 flex flex-col justify-center">
              <span className="text-orange-500 font-semibold text-lg mb-2">How It Started</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">Our Dream is <br className="hidden md:block"/> Global Auction Transformation</h1>
              <p className="text-gray-200 mb-4">
                JustBet was founded by a passionate team of builders and dreamers. Our shared vision is to create a digital haven for fair, fun, and transparent auctions accessible to all. United by our belief in the power of technology, we set out to build a platform that empowers both sellers and buyers, making online auctions exciting and secure for everyone.
              </p>
            </div>
            {/* Right: Image */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-0">
              <img
                src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=500&q=80"
                alt="Team working together"
                className="rounded-2xl w-full max-w-xs md:max-w-sm object-cover shadow-md"
                style={{ minHeight: '220px', background: '#e0e7ff' }}
              />
            </div>
          </div>
        </div>
      </section>
      {/* Team Section */}
      <section className="w-full max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">Meet the Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 justify-center">
          {team.map(member => (
            <div key={member.name} className="flex flex-col items-center bg-white/5 rounded-2xl p-6 shadow-md">
              <img src={member.avatar} alt={member.name} className="w-24 h-24 rounded-full mb-4 border-4 border-purple-400/40 shadow" />
              <span className="text-lg font-semibold text-white mb-2">{member.name}</span>
              <div className="flex flex-row gap-4 mt-2">
                <a href={member.github} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-white text-2xl">
                  <i className="fab fa-github"></i>
                </a>
                <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-white text-2xl">
                  <i className="fab fa-linkedin"></i>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
} 