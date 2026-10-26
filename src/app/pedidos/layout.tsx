import { AppShell } from "@/components/painel/AppShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
