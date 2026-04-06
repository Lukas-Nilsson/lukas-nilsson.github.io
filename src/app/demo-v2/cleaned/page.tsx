import { redirect } from "next/navigation";
import { createCleanedServerClient } from "@/lib/cleaned-v2/supabase-server";
import { CleanedChatApp } from "@/components/cleaned-v2/cleaned-chat-app";

export default async function CleanedV2Page() {
  const supabase = await createCleanedServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/demo-v2/cleaned/login");
  }

  return <CleanedChatApp viewerEmail={user.email ?? ""} />;
}
