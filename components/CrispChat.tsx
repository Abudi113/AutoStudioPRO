
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

declare global {
  interface Window {
    $crisp: any[];
  }
}

const CrispChat = () => {
  const { user } = useAuth();
  const { language } = useLanguage();

  useEffect(() => {
    if (window.$crisp) {
      // Set language
      window.$crisp.push(["set", "session:language", [language]]);
    }
  }, [language]);

  useEffect(() => {
    if (window.$crisp) {
      if (user) {
        // Identify the user in Crisp
        window.$crisp.push(["set", "user:email", [user.email]]);
        
        // Use full name if available in user metadata
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0];
        if (fullName) {
          window.$crisp.push(["set", "user:nickname", [fullName]]);
        }

        // Add custom data
        window.$crisp.push(["set", "session:data", [[
          ["user_id", user.id],
          ["last_login", new Date().toISOString()]
        ]]]);
      } else {
        // Reset session if user logs out to prevent data carry-over
        // window.$crisp.push(["do", "session:reset"]); // Optional: depends if you want to keep chat history for anonymous users
      }
    }
  }, [user]);

  return null;
};

export default CrispChat;
