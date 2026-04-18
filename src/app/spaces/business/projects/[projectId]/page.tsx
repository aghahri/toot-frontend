'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { fetchBusinessProject } from '@/lib/businessSpace';
import { LinkCapabilityModal } from '@/components/capability/LinkCapabilityModal';

function ProjectDetailInner() {
  const params = useParams();
  const sp = useSearchParams();
  const projectId = typeof params?.projectId === 'string' ? params.projectId : '';
  const networkId = sp.get('networkId')?.trim() || '';
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchBusinessProject>> | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    try {
      setData(await fetchBusinessProject(projectId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  async function addTask() {
    const token = getAccessToken();
    if (!token || !projectId || !taskTitle.trim()) return;
    await apiFetch(`business/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: taskTitle.trim() }),
    });
    setTaskTitle('');
    void load();
  }

  async function bumpTask(taskId: string, status: string) {
    const token = getAccessToken();
    if (!token || !projectId) return;
    await apiFetch(`business/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  return (
    <main className="theme-page-bg mx-auto max-w-md space-y-4 px-4 pb-16 pt-4" dir="rtl">
      <Link href={networkId ? `/spaces/business/projects?networkId=${encodeURIComponent(networkId)}` : '/spaces/business'}>←</Link>
      {err ? <p className="text-red-600">{err}</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-black">{data.title}</h1>
          {data.description ? <p className="text-sm text-[var(--text-secondary)]">{data.description}</p> : null}
          <p className="text-xs">وضعیت: {data.status}</p>
          {networkId ? (
            <button type="button" onClick={() => setLinkOpen(true)} className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent-contrast)]">
              اشتراک در جامعه
            </button>
          ) : null}
          <h2 className="text-sm font-black">وظایف</h2>
          <div className="flex gap-2">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="عنوان وظیفه"
              className="min-w-0 flex-1 rounded-xl border px-2 py-2 text-sm"
            />
            <button type="button" onClick={() => void addTask()} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white">
              افزودن
            </button>
          </div>
          <ul className="space-y-2">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2 text-sm">
                <span>{t.title}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{t.status}</span>
                <div className="flex gap-1">
                  <button type="button" className="text-[10px] underline" onClick={() => void bumpTask(t.id, 'TODO')}>
                    todo
                  </button>
                  <button type="button" className="text-[10px] underline" onClick={() => void bumpTask(t.id, 'DOING')}>
                    doing
                  </button>
                  <button type="button" className="text-[10px] underline" onClick={() => void bumpTask(t.id, 'DONE')}>
                    done
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        !err && <p>…</p>
      )}
      {networkId && projectId ? (
        <LinkCapabilityModal
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          networkId={networkId}
          capabilityType="PROJECT"
          capabilityId={projectId}
          sourceSpaceCategory="PUBLIC_GENERAL"
        />
      ) : null}
    </main>
  );
}

export default function ProjectDetailPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <ProjectDetailInner />
      </Suspense>
    </AuthGate>
  );
}
