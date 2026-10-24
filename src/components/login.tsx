"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Globe2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12">
    <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
      <section className="bg-slate-950 p-8 text-white md:p-10">
        <div className="flex items-center gap-2 font-semibold"><span className="rounded-xl bg-white/10 p-2"><Globe2 size={20}/></span>DomainGate</div>
        <div className="mt-16"><p className="text-sm font-semibold text-indigo-300">CUSTOM DOMAIN INFRASTRUCTURE</p><h1 className="mt-3 text-3xl font-semibold leading-tight">Prove control.<br/>Then connect.</h1><p className="mt-4 text-sm leading-6 text-slate-300">A learning project for DNS TXT ownership verification, safe domain claims, and custom-domain setup.</p></div>
        <div className="mt-10 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"><ShieldCheck size={20} className="shrink-0 text-emerald-300"/>Verification happens on the server, against public DNS.</div>
      </section>
      <section className="p-8 md:p-10"><h2 className="text-xl font-semibold">Sign in to your demo</h2><p className="mt-2 text-sm text-slate-500">Use the ADMIN_EMAIL and ADMIN_PASSWORD from your .env file.</p>
        <form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-medium">Email<div className="mt-1.5"><Input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></div></label><label className="block text-sm font-medium">Password<div className="mt-1.5"><Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div></label>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button></form>
        <p className="mt-6 text-xs leading-5 text-slate-500">Demo note: this starter uses one environment-configured admin account. Replace it with your application's real authentication and workspace authorization before production use.</p>
      </section>
    </div>
  </main>;
}
