import { listChannels } from "@/server/actions/chat";
import { ChatScreen } from "@/components/chat/chat-screen";

export const metadata = { title: "Chat" };

export default async function ChatPage() {
  const channels = await listChannels();
  return (
    <ChatScreen
      initialChannels={channels}
      initialChannelId={channels[0]?.id ?? null}
    />
  );
}
