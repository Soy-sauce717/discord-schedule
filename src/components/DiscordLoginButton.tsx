"use client";

import { supabase } from "@/lib/supabase";

export default function DiscordLoginButton() {

  const loginWithDiscord = async () => {

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "discord",

        options: {
          redirectTo: window.location.origin,
        },
      });

    if (error) {
      console.error(
        "Discordログインエラー:",
        error.message
      );
    }
  };

  return (
    <button
      onClick={loginWithDiscord}
      className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
    >
      Discordでログイン
    </button>
  );
}
