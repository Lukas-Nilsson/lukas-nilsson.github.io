import { redirect } from "next/navigation";
import { createCleanedServerClient } from "@/lib/cleaned-v2/supabase-server";
import { CleanedChatApp } from "@/components/cleaned-v2/cleaned-chat-app";

export default async function CleanedV2JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createCleanedServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/demo-v2/cleaned/login?redirect=/demo-v2/cleaned/jobs/${jobId}`);
  }

  return <CleanedChatApp viewerEmail={user.email ?? ""} initialJobId={jobId} />;
}
