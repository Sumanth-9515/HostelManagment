// MasterPlanSettings.jsx — edit now calls /api/plans/:id/edit (fixes 404)
import { useState, useEffect } from "react";
import { API } from "../api.js";

export default function MasterPlanSettings() {
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [form,    setForm]    = useState({ name: "", price: "", days: "", beds: "" });

  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState({ name: "", price: "", days: "", beds: "" });
  const [editSaving, setEditSaving] = useState(false);

  const token   = sessionStorage.getItem("token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/plans/all`, { headers });
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch { setError("Failed to load plans."); }
    finally  { setLoading(false); }
  };

  useEffect(() => { loadPlans(); }, []);

  const setF  = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setEF = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    const { name, price, days, beds } = form;
    if (!name || price === "" || !days || !beds) return setError("All fields are required.");
    setError(""); setSaving(true);
    try {
      const res  = await fetch(`${API}/plans`, {
        method: "POST", headers,
        body: JSON.stringify({ name, price: Number(price), days: Number(days), beds: Number(beds) }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || "Failed to create plan.");
      setSuccess("Plan created successfully!");
      setForm({ name: "", price: "", days: "", beds: "" });
      loadPlans();
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Server error."); }
    finally  { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this plan?")) return;
    try {
      await fetch(`${API}/plans/${id}`, { method: "DELETE", headers });
      setPlans(plans.filter(p => p._id !== id));
      setSuccess("Plan deleted."); setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Failed to delete."); }
  };

  const handleToggle = async (id) => {
    try {
      const res  = await fetch(`${API}/plans/${id}/toggle`, { method: "PATCH", headers });
      const data = await res.json();
      if (res.ok) setPlans(plans.map(p => p._id === id ? data.plan : p));
    } catch { setError("Failed to toggle."); }
  };

  const startEdit = (plan) => {
    setEditingId(plan._id);
    setEditForm({ name: plan.name, price: plan.price, days: plan.days, beds: plan.beds });
    setError(""); setSuccess("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", price: "", days: "", beds: "" });
  };

  // ── FIX: calls /api/plans/:id/edit — avoids collision with /toggle ───────────
  const handleEdit = async (id) => {
    const { name, price, days, beds } = editForm;
    if (!name || price === "" || !days || !beds) return setError("All edit fields are required.");
    setError(""); setEditSaving(true);
    try {
      const res  = await fetch(`${API}/plans/${id}/edit`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name, price: Number(price), days: Number(days), beds: Number(beds) }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || "Failed to update plan.");
      setPlans(plans.map(p => p._id === id ? data.plan : p));
      setSuccess("Plan updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
      cancelEdit();
    } catch { setError("Server error while saving."); }
    finally  { setEditSaving(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .mps-root { font-family: 'Plus Jakarta Sans', sans-serif; padding: 32px 28px; max-width: 880px; margin: 0 auto; }
        .mps-header { margin-bottom: 28px; }
        .mps-header h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
        .mps-header p  { font-size: 13.5px; color: #94a3b8; margin-top: 4px; }

        .mps-form-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px 22px; margin-bottom: 28px; }
        .mps-form-card h2 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 18px; }
        .mps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; margin-bottom: 16px; }
        .mps-field { display: flex; flex-direction: column; gap: 5px; }
        .mps-lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8; }
        .mps-inp { padding: 10px 13px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; background: #f8f9fc; border: 1.5px solid #e2e8f0; border-radius: 9px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .mps-inp:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: #fff; }
        .mps-hint { font-size: 11px; color: #94a3b8; margin-top: 2px; }

        .mps-btn { padding: 10px 22px; border-radius: 9px; border: none; font-size: 13.5px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s; }
        .mps-btn.primary { background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; box-shadow: 0 3px 12px rgba(79,70,229,0.28); }
        .mps-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(79,70,229,0.38); }
        .mps-btn.save { background: linear-gradient(135deg,#10b981,#34d399); color: #fff; box-shadow: 0 3px 10px rgba(16,185,129,0.28); }
        .mps-btn.save:hover { transform: translateY(-1px); }
        .mps-btn.cancel { background: #f1f5f9; color: #475569; box-shadow: none; }
        .mps-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }
        .mps-spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: mps-rot 0.65s linear infinite; }
        @keyframes mps-rot { to { transform: rotate(360deg); } }

        .mps-alert { padding: 10px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; margin-bottom: 14px; }
        .mps-alert.err { background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48; }
        .mps-alert.ok  { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }

        .mps-plans-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 14px; }
        .mps-plans-grid { display: flex; flex-direction: column; gap: 12px; }

        .mps-plan-row { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 13px; overflow: hidden; transition: border-color 0.2s; }
        .mps-plan-row.inactive { opacity: 0.55; }
        .mps-plan-row.editing  { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

        .mps-plan-row-view { padding: 16px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .mps-plan-info   { flex: 1; min-width: 150px; }
        .mps-plan-name   { font-size: 15px; font-weight: 700; color: #0f172a; }
        .mps-plan-sub    { font-size: 12.5px; color: #64748b; margin-top: 2px; }
        .mps-plan-price  { font-size: 20px; font-weight: 800; color: #4f46e5; min-width: 76px; text-align: right; }
        .mps-plan-price.free { color: #10b981; }
        .mps-plan-tags   { display: flex; gap: 7px; flex-wrap: wrap; }
        .mps-tag { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
        .mps-tag.beds     { background: #eef2ff; color: #4f46e5; }
        .mps-tag.days     { background: #f0fdf4; color: #16a34a; }
        .mps-tag.active   { background: #d1fae5; color: #065f46; }
        .mps-tag.inactive { background: #f1f5f9; color: #94a3b8; }
        .mps-plan-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .mps-act-btn { padding: 7px 13px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: opacity 0.18s; }
        .mps-act-btn.edit   { background: #eef2ff; color: #4f46e5; }
        .mps-act-btn.toggle { background: #f1f5f9; color: #475569; }
        .mps-act-btn.del    { background: #fff1f2; color: #e11d48; }
        .mps-act-btn:hover  { opacity: 0.75; }

        .mps-plan-row-edit { padding: 18px 20px; background: #fafbff; border-top: 1.5px solid #c7d2fe; }
        .mps-edit-title { font-size: 13px; font-weight: 700; color: #4f46e5; margin-bottom: 14px; }
        .mps-edit-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .mps-edit-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .mps-empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; background: #f8f9fc; border-radius: 12px; border: 1.5px dashed #e2e8f0; }
      `}</style>

      <div className="mps-root">
        <div className="mps-header">
          <h1>📋 Plan Settings</h1>
          <p>Create, edit, and manage subscription plans shown on the landing page.</p>
        </div>

        {error   && <div className="mps-alert err">⚠️ {error}</div>}
        {success && <div className="mps-alert ok">✅ {success}</div>}

        {/* ── Create new plan ── */}
        <div className="mps-form-card">
          <h2>➕ Create New Plan</h2>
          <form onSubmit={handleCreate}>
            <div className="mps-grid">
              <div className="mps-field">
                <label className="mps-lbl">Plan Name</label>
                <input className="mps-inp" value={form.name} onChange={setF("name")} placeholder="e.g. Starter" />
              </div>
              <div className="mps-field">
                <label className="mps-lbl">Price (INR)</label>
                <input type="number" min="0" className="mps-inp" value={form.price} onChange={setF("price")} placeholder="0 for Free" />
                <span className="mps-hint">Enter 0 for a free plan</span>
              </div>
              <div className="mps-field">
                <label className="mps-lbl">Days</label>
                <input type="number" min="1" className="mps-inp" value={form.days} onChange={setF("days")} placeholder="e.g. 30" />
                <span className="mps-hint">Subscription duration</span>
              </div>
              <div className="mps-field">
                <label className="mps-lbl">Beds Count</label>
                <input type="number" min="1" className="mps-inp" value={form.beds} onChange={setF("beds")} placeholder="e.g. 50" />
                <span className="mps-hint">Max beds allowed</span>
              </div>
            </div>
            <button type="submit" className="mps-btn primary" disabled={saving}>
              {saving && <div className="mps-spin" />}
              {saving ? "Creating…" : "Create Plan"}
            </button>
          </form>
        </div>

        {/* ── Plans list ── */}
        <div className="mps-plans-title">
          🗂 All Plans &nbsp;<span style={{ fontWeight:400, color:"#94a3b8", fontSize:13 }}>({plans.length})</span>
        </div>

        {loading ? (
          <div className="mps-empty">Loading plans…</div>
        ) : plans.length === 0 ? (
          <div className="mps-empty">No plans yet. Create your first plan above.</div>
        ) : (
          <div className="mps-plans-grid">
            {plans.map(plan => (
              <div
                key={plan._id}
                className={`mps-plan-row ${plan.isActive ? "" : "inactive"} ${editingId === plan._id ? "editing" : ""}`}
              >
                {/* Normal view row */}
                <div className="mps-plan-row-view">
                  <div className="mps-plan-info">
                    <div className="mps-plan-name">{plan.name}</div>
                    <div className="mps-plan-sub">Created {new Date(plan.createdAt).toLocaleDateString("en-IN")}</div>
                  </div>
                  <div className="mps-plan-tags">
                    <span className="mps-tag beds">🛏 {plan.beds} beds</span>
                    <span className="mps-tag days">📅 {plan.days} days</span>
                    <span className={`mps-tag ${plan.isActive ? "active" : "inactive"}`}>{plan.isActive ? "Active" : "Hidden"}</span>
                  </div>
                  <div className={`mps-plan-price ${plan.isFree ? "free" : ""}`}>
                    {plan.isFree ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                  </div>
                  <div className="mps-plan-actions">
                    {editingId !== plan._id ? (
                      <>
                        <button className="mps-act-btn edit"   onClick={() => startEdit(plan)}>✏️ Edit</button>
                        <button className="mps-act-btn toggle" onClick={() => handleToggle(plan._id)}>{plan.isActive ? "Hide" : "Show"}</button>
                        <button className="mps-act-btn del"    onClick={() => handleDelete(plan._id)}>Delete</button>
                      </>
                    ) : (
                      <span style={{ fontSize:12, color:"#6366f1", fontWeight:700 }}>✏️ Editing…</span>
                    )}
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === plan._id && (
                  <div className="mps-plan-row-edit">
                    <div className="mps-edit-title">✏️ Editing: {plan.name}</div>
                    <div className="mps-edit-grid">
                      <div className="mps-field">
                        <label className="mps-lbl">Plan Name</label>
                        <input className="mps-inp" value={editForm.name} onChange={setEF("name")} />
                      </div>
                      <div className="mps-field">
                        <label className="mps-lbl">Price (INR)</label>
                        <input type="number" min="0" className="mps-inp" value={editForm.price} onChange={setEF("price")} />
                      </div>
                      <div className="mps-field">
                        <label className="mps-lbl">Days</label>
                        <input type="number" min="1" className="mps-inp" value={editForm.days} onChange={setEF("days")} />
                      </div>
                      <div className="mps-field">
                        <label className="mps-lbl">Beds Count</label>
                        <input type="number" min="1" className="mps-inp" value={editForm.beds} onChange={setEF("beds")} />
                      </div>
                    </div>
                    <div className="mps-edit-actions">
                      <button className="mps-btn save" disabled={editSaving} onClick={() => handleEdit(plan._id)}>
                        {editSaving && <div className="mps-spin" />}
                        {editSaving ? "Saving…" : "💾 Save Changes"}
                      </button>
                      <button className="mps-btn cancel" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}