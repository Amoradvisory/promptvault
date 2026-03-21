"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hybridLogin, canUseSupabase } from "@/lib/sync-engine";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, Vault, Github, Loader2, Cloud, HardDrive } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabaseReady = canUseSupabase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await hybridLogin(email, password);

    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const handleOAuth = async (provider: "google" | "github") => {
    if (!supabaseReady) return;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-mesh px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 mb-4">
            <Vault className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            PromptVault
          </h1>
          <p className="text-text-secondary mt-1">
            Tes prompts, partout, pour toujours.
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              Connexion
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Accède à ta bibliothèque de prompts
            </p>
          </div>

          {/* OAuth — only when Supabase is configured */}
          {supabaseReady && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleOAuth("google")}
                  type="button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuth("github")}
                  type="button"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-bg-secondary px-2 text-text-secondary">
                    ou par email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input
                  type="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            Pas encore de compte ?{" "}
            <Link
              href="/auth/register"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              Créer un compte
            </Link>
          </p>
        </div>

        {/* Mode indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {supabaseReady ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-success" />
              <span className="text-xs text-text-secondary">
                Mode cloud — sync activée
              </span>
            </>
          ) : (
            <>
              <HardDrive className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-xs text-text-secondary">
                Mode local — données dans le navigateur
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
