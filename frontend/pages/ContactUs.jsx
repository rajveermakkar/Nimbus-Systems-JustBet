import React, { useEffect, useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { useNavigate } from "react-router-dom";
import Button from "../src/components/Button";

export default function ContactUs() {
  const [state, handleSubmit] = useForm("mblkreyq");
  const navigate = useNavigate();
  const [openFAQ, setOpenFAQ] = useState(null);

  useEffect(() => {
    if (state.succeeded) {
      const timer = setTimeout(() => {
        navigate("/contact");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.succeeded, navigate]);

  const faqData = [
    {
      question: "How do I place a bid?",
      answer: "To place a bid, navigate to any auction page and click the 'Place Bid' button. Enter your bid amount and confirm. Make sure you have sufficient funds in your wallet."
    },
    {
      question: "What happens if I win an auction?",
      answer: "If you win an auction, you'll receive a notification and the item will be automatically transferred to your account. Payment will be processed from your wallet."
    },
    {
      question: "How do I add funds to my wallet?",
      answer: "Go to your Wallet page from the dashboard and click 'Add Funds'. You can add money using various payment methods including credit cards and digital wallets."
    },
    {
      question: "How do I become a seller?",
      answer: "To become a seller, submit a seller request form through the 'Become a Seller' option. Once approved, you'll be able to create and manage your own auctions."
    },
    {
      question: "What are the fees?",
      answer: "We charge a small percentage fee on successful auctions. The exact fee structure is displayed before you place a bid or create a listing."
    },
    {
      question: "How do I contact support?",
      answer: "You can contact our support team through this contact form, email us at support@justbet.com, or call us at +1 234 567 8901."
    }
  ];

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-r from-[#000000] to-[#2A2A72] justify-center items-center">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center py-20 px-4">
        <div className="w-full flex flex-col lg:flex-row gap-12 items-start">
          {/* Left Column - Contact Form */}
          <div className="w-full lg:w-1/2 lg:mt-8 flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white text-center mb-4">We'd love to hear from you!</h1>
            <p className="text-gray-300 text-center mb-10 max-w-md">Whether you have a question, want to work with us<br/> or just want to say hi, feel free to reach out. Our team is ready to help.</p>
            {state.succeeded ? (
              <div className="bg-purple-700/80 text-white rounded-xl p-6 text-center font-semibold shadow mb-8 transition-all duration-300">
                Thank you for contacting us! We'll get back to you soon.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 items-center">
                <div className="w-full">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-5 py-4 text-lg rounded-full border border-gray-500 bg-transparent text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition"
                    placeholder="Enter your name"
                  />
                  <ValidationError prefix="Name" field="name" errors={state.errors} />
                </div>
                <div className="w-full">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-5 py-4 text-lg rounded-full border border-gray-500 bg-transparent text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition"
                    placeholder="Enter your email"
                  />
                  <ValidationError prefix="Email" field="email" errors={state.errors} />
                </div>
                <div className="w-full">
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    className="w-full px-5 py-4 text-lg rounded-3xl border border-gray-500 bg-transparent text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition resize-none"
                    placeholder="Write your message"
                  />
                  <ValidationError prefix="Message" field="message" errors={state.errors} />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="mt-2 w-[20rem]"
                  disabled={state.submitting}
                >
                  {state.submitting ? "Sending..." : "Send"}
                  <span className="ml-1"><i className="fas fa-arrow-right"></i></span>
                </Button>
              </form>
            )}
          </div>

          {/* Right Column - FAQ Section */}
          <div className="w-full lg:w-1/2 lg:mt-8">
            <h2 className="text-3xl font-extrabold text-white text-center mb-6">Frequently Asked Questions</h2>
            <div className="flex flex-col gap-4">
              {faqData.map((faq, index) => (
                <div key={index} className={`rounded-2xl p-6 shadow-lg transition-all duration-300 ease-in-out border-2 ${
                  openFAQ === index 
                    ? "bg-gray-800/50 border-purple-400" 
                    : "bg-gray-800/30 backdrop-blur-sm border-gray-600/50"
                }`}>
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full text-left text-xl font-semibold text-white flex justify-between items-center"
                  >
                    {faq.question}
                    <span className={`text-2xl transition-transform duration-300 ease-in-out ${
                      openFAQ === index ? "rotate-180" : "rotate-0"
                    }`}>
                      <i className="fas fa-chevron-down"></i>
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openFAQ === index ? "max-h-96 opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
                  }`}>
                    <div className="text-gray-300 text-base leading-relaxed text-left">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="w-full flex flex-col items-center justify-center gap-4 mt-12 text-gray-300 text-base">
          <div className="font-semibold text-white">Visit us</div>
          <div>121 Auction Lane, Facebook City, 12345</div>
          <div className="font-semibold text-white mt-4">Talk to us</div>
          <div>+1 234 567 8901</div>
          <a href="mailto:support@justbet.com" className="text-purple-300 hover:underline">support@justbet.com</a>
          <div className="flex gap-6 mt-4 text-2xl">
            <a href="#" className="hover:text-purple-400" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
            <a href="#" className="hover:text-purple-400" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
            <a href="#" className="hover:text-purple-400" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
            <a href="#" className="hover:text-purple-400" aria-label="Dribbble"><i className="fab fa-dribbble"></i></a>
          </div>
        </div>
      </div>
    </div>
  );
} 