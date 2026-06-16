'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

const TARGETS = new Set(['post', 'review', 'comment', 'club', 'club_post', 'profile', 'list']);

export async function reportContent(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const targetType = String(formData.get('targetType') ?? '');
  const targetId = String(formData.get('targetId') ?? '');
  const reason = String(formData.get('reason') ?? 'other').slice(0, 60);
  const details = String(formData.get('details') ?? '').trim().slice(0, 600) || null;
  const next = String(formData.get('next') ?? '/');
  if (!TARGETS.has(targetType) || !targetId) return;

  await supabase.from('content_reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    details,
  });

  revalidatePath(next);
}

export async function updateReportStatus(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return;

  const reportId = String(formData.get('reportId') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!reportId || !['reviewed', 'dismissed'].includes(status)) return;

  await supabase
    .from('content_reports')
    .update({ status })
    .eq('id', reportId);
  revalidatePath('/settings/moderation');
}
