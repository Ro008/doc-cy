import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { email?: string; error?: string };
};

export default function ForgotPasswordPage({ searchParams }: PageProps) {
  return (
    <ForgotPasswordForm
      initialEmail={String(searchParams?.email ?? "").trim()}
      invalidLink={searchParams?.error === "invalid"}
    />
  );
}
