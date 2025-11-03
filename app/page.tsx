"use client";


import { useEffect, useMemo, useState } from "react";

type Row = {
  teacherId: string;
  teacherName: string;
  dept: string | null;
  avgOverall: number | string | null; // ← 放宽为 number|string|null
  reviewCount: number;
};

type ApiResp = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
};

function useDebouncedValue<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function Page() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [error, setError] = useState<string | null>(null);

  const dq = useDebouncedValue(q, 300);

  // 页码在关键条件变化时重置
  useEffect(() => {
    setPage(1);
  }, [dq, pageSize]);

  useEffect(() => {

    let aborted = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (dq) params.set("q", dq);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        const res = await fetch(`/api/teachers/search?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResp = await res.json();
	// 把 string 的 avgOverall 转成 number（非法值置为 null）
	json.items = json.items.map((i) => ({
  	...i,
  	avgOverall:
    	i.avgOverall === null || i.avgOverall === undefined
      	? null
      	: Number.isFinite(Number(i.avgOverall))
        	? Number(i.avgOverall)
        	: null,
	}));

	if (!aborted) setData(json);

      } catch (e: any) {
        if (!aborted) setError(e?.message ?? "请求失败");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [dq, page, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(data.total / data.pageSize)), [data.total, data.pageSize]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">老师综合评分查询</h1>

      <div className="flex items-center gap-3 mb-4">
        <input
          className="flex-1 rounded-md border border-neutral-700 bg-transparent px-3 py-2 outline-none"
          placeholder="输入老师姓名关键字，例如：张"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-md border border-neutral-700 bg-transparent px-2 py-2"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              每页 {n}
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm text-neutral-400 mb-2">
        {loading ? "加载中…" : `共 ${data.total} 位老师`}
        {dq ? `（关键字：${dq}）` : ""}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900/60">
            <tr>
              <th className="px-4 py-2 text-left">老师</th>
              <th className="px-4 py-2 text-left">院系</th>

              <th className="px-4 py-2 text-right">综合分</th>
              <th className="px-4 py-2 text-right">评价数</th>
            </tr>
          </thead>
         <tbody>
 	  {data.items.length === 0 && !loading ? (
    	 <tr>
      	 <td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
       	  没有找到结果
      	 </td>
    	 </tr>
  	 ) : (
    	 data.items.map((r, idx) => (
      	 <tr key={`${r.teacherId}-${idx}`} className="border-t border-neutral-800">
                 <td className="px-4 py-2">{r.teacherName}</td>
                 <td className="px-4 py-2">{r.dept ?? "-"}</td>
		 <td className="px-4 py-2 text-right">
 		 {typeof r.avgOverall === "number" ? r.avgOverall.toFixed(2) : "-"}
		 </td>
        	 <td className="px-4 py-2 text-right">{r.reviewCount}</td>
      	 </tr>
    	 ))
	   )}
	 </tbody>
        </table>
      </div>

      {/* 分页器 */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-neutral-400">
          第 {data.page} / {totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-neutral-700 px-3 py-1 disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <button
            className="rounded-md border border-neutral-700 px-3 py-1 disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-red-400">出错了：{error}</div>}
    </div>
  );
}

