// frontend/src/components/SupabaseManager.jsx
import React, { useState, useEffect } from "react";
import {
  fetchSupabaseStatus,
  fetchSupabaseItems,
  createSupabaseItem,
  updateSupabaseItem,
  deleteSupabaseItem
} from "../services/api";

const SupabaseManager = () => {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [crudError, setCrudError] = useState(null);
  const [crudSuccess, setCrudSuccess] = useState(null);

  const checkStatus = async () => {
    setStatusLoading(true);
    try {
      const data = await fetchSupabaseStatus();
      setStatus(data);
      if (data.connected && data.table_exists) {
        loadItems();
      }
    } catch (err) {
      console.error("Failed to check Supabase status:", err);
      setStatus({
        connected: false,
        url: null,
        using_fallback: true,
        table_exists: false,
        error: err.message
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const loadItems = async () => {
    setItemsLoading(true);
    setCrudError(null);
    try {
      const list = await fetchSupabaseItems();
      setItems(list);
    } catch (err) {
      setCrudError(err.response?.data?.detail || "Failed to load database records.");
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setCrudError(null);
    setCrudSuccess(null);
    try {
      await createSupabaseItem(newItemName.trim());
      setNewItemName("");
      setCrudSuccess("Successfully created new record!");
      loadItems();
    } catch (err) {
      setCrudError(err.response?.data?.detail || "Insertion failed.");
    }
  };

  const handleUpdate = async (itemId) => {
    if (!editingItemName.trim()) return;
    setCrudError(null);
    setCrudSuccess(null);
    try {
      await updateSupabaseItem(itemId, editingItemName.trim());
      setEditingItemId(null);
      setEditingItemName("");
      setCrudSuccess("Successfully updated record!");
      loadItems();
    } catch (err) {
      setCrudError(err.response?.data?.detail || "Update failed.");
    }
  };

  const handleDelete = async (itemId) => {
    if (!confirm("Are you sure you want to delete this record from Supabase?")) return;
    setCrudError(null);
    setCrudSuccess(null);
    try {
      await deleteSupabaseItem(itemId);
      setCrudSuccess("Record deleted successfully.");
      loadItems();
    } catch (err) {
      setCrudError(err.response?.data?.detail || "Deletion failed.");
    }
  };

  return (
    <div className="space-y-6 text-left font-mono">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
        <div>
          <h2 className="text-sm text-[var(--accent-color)] font-bold uppercase tracking-wider">
            [Supabase Cloud Integrator]
          </h2>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase font-semibold">
            Query and manage PostgreSQL records directly through backend middleware proxy.
          </p>
        </div>
        <button
          onClick={checkStatus}
          disabled={statusLoading}
          className="text-[10px] bg-zinc-900 border border-zinc-800 text-[var(--accent-color)] hover:bg-zinc-800 px-3 py-1 rounded transition uppercase font-bold disabled:opacity-50"
        >
          {statusLoading ? "PINGING SERVER..." : "REFRESH DIAGNOSTICS"}
        </button>
      </div>

      {/* Diagnostics Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Badge card */}
        <div className="border border-zinc-900 bg-zinc-950 p-4 rounded flex flex-col justify-between space-y-2">
          <span className="text-[10px] text-zinc-500 uppercase font-semibold block">INTEGRATION STATE</span>
          {statusLoading ? (
            <div className="text-xs text-zinc-400 animate-pulse">READING CREDENTIALS...</div>
          ) : status?.connected && status?.table_exists ? (
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-1 border border-green-500/30 text-green-400 bg-green-950/20 text-[10px] uppercase font-bold rounded animate-pulse">
                ✓ LIVE CONNECTION
              </span>
              <div className="text-[10px] text-zinc-400 truncate">URL: {status.url}</div>
            </div>
          ) : status?.connected ? (
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-1 border border-yellow-500/30 text-yellow-400 bg-yellow-950/20 text-[10px] uppercase font-bold rounded">
                ⚠ TABLE MISSING
              </span>
              <div className="text-[10px] text-zinc-400">Database connected, but `items` table is missing. See setup steps on the right.</div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-1 border border-red-500/30 text-red-500 bg-red-950/20 text-[10px] uppercase font-bold rounded">
                ✖ DUMMY CLIENT FALLBACK
              </span>
              <div className="text-[9px] text-zinc-500 uppercase leading-relaxed">
                Provide credentials in environment variables files.
              </div>
            </div>
          )}
        </div>

        {/* Database environment config */}
        <div className="border border-zinc-900 bg-zinc-950 p-4 rounded space-y-2 md:col-span-2">
          <span className="text-[10px] text-zinc-500 uppercase font-semibold block">ENVIRONMENT CONFIGURATION LEDGER</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-zinc-400">
            <div>
              <span className="text-zinc-600 block">backend/.env:</span>
              <span className={status?.connected ? "text-green-500 font-bold" : "text-zinc-500"}>
                {status?.connected ? "✓ SUPABASE_URL & ANON_KEY ACTIVE" : "✖ USING DUMMY / PLACEHOLDERS"}
              </span>
            </div>
            <div>
              <span className="text-zinc-600 block">frontend/.env.local:</span>
              <span className="text-zinc-500">
                VITE_SUPABASE_URL config loaded
              </span>
            </div>
          </div>
          {status?.error && (
            <div className="mt-2 text-[9px] text-red-500 border border-red-500/20 bg-red-950/10 p-2 rounded max-h-[60px] overflow-y-auto font-mono">
              [DB ERROR]: {status.error}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: CRUD UI (or instructions if no table/connection) */}
        <div className="lg:col-span-7 space-y-4">
          {crudError && (
            <div className="border border-red-500 bg-red-950/20 text-red-500 font-mono text-xs p-3 rounded">
              [CRUD ERROR]: {crudError}
            </div>
          )}
          {crudSuccess && (
            <div className="border border-green-500 bg-green-950/20 text-green-500 font-mono text-xs p-3 rounded">
              [SUCCESS]: {crudSuccess}
            </div>
          )}

          {/* Form and ledger */}
          <div className="border border-zinc-900 bg-zinc-950 p-5 rounded space-y-4">
            <h3 className="text-xs text-[var(--accent-color)] font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
              [PostgreSQL items Ledger]
            </h3>

            {/* Create Item Form */}
            {status?.connected && status?.table_exists ? (
              <form onSubmit={handleCreate} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter new item name..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="bg-black text-[var(--accent-color)] border border-zinc-900 text-xs px-3 py-2 rounded focus:border-[var(--accent-color)] focus:outline-none flex-1 font-mono"
                />
                <button
                  type="submit"
                  disabled={!newItemName.trim()}
                  className="bg-[var(--btn-bg)] hover:opacity-90 text-[var(--btn-text)] uppercase font-bold px-4 py-2 text-xs transition rounded disabled:opacity-40"
                >
                  Insert Record
                </button>
              </form>
            ) : null}

            {/* Items List */}
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs border-collapse text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-left">
                    <th className="py-2 px-2 uppercase text-[9px]">ID</th>
                    <th className="py-2 px-2 uppercase text-[9px]">Name</th>
                    <th className="py-2 px-2 uppercase text-[9px]">Created Timestamp</th>
                    <th className="py-2 px-2 uppercase text-[9px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!status?.connected || !status?.table_exists ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-zinc-600 uppercase font-mono text-[10px]">
                        [Database Connection Required to Load Records Ledger]
                      </td>
                    </tr>
                  ) : itemsLoading ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-zinc-500 animate-pulse uppercase">
                        [Streaming records from Supabase...]
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-zinc-600 uppercase font-mono">
                        [Table is empty. Add your first item above!]
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900/60 hover:bg-zinc-900/10">
                        <td className="py-3 px-2 text-[var(--accent-color)] font-bold font-mono">
                          {item.id}
                        </td>
                        <td className="py-3 px-2 font-mono">
                          {editingItemId === item.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingItemName}
                                onChange={(e) => setEditingItemName(e.target.value)}
                                className="bg-black text-[var(--accent-color)] border border-zinc-800 text-xs px-2 py-1 rounded focus:outline-none focus:border-[var(--accent-color)] font-mono"
                              />
                              <button
                                onClick={() => handleUpdate(item.id)}
                                className="text-green-500 hover:text-white px-2 py-0.5 border border-zinc-800 hover:bg-zinc-900 rounded text-[9px] uppercase font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItemId(null);
                                  setEditingItemName("");
                                }}
                                className="text-zinc-500 hover:text-white px-2 py-0.5 border border-zinc-800 hover:bg-zinc-900 rounded text-[9px] uppercase font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-white font-semibold">{item.name}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-[10px] text-zinc-500">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-3 px-2 text-right relative">
                          <div className="flex items-center justify-end space-x-2">
                            {editingItemId !== item.id && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditingItemName(item.name);
                                  }}
                                  className="border border-zinc-800 hover:border-[var(--accent-color)]/50 text-[9px] text-zinc-500 hover:text-[var(--accent-color)] px-2 py-0.5 rounded font-mono uppercase"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="border border-zinc-800 hover:border-red-500/50 text-[9px] text-zinc-500 hover:text-red-500 px-2 py-0.5 rounded font-mono uppercase"
                                >
                                  Wipe
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Setup instructions and SQL script */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border border-zinc-900 bg-zinc-950 p-5 rounded space-y-3 font-mono">
            <h3 className="text-xs text-[var(--accent-color)] font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
              [SUPABASE DDL INITIALIZATION SCRIPT]
            </h3>
            <p className="text-[10px] text-zinc-400 leading-relaxed uppercase">
              Run the following SQL snippet inside your Supabase project's SQL Editor to set up the appropriate tables:
            </p>
            <pre className="bg-zinc-950 p-3 rounded text-zinc-300 overflow-x-auto text-[9px] border border-zinc-900 leading-relaxed font-mono select-all">
              {`-- 1. Create table 'items' in public schema
CREATE TABLE IF NOT EXISTS public.items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;

-- 2. Create table 'models' in public schema for registry storage
CREATE TABLE IF NOT EXISTS public.models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    algorithm_variant TEXT DEFAULT 'Unknown',
    task_type TEXT DEFAULT 'unknown',
    features JSONB DEFAULT '[]'::jsonb,
    n_features_in_ INTEGER DEFAULT 0,
    target_name TEXT DEFAULT 'target',
    metrics JSONB DEFAULT '{}'::jsonb,
    classes JSONB DEFAULT '[]'::jsonb,
    colab_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    modified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.models DISABLE ROW LEVEL SECURITY;
`}
            </pre>
            <div className="text-[9px] text-zinc-600 bg-black/40 p-2.5 border border-zinc-900 rounded leading-relaxed">
              * CRITICAL NOTE: In your Supabase Storage dashboard, create a new bucket named <code className="text-zinc-400 font-bold">models</code>, mark it as <strong className="text-zinc-400">Public</strong>, and ensure Row Level Security (RLS) policies allow upload and download access.
            </div>
          </div>

          <div className="border border-zinc-900 bg-zinc-950 p-5 rounded space-y-3 font-mono">
            <h3 className="text-xs text-[var(--accent-color)] font-bold uppercase tracking-wider border-b border-zinc-900 pb-2">
              [DEPLOYMENT INTEGRATION MANUAL]
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-[10px] text-zinc-400">
              <li>
                <span className="font-bold text-white uppercase">Obtain API Access Tokens:</span>
                <p className="pl-4 mt-0.5 text-zinc-500 uppercase">Go to your Supabase Project Dashboard &gt; Project Settings &gt; API. Copy Project URL and public anon key.</p>
              </li>
              <li>
                <span className="font-bold text-white uppercase">Sync Local Environment:</span>
                <p className="pl-4 mt-0.5 text-zinc-500 uppercase">Write variables into <code className="text-zinc-300">backend/.env</code> and <code className="text-zinc-300">frontend/.env.local</code>.</p>
              </li>
              <li>
                <span className="font-bold text-white uppercase">Restart Development Servers:</span>
                <p className="pl-4 mt-0.5 text-zinc-500 uppercase">Make sure to restart uvicorn and npm dev processes to load the new config environment.</p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupabaseManager;
