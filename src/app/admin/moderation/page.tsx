'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type PostRow = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; username: string };
};

type PostsPage = { data: PostRow[]; meta: { hasMore: boolean; limit: number; offset: number; total: number } };

type ReportRow = {
  id: string;
  reason: string;
  messageType: string;
  createdAt: string;
  reporter: { name: string; username: string };
};

type ReportsPage = { data: ReportRow[]; meta: { hasMore: boolean; limit: number; offset: number; total: number } };

export default function AdminModerationPage() {
  const [tab, setTab] = useState<'posts' | 'reports'>('posts');
  const [posts, setPosts] = useState<PostsPage | null>(null);
  const [reports, setReports] = useState<ReportsPage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      const res = await apiFetch<PostsPage>('admin/posts?limit=30&offset=0', { method: 'GET', token });
      setPosts(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  const loadReports = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      const res = await apiFetch<ReportsPage>('admin/reports?limit=30&offset=0', { method: 'GET', token });
      setReports(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    if (tab === 'posts') void loadPosts();
    else void loadReports();
  }, [tab, loadPosts, loadReports]);

  async function deletePost(id: string) {
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE', token });
      setConfirmId(null);
      void loadPosts();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Moderation</h1>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('posts')}
          className={`rounded px-3 py-1 text-sm ${tab === 'posts' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}
        >
          Posts
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`rounded px-3 py-1 text-sm ${tab === 'reports' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}
        >
          Message reports
        </button>
      </div>
      {err ? <p className="mt-4 text-red-400">{err}</p> : null}

      {tab === 'posts' && posts && (
        <ul className="mt-6 space-y-3">
          {posts.data.map((p) => (
            <li key={p.id} className="rounded border border-slate-800 p-3 text-sm">
              <p className="text-xs text-slate-500">
                @{p.user.username} · {new Date(p.createdAt).toISOString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-200">{p.text}</p>
              <div className="mt-2 flex gap-2">
                {confirmId === p.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void deletePost(p.id)}
                      className="rounded bg-red-700 px-2 py-1 text-xs text-white"
                    >
                      Confirm delete
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="text-xs text-slate-400">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(p.id)}
                    className="rounded border border-red-800 px-2 py-1 text-xs text-red-300"
                  >
                    Delete post…
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'reports' && reports && (
        <ul className="mt-6 space-y-3">
          {reports.data.map((r) => (
            <li key={r.id} className="rounded border border-slate-800 p-3 text-sm text-slate-300">
              <p className="text-xs text-slate-500">
                {r.messageType} · @{r.reporter.username} · {new Date(r.createdAt).toISOString()}
              </p>
              <p className="mt-1 font-medium text-amber-200">{r.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
