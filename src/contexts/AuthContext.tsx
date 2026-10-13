import React, { createContext, useContext, useState } from "react";

export type UserRole = "admin" | "farmer" | "guest" | null;

interface AuthContextType {
  userRole: UserRole;
  isAdminAuthenticated: boolean;
  loginAsAdmin: (adminId: string, pass: string) => Promise<boolean>;
  loginAsFarmer: () => void;
  loginAsGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>(() => {
    return (localStorage.getItem("satguru_user_role") as UserRole) || null;
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("satguru_admin_auth") === "true";
  });

  const loginAsAdmin = async (adminId: string, pass: string): Promise<boolean> => {
    // Supabase से एडमिन क्रेडेंशियल चेक करें ताकि पासवर्ड फ्रंटएंड में लीक न हो
    try {
      const { supabase } = await import("../lib/supabase");
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("admin_id", adminId)
        .eq("password_hash", pass) // वास्तविक प्रोजेक्ट में यहां हैश चेक होना चाहिए
        .single();

      if (data && !error) {
        setUserRole("admin");
        setIsAdminAuthenticated(true);
        localStorage.setItem("satguru_user_role", "admin");
        localStorage.setItem("satguru_admin_auth", "true");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const loginAsFarmer = () => {
    setUserRole("farmer");
    setIsAdminAuthenticated(false);
    localStorage.setItem("satguru_user_role", "farmer");
    localStorage.removeItem("satguru_admin_auth");
  };

  const loginAsGuest = () => {
    setUserRole("guest");
    setIsAdminAuthenticated(false);
    localStorage.setItem("satguru_user_role", "guest");
    localStorage.removeItem("satguru_admin_auth");
  };

  const logout = () => {
    setUserRole(null);
    setIsAdminAuthenticated(false);
    localStorage.removeItem("satguru_user_role");
    localStorage.removeItem("satguru_admin_auth");
  };

  return (
    <AuthContext.Provider value={{ userRole, isAdminAuthenticated, loginAsAdmin, loginAsFarmer, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};