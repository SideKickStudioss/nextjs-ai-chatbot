// app/chat/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next'; // or your own auth helper
import Chat from '@/components/Chat';
import DataStreamHandler from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';

export default async function ChatPage() {
  const session = await getServerSession();
  if (!session) {
    // Redirect unauthenticated users to a guest login route
    redirect('/api/auth/guest');
  }

  const id = generateUUID();
  const cookieStore = cookies();
  const model = cookieStore.get('chat-model');

  if (!model) {
    return (
      <>
        <Chat id={id} initialChatModel={DEFAULT_CHAT_MODEL}
              initialMessages={[]} initialVisibilityType="private" autoResume={false} isReady={false} />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <Chat id={id} initialChatModel={model.value}
          initialMessages={[]} initialVisibilityType="private" autoResume={false} />
  );
}
