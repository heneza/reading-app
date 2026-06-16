import Link from 'next/link';
import { redirect } from 'next/navigation';
import Avatar from '@/components/Avatar';
import PendingButton from '@/components/PendingButton';
import { updateReportStatus } from '@/app/actions/reports';
import { timeAgo } from '@/lib/time';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function targetHref(type: string, id: string) {
  switch (type) {
    case 'post':
      return '/';
    case 'club':
      return `/clubs/${id}`;
    case 'club_post':
      return `/clubs`;
    case 'list':
      return `/list/${id}`;
    case 'profile':
      return `/u/${id}`;
    default:
      return null;
  }
}

export default async function ModerationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings/moderation');

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) redirect('/settings');

  const { data: reports } = await supabase
    .from('content_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80);

  const reporterIds = Array.from(new Set((reports ?? []).map((report: any) => report.reporter_id)));
  const reporters = new Map<string, any>();
  if (reporterIds.length) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', reporterIds);
    (data ?? []).forEach((profile: any) => reporters.set(profile.id, profile));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Moderation</h1>

      {(reports ?? []).length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
          No reports yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {(reports ?? []).map((report: any) => {
            const reporter = reporters.get(report.reporter_id);
            const href = targetHref(report.target_type, report.target_id);
            return (
              <li key={report.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Avatar src={reporter?.avatar_url} name={reporter?.display_name ?? reporter?.username ?? 'reader'} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-stone-800">{report.target_type}</span>
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">{report.reason}</span>
                      <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] text-stone-500">{report.status}</span>
                      <span className="text-xs text-stone-400">{timeAgo(report.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Reported by {reporter?.username ? `@${reporter.username}` : 'a reader'}
                    </p>
                    {report.details && <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">{report.details}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {href && (
                        <Link href={href} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-brand hover:text-brand">
                          Open target
                        </Link>
                      )}
                      {report.status === 'open' && (
                        <>
                          <form action={updateReportStatus}>
                            <input type="hidden" name="reportId" value={report.id} />
                            <input type="hidden" name="status" value="reviewed" />
                            <PendingButton pendingLabel="..." className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-white">
                              Reviewed
                            </PendingButton>
                          </form>
                          <form action={updateReportStatus}>
                            <input type="hidden" name="reportId" value={report.id} />
                            <input type="hidden" name="status" value="dismissed" />
                            <PendingButton pendingLabel="..." className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-brand hover:text-brand">
                              Dismiss
                            </PendingButton>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
