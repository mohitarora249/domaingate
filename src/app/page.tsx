import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import { Login } from "@/components/login";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <Login />;
  return <Dashboard email={session.email} />;
}
