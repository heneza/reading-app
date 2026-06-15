import { redirect } from 'next/navigation';
import MessageSidebar from '@/components/MessageSidebar';
import { loadMessageSidebarItems } from '@/lib/message-sidebar';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/messages');

  const sidebarItems = await loadMessageSidebarItems(supabase, user.id);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold">Messages</h1>

      <div className="grid gap-4 md:grid-cols-[19rem_minmax(0,1fr)]">
        <MessageSidebar items={sidebarItems} />
        <section className="hidden min-h-[22rem] items-center justify-center rounded-lg border border-stone-200 bg-white p-6 text-center md:flex">
          <div>
            <h2 className="text-lg font-semibold">Select a chat</h2>
            <p className="mt-1 text-sm text-stone-500">Search or pick someone from the left.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
