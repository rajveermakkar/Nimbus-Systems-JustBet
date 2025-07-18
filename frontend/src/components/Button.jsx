import React from "react";

function Button({ variant = "primary", size = "default", className = "", children, ...props }) {
  const base = "inline-flex items-center justify-center gap-1 rounded-md font-semibold text-white transition-all duration-200 transform-gpu focus:outline-none focus:ring-0 focus:ring-offset-0 will-change-transform";
  const variants = {
    primary: "bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 border-transparent hover:shadow-[0_0_12px_2px_rgba(42,42,114,0.6)] hover:scale-105",
    secondary: "bg-transparent border border-white/40 text-white hover:bg-white/10",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };
  const sizes = {
    default: "text-sm h-9 px-4",
    sm: "text-xs h-8 px-3",
    lg: "text-base h-11 px-8",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button className={`${base} ${variants[variant] || ""} ${sizes[size] || ""} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default Button; 