import React, { useEffect } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { useNavigate } from "react-router-dom";

export default function ContactUs() {
  const [state, handleSubmit] = useForm("mblkreyq");
  const navigate = useNavigate();

  useEffect(() => {
    if (state.succeeded) {
      const timer = setTimeout(() => {
        navigate("/contact");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.succeeded, navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-r from-[#000000] to-[#2A2A72] justify-center items-center">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center py-20 px-4">
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
            <button
              type="submit"
              className="mt-2 w-full py-4 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold rounded-full shadow hover:from-purple-600 hover:to-blue-700 transition text-lg tracking-wide disabled:opacity-60"
              disabled={state.submitting}
            >
              {state.submitting ? "Sending..." : "Send"}
              <span className="ml-1"><i className="fas fa-arrow-right"></i></span>
            </button>
          </form>
        )}
        {/* Info Section */}
        <div className="w-full flex flex-col items-center justify-center gap-4 mt-12 text-gray-300 text-base">
          <div className="font-semibold text-white">Visit us</div>
          <div>123 Auction Lane, Online City, 12345</div>
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