"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hybridRegister } from "@/lib/sync-engine";
import { isFirebaseConfigured } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, User, Vault, Loader2, Cloud, HardDrive } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const authReady = isFirebaseConfigured();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);

    const { error } = await hybridRegister(name, email, password);

    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-mesh px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 mb-4">
            <Vault className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">PromptVault</h1>
          <p className="text-text-secondary mt-1">Crée ton coffre-fort de prompts</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Créer un compte</h2>
            <p className="text-sm text-text-secondary mt-1">Commence à organiser tes prompts</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Nom</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input type="text" placeholder="Ton nom" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input type="email" placeholder="ton@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input type="password" placeholder="6 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={6} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" required />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon coffre-fort"}
            </Button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            Déjà un compte ?{" "}
            <Link href="/auth/login" className="text-accent hover:text-accent-hover transition-colors">Se connecter</Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          {authReady ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-success" />
              <span className="text-xs text-text-secondary">Mode cloud — sync activée</span>
            </>
          ) : (
            <>
              <HardDrive className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-xs text-text-secondary">Mode local — données dans le navigateur</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
