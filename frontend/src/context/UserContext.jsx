import React, { createContext, useState, useEffect } from "react";

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Load user from localStorage on first render
    const stored = localStorage.getItem("justbetUser");
    return stored ? JSON.parse(stored) : null;
  });

  // Keep localStorage in sync with user state
  useEffect(() => {
    if (user) {
      localStorage.setItem("justbetUser", JSON.stringify(user));
    } else {
      localStorage.removeItem("justbetUser");
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
} 