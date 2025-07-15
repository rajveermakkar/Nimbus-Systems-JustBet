import React from "react";

function AuthCard({
  icon, // JSX for icon
  title,
  subtitle,
  error,
  success,
  children,
  footer,
  plain, // if true, render only content, no card container
  bgClassName = "bg-white/10" // new prop for background class
}) {
  const content = (
    <>
      <div className="flex flex-col items-center gap-2 mb-4 md:mb-6 select-none">
        {icon}
        <span className="text-2xl font-bold text-white tracking-wide">JustBet</span>
      </div>
      {title && <h2 className="text-2xl font-semibold text-white text-center mb-1">{title}</h2>}
      {subtitle && <p className="text-gray-300 text-base text-center mb-4">{subtitle}</p>}
      <div style={{ minHeight: '32px' }}>
        {error ? (
          <p className="text-sm text-red-400 mb-2 text-center">{error}</p>
        ) : success ? (
          <p className="text-green-400 font-medium text-center">{success}</p>
        ) : (
          <div style={{ height: '24px' }}></div>
        )}
      </div>
      {children}
      {footer && <div className="text-center mt-6 text-sm w-full">{footer}</div>}
    </>
  );
  if (plain) return content;
  return (
    <div className={`w-full max-w-sm mx-auto ${bgClassName} backdrop-blur-md text-white shadow-2xl rounded-2xl overflow-hidden border border-white/20 p-6 animate-fade-in flex flex-col justify-center`}>
      {content}
    </div>
  );
}

export default AuthCard; 