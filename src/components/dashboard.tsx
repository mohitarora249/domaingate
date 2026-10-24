"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { Check, CheckCircle2, CircleHelp, Copy, ExternalLink, Globe2, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Domain = {
  id: string; hostname: string; status: "PENDING" | "VERIFIED"; verificationToken: string;
  verificationRecordName: string; routingTarget: string; createdAt: string; verifiedAt: string | null;
  lastCheckedAt: string | null; lastError: string | null;
};

function timeLabel(value: string | null) { return value ? new Date(value).toLocaleString() : "Never"; }

export function Dashboard({ email }: { email: string }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/domains", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { window.location.reload(); return; }
      if (!response.ok) throw new Error(data.error || "Could not load domains.");
      setDomains(data.domains);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load domains."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDomains(); }, [loadDomains]);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAdding(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hostname }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add domain.");
      setHostname(""); setMessage(`Added ${data.domain.hostname}. Publish its TXT record, then click Verify ownership.`);
      await loadDomains();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add domain."); }
    finally { setAdding(false); }
  }

  async function verify(id: string) {
    setWorkingId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/domains/${id}/verify`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification request failed.");
      if (data.verified) setMessage(data.message); else setError(data.message || "TXT record not verified yet.");
      await loadDomains();
    } catch (e) { setError(e instanceof Error ? e.message : "Verification request failed."); }
    finally { setWorkingId(null); }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from DomainGate?`)) return;
    setWorkingId(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/domains/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove domain.");
      setMessage(`${name} removed.`); await loadDomains();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove domain."); }
    finally { setWorkingId(null); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); window.setTimeout(() => setCopied(""), 1400); }
    catch { setError("Clipboard access failed. Select and copy the value manually."); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }); window.location.reload();
  }

  return <main className="min-h-screen">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-950 p-2 text-white"><Globe2 size={20}/></div><div><div className="font-semibold tracking-tight">DomainGate</div><div className="text-xs text-slate-500">Custom domain verification</div></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">{email}</span><Button variant="secondary" onClick={logout}>Sign out</Button></div></div></header>
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-indigo-600">DOMAIN CONTROL CENTER</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your domains</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Prove you control a hostname by publishing a unique DNS TXT record. DomainGate checks the record from the server.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={()=>void loadDomains()}><RefreshCw size={15}/> Refresh</Button></div></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat label="Total domains" value={String(domains.length)} icon={<Globe2 size={18}/>} /><Stat label="Verified" value={String(domains.filter(d=>d.status === "VERIFIED").length)} icon={<CheckCircle2 size={18}/>} /><Stat label="Awaiting verification" value={String(domains.filter(d=>d.status === "PENDING").length)} icon={<CircleHelp size={18}/>} /></div>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="rounded-lg bg-indigo-50 p-2 text-indigo-700"><Plus size={19}/></div><div><h2 className="font-semibold">Add a domain</h2><p className="mt-1 text-sm text-slate-500">Enter a hostname only — for example, <code className="rounded bg-slate-100 px-1">go.example.com</code>. Do not include https:// or a path.</p></div></div><form onSubmit={addDomain} className="mt-5 flex flex-col gap-3 sm:flex-row"><Input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="go.example.com" aria-label="Custom domain hostname" required maxLength={500}/><Button type="submit" disabled={adding} className="shrink-0">{adding ? <LoaderCircle className="animate-spin" size={16}/> : <Plus size={16}/>} Add domain</Button></form></section>
      {message && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Configured domains</h2><span className="text-sm text-slate-500">{domains.length} total</span></div>
        {loading ? <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/>Loading domains…</div> : domains.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Globe2 className="mx-auto text-slate-400" size={30}/><h3 className="mt-3 font-semibold">No domains yet</h3><p className="mt-1 text-sm text-slate-500">Add a domain above to generate its unique DNS verification challenge.</p></div> : <div className="space-y-4">{domains.map(domain => <article key={domain.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Globe2 size={19}/></div><div><h3 className="font-semibold">{domain.hostname}</h3><p className="mt-1 text-xs text-slate-500">Added {timeLabel(domain.createdAt)}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${domain.status === "VERIFIED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{domain.status === "VERIFIED" ? <CheckCircle2 size={13}/> : <CircleHelp size={13}/>} {domain.status === "VERIFIED" ? "Verified" : "Pending verification"}</span><Button variant="secondary" disabled={workingId===domain.id} onClick={()=>void verify(domain.id)}>{workingId===domain.id ? <LoaderCircle className="animate-spin" size={15}/> : <ShieldCheck size={15}/>} Verify ownership</Button><Button variant="ghost" aria-label={`Remove ${domain.hostname}`} disabled={workingId===domain.id} onClick={()=>void remove(domain.id, domain.hostname)}><Trash2 size={16}/></Button></div></div>
          <div className="grid gap-5 p-5 lg:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. Add this TXT record</p><p className="mt-2 text-sm text-slate-600">Open your DNS provider and create the following record. The token is unique to this hostname.</p><DnsValue label="Type" value="TXT"/><DnsValue label="Name / Host" value={domain.verificationRecordName} onCopy={()=>void copy(domain.verificationRecordName)} copied={copied===domain.verificationRecordName}/><DnsValue label="Value" value={domain.verificationToken} onCopy={()=>void copy(domain.verificationToken)} copied={copied===domain.verificationToken}/><p className="mt-2 text-xs leading-5 text-slate-500">DNS providers may ask for the full hostname or only the relative host label. Follow your provider's format.</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">2. Configure routing (separate step)</p><p className="mt-2 text-sm leading-6 text-slate-600">After ownership is verified, point your hostname at the routing target used by your hosting provider.</p><DnsValue label="Type" value="CNAME (typically for subdomains)"/><DnsValue label="Target" value={domain.routingTarget} onCopy={()=>void copy(domain.routingTarget)} copied={copied===domain.routingTarget}/><div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong>Important:</strong> This is an example target, not a live routing service. DomainGate does not provision edge routing or HTTPS certificates yet. Apex/root domains may require A, ALIAS, or CNAME flattening support.</div><p className="mt-3 text-xs text-slate-500">Last DNS check: {timeLabel(domain.lastCheckedAt)}{domain.verifiedAt ? ` · Verified ${timeLabel(domain.verifiedAt)}` : ""}</p>{domain.lastError && domain.status !== "VERIFIED" && <p className="mt-2 text-xs text-amber-700">Last check: {domain.lastError}</p>}</div></div>
        </article>)}</div>}
      </section>
      <footer className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>DomainGate · Built for learning and extension</span><a className="inline-flex items-center gap-1 hover:text-slate-900" href="https://www.rfc-editor.org/rfc/rfc1035" target="_blank" rel="noreferrer">DNS fundamentals <ExternalLink size={12}/></a></footer>
    </div>
  </main>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between text-slate-500"><span className="text-sm">{label}</span><span>{icon}</span></div><div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div></div>;
}

function DnsValue({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return <div className="mt-3"><p className="mb-1 text-xs font-medium text-slate-500">{label}</p><div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><code className="min-w-0 flex-1 break-all text-xs text-slate-800">{value}</code>{onCopy && <button type="button" aria-label={`Copy ${label}`} onClick={onCopy} className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-900">{copied ? <Check size={14}/> : <Copy size={14}/>}</button>}</div></div>;
}
