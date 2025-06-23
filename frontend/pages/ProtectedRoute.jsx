import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../src/context/UserContext";

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useContext(UserContext);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/not-authorized" />;
  }

  return children;
}

export default ProtectedRoute; 