// ── DATA ACCESS ───────────────────────────────────────────────────────────────
// Every read and write the app performs, in the shapes App.jsx already expects.
// Row-level security in supabase/schema.sql is what actually restricts access;
// this layer just keeps the query building in one place.

import { rest, rpc, currentUserId } from "./supabaseClient.js";

const num = (v) => Number(v) || 0;
const enc = (v) => encodeURIComponent(v);

// ── PROFILE ──────────────────────────────────────────────────────────────────
const AVATARS = ["🧑‍🎓", "👩‍💻", "🧑‍🎨", "👩‍🔬", "🧑‍🍳", "👩‍🎤"];
const COLORS = ["#7c5cfc", "#ff6b9d", "#00d4aa", "#ffd60a", "#4fc3f7", "#66bb6a"];

export function randomIdentity() {
  return {
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function toProfile(row) {
  return {
    id: row.id,
    name: row.name || (row.email || "").split("@")[0],
    email: row.email || "",
    avatar: row.avatar || "🧑‍💻",
    color: row.color || "#7c5cfc",
    budget: num(row.budget),
  };
}

export async function loadProfile(authUser) {
  const rows = await rest(`/profiles?id=eq.${authUser.id}&select=*&limit=1`);
  if (rows?.length) return toProfile(rows[0]);

  // The sign-up trigger should have made this row. If a project was set up
  // before the trigger existed, create it now so the app still works.
  const meta = authUser.user_metadata || {};
  const created = await rest("/profiles", {
    method: "POST",
    prefer: "return=representation",
    body: [{
      id: authUser.id,
      email: authUser.email,
      name: meta.name || (authUser.email || "").split("@")[0],
      avatar: meta.avatar || "🧑‍💻",
      color: meta.color || "#7c5cfc",
    }],
  });
  return toProfile(created[0]);
}

export async function setBudget(amount) {
  const id = currentUserId();
  await rest(`/profiles?id=eq.${id}`, {
    method: "PATCH",
    body: { budget: Math.max(0, num(amount)) },
  });
}

// ── TRANSACTIONS ─────────────────────────────────────────────────────────────
function toTx(row) {
  return {
    id: row.id,
    type: row.type,
    amount: num(row.amount),
    category: row.category,
    note: row.note || "",
    date: row.date,
  };
}

export async function listTransactions() {
  const rows = await rest(
    "/transactions?select=id,type,amount,category,note,date&order=date.desc",
  );
  return (rows || []).map(toTx);
}

export async function addTransaction(tx) {
  const rows = await rest("/transactions", {
    method: "POST",
    prefer: "return=representation",
    body: [{
      user_id: currentUserId(),
      type: tx.type,
      amount: num(tx.amount),
      category: tx.category,
      note: tx.note || "",
      date: tx.date,
    }],
  });
  return toTx(rows[0]);
}

export async function updateTransaction(tx) {
  const rows = await rest(`/transactions?id=eq.${enc(tx.id)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: {
      type: tx.type,
      amount: num(tx.amount),
      category: tx.category,
      note: tx.note || "",
      date: tx.date,
    },
  });
  return toTx(rows[0]);
}

export async function deleteTransaction(id) {
  await rest(`/transactions?id=eq.${enc(id)}`, { method: "DELETE" });
}

// ── GROUPS ───────────────────────────────────────────────────────────────────
// One embedded request pulls a group with its members, expenses and splits.
// RLS filters it to groups the caller belongs to.
const GROUP_SELECT =
  "id,name,created_by," +
  "group_members(user_id,profiles(id,name,avatar,color))," +
  "group_expenses(id,description,amount,paid_by,date," +
  "expense_splits(user_id,amount,settled))";

function toGroup(row) {
  const members = (row.group_members || [])
    .map((m) => m.profiles)
    .filter(Boolean);

  const expenses = (row.group_expenses || [])
    .map((e) => ({
      id: e.id,
      description: e.description,
      amount: num(e.amount),
      paidBy: e.paid_by,
      date: e.date,
      splits: (e.expense_splits || []).map((s) => ({
        userId: s.user_id,
        amount: num(s.amount),
        settled: Boolean(s.settled),
      })),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    members: members.map((m) => m.id),
    memberProfiles: members,
    expenses,
  };
}

export async function listGroups() {
  const rows = await rest(`/groups?select=${GROUP_SELECT}&order=created_at.desc`);
  return (rows || []).map(toGroup);
}

export async function findUserByEmail(email) {
  const rows = await rpc("find_profile_by_email", { lookup_email: email });
  return rows?.length ? rows[0] : null;
}

// Splits are stored to 2dp, with any rounding remainder absorbed by the payer,
// so the parts always add back up to the total.
function evenSplits(total, memberIds, paidBy) {
  const cents = Math.round(num(total) * 100);
  const base = Math.floor(cents / memberIds.length);
  let remainder = cents - base * memberIds.length;

  return memberIds.map((id) => {
    let share = base;
    if (id === paidBy && remainder > 0) {
      share += remainder;
      remainder = 0;
    }
    return { user_id: id, amount: share / 100, settled: id === paidBy };
  });
}

export async function createGroup({ name, memberIds, firstExpense }) {
  const me = currentUserId();
  const ids = Array.from(new Set([me, ...memberIds]));

  const [group] = await rest("/groups", {
    method: "POST",
    prefer: "return=representation",
    body: [{ name: name.trim(), created_by: me }],
  });

  // Membership has to land before expenses: the RLS policies on
  // group_expenses and expense_splits check that the caller is a member.
  await rest("/group_members", {
    method: "POST",
    body: ids.map((id) => ({ group_id: group.id, user_id: id })),
  });

  if (firstExpense?.description && num(firstExpense.amount) > 0) {
    await addGroupExpense(group.id, { ...firstExpense, memberIds: ids });
  }
  return group.id;
}

export async function addGroupExpense(groupId, { description, amount, paidBy, memberIds }) {
  const payer = paidBy || currentUserId();

  const [expense] = await rest("/group_expenses", {
    method: "POST",
    prefer: "return=representation",
    body: [{
      group_id: groupId,
      description: (description || "").trim(),
      amount: num(amount),
      paid_by: payer,
      date: new Date().toISOString().split("T")[0],
    }],
  });

  await rest("/expense_splits", {
    method: "POST",
    body: evenSplits(amount, memberIds, payer)
      .map((s) => ({ ...s, expense_id: expense.id })),
  });
}

export async function settleSplit(expenseId, userId) {
  await rest(
    `/expense_splits?expense_id=eq.${enc(expenseId)}&user_id=eq.${enc(userId)}`,
    { method: "PATCH", body: { settled: true } },
  );
}

// ── ONE-TIME IMPORT OF PRE-CLOUD DATA ────────────────────────────────────────
// Earlier versions kept everything in localStorage under a per-browser blob.
// On the first cloud sign-in we lift those transactions into the account, then
// drop a flag so a second visit can never double-import them.
const LEGACY_STATE_KEY = "xpenseup_app_state_v1";
const LEGACY_ME_KEY = "xpenseup_me";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readLegacyAccount() {
  let state;
  try {
    state = JSON.parse(localStorage.getItem(LEGACY_STATE_KEY) || "null");
  } catch {
    return null;
  }
  const accounts = state?.accounts;
  if (!accounts || typeof accounts !== "object") return null;

  // Prefer whichever local profile was last signed in; otherwise the fullest.
  let legacyId = null;
  try {
    legacyId = JSON.parse(localStorage.getItem(LEGACY_ME_KEY) || "null")?.id || null;
  } catch { /* ignore */ }

  if (legacyId && accounts[legacyId]) return accounts[legacyId];

  return Object.values(accounts)
    .filter((a) => Array.isArray(a?.expenses))
    .sort((a, b) => b.expenses.length - a.expenses.length)[0] || null;
}

export async function importLocalDataOnce(profile, existingCount) {
  const flag = `xpenseup_migrated_${profile.id}`;
  if (localStorage.getItem(flag)) return 0;

  // Only import into a genuinely empty cloud account.
  if (existingCount > 0) {
    localStorage.setItem(flag, "skipped");
    return 0;
  }

  const account = readLegacyAccount();
  const rows = (account?.expenses || [])
    .filter((e) => (e.type === "debit" || e.type === "credit")
      && num(e.amount) > 0
      && DATE_RE.test(String(e.date)))
    .map((e) => ({
      user_id: profile.id,
      type: e.type,
      amount: num(e.amount),
      category: e.category || "other",
      note: String(e.note || "").slice(0, 500),
      date: e.date,
    }));

  if (!rows.length) {
    localStorage.setItem(flag, "empty");
    return 0;
  }

  for (let i = 0; i < rows.length; i += 100) {
    await rest("/transactions", { method: "POST", body: rows.slice(i, i + 100) });
  }

  if (num(account.budget) > 0) await setBudget(account.budget);

  localStorage.setItem(flag, `imported:${rows.length}`);
  return rows.length;
}
