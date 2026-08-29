import React from 'react';
import { createSupabaseBrowserClient } from '../lib/supabase-browser';

const supabase = createSupabaseBrowserClient();

const LogoutButton = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <button onClick={handleLogout} className="font-black uppercase text-sm hover:text-[#FF00E4] transition-colors">
      Log Out
    </button>
  );
};

export default LogoutButton;
