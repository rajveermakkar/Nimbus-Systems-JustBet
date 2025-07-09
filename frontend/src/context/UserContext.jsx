import React, { createContext, useState, useEffect } from "react";

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Load user from localStorage on first render
    const stored = localStorage.getItem("justbetUser");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  // Validate user token on mount and refresh
  useEffect(() => {
    const validateUser = async () => {
      const token = localStorage.getItem("justbetToken");
      const storedUser = localStorage.getItem("justbetUser");
      
      if (!token || !storedUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        const response = await fetch(`${backendUrl}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Token is invalid, clear everything
          localStorage.removeItem("justbetToken");
          localStorage.removeItem("justbetUser");
          setUser(null);
        }
      } catch (error) {
        console.error('Error validating user:', error);
        // On error, clear everything to be safe
        localStorage.removeItem("justbetToken");
        localStorage.removeItem("justbetUser");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    validateUser();
  }, []);

  // Keep localStorage in sync with user state
  useEffect(() => {
    if (user) {
      localStorage.setItem("justbetUser", JSON.stringify(user));
    } else {
      localStorage.removeItem("justbetUser");
    }
  }, [user]);

  // Sync user and token across tabs
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === 'justbetToken') {
        // Token changed in another tab, reload to get new token
        window.location.reload();
      }
      if (event.key === 'justbetUser') {
        // User changed in another tab, update user state
        const newUser = event.newValue ? JSON.parse(event.newValue) : null;
        setUser(newUser);
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // If user object only has first_name/last_name, map to firstName/lastName for context consumers
  const firstName = user?.first_name || user?.first_name;
  const lastName = user?.last_name || user?.last_name;
  const avatar_url = user?.avatar_url || user?.avatar_url;

  return (
    <UserContext.Provider value={{ user, setUser, firstName, lastName, avatar_url, loading }}>
      {children}
    </UserContext.Provider>
  );
} 