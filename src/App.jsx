import { saveData, loadData, listenData, loginWithEmail, logout, onAuthChange } from "./firebase.js";
import { useState, useEffect, useCallback, useRef } from "react";

const C = {
  primary: "#E8500A", success: "#059669", danger: "#DC2626",
  warning: "#D97706", muted: "#6B7280", border: "#E5E7EB",
  bg: "#FAF7F5", card: "#FFFFFF", info: "#0284C7",
  dark: "#111111"
};

const s = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 },
  btn: (color = C.primary, pad = "8px 14px") => ({ background: color, color: "#fff", border: "none", borderRadius: 8, padding: pad, cursor: "pointer", fontSize: 13, fontWeight: 500 }),
  btnO: (color = "#111") => ({ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, color }),
  inp: (w = "100%") => ({ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", width: w, fontSize: 13, boxSizing: "border-box", background: "#fff" }),
  badge: (color) => ({ background: color + "20", color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 500, display: "inline-block" }),
  row: (j = "space-between", a = "center") => ({ display: "flex", justifyContent: j, alignItems: a }),
  metric: (color) => ({ background: color + "12", border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 14px", flex: 1, minWidth: 100 }),
};

const DEF_CATEGORIES = ["Boissons", "Plats", "Desserts", "Entrées", "Snacks", "Formules"];
const DEF_PRODUCTS = [
  { id: 1, name: "Café", cat: "Boissons", price: 500, stock: 50, desc: "Expresso maison" },
  { id: 2, name: "Thé", cat: "Boissons", price: 500, stock: 40, desc: "" },
  { id: 3, name: "Jus d'orange", cat: "Boissons", price: 1000, stock: 30, desc: "Pressé frais" },
  { id: 4, name: "Eau minérale", cat: "Boissons", price: 500, stock: 60, desc: "" },
  { id: 5, name: "Coca-Cola", cat: "Boissons", price: 1000, stock: 45, desc: "33cl" },
  { id: 6, name: "Croque-monsieur", cat: "Plats", price: 2500, stock: 20, desc: "" },
  { id: 7, name: "Salade César", cat: "Plats", price: 3500, stock: 15, desc: "" },
  { id: 8, name: "Burger maison", cat: "Plats", price: 4500, stock: 10, desc: "Bœuf 180g" },
  { id: 9, name: "Quiche lorraine", cat: "Plats", price: 3000, stock: 8, desc: "" },
  { id: 10, name: "Fondant chocolat", cat: "Desserts", price: 1500, stock: 12, desc: "" },
  { id: 11, name: "Tarte citron", cat: "Desserts", price: 1500, stock: 10, desc: "" },
  { id: 12, name: "Formule Déj", cat: "Formules", price: 5000, stock: 20, desc: "Plat + dessert + café" },
];
const OWNER_EMAIL = "cekouadio@yahoo.fr";

const DEF_STAFF = [
  { id: 1, name: "Olivier K", pin: "1234", role: "manager" },
  { id: 2, name: "Marie", pin: "5678", role: "caissier" },
  { id: 3, name: "Thomas", pin: "9012", role: "caissier" },
  { id: 4, name: "Sophie", pin: "3456", role: "caissier" },
];
const DEF_TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1, name: `Table ${i + 1}`, status: "libre", seats: i < 6 ? 2 : i < 14 ? 4 : 6
}));

const STORAGE_KEY = "caisse_restaurant_data";
let onSaveError = null;
let onSaveOk = null;

async function cloudLoad() {
  try {
    const remote = await loadData();
    if (remote) return remote;
  } catch (e) { console.warn("Firebase load failed:", e); }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function cloudSave(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  try {
    await saveData(data);
    onSaveOk?.();
  } catch (err) {
    console.error("Firebase save error:", err.code, err.message);
    onSaveError?.(err.code || err.message);
  }
}

// ── Composants utilitaires ─────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 340 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000065", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ ...s.row(), marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Notif({ n }) {
  if (!n) return null;
  return (
    <div style={{ position: "fixed", top: 12, right: 12, zIndex: 9999, background: n.type === "success" ? C.success : n.type === "info" ? C.info : C.danger, color: "#fff", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 500 }}>
      {n.msg}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = checking, null = not logged in
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authShowPwd, setAuthShowPwd] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState(DEF_PRODUCTS);
  const [categories, setCategories] = useState(DEF_CATEGORIES);
  const [staff, setStaff] = useState(DEF_STAFF);
  const [tables, setTables] = useState(DEF_TABLES);
  const [transactions, setTransactions] = useState([]);
  const [tableOrders, setTableOrders] = useState({});

  const stateRef = useRef({});
  stateRef.current = { products, categories, staff, tables, transactions, tableOrders };

  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [activeTab, setActiveTab] = useState("caisse");
  const [notif, setNotif] = useState(null);
  const [fbStatus, setFbStatus] = useState("...");

  const [cart, setCart] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [filterCat, setFilterCat] = useState("Tous");
  const [payModal, setPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState("espèces");
  const [cashGiven, setCashGiven] = useState("");
  const [ticketModal, setTicketModal] = useState(null);

  const [prodModal, setProdModal] = useState(null);
  const [editProd, setEditProd] = useState({});
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState("");

  const [staffModal, setStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: "", pin: "", role: "caissier" });
  const [editStaff, setEditStaff] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({ name: "", pin: "", role: "caissier" });

  const [editTable, setEditTable] = useState(null);
  const [newTableName, setNewTableName] = useState("");
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [addTableModal, setAddTableModal] = useState(false);
  const [newTableForm, setNewTableForm] = useState({ name: "", seats: 4 });

  const [statPeriod, setStatPeriod] = useState("jour");
  const [statFrom, setStatFrom] = useState("");
  const [statTo, setStatTo] = useState("");

  const notify = (msg, type = "success") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 2500);
  };

  useEffect(() => {
    onSaveOk = () => setFbStatus("OK");
    onSaveError = (code) => { setFbStatus("ERR:" + code); notify("Firebase : " + code, "danger"); };
    return () => { onSaveOk = null; onSaveError = null; };
  }, []);

  useEffect(() => {
    const unsub = onAuthChange((user) => setAuthUser(user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser) { setLoaded(false); return; }

    const applyData = (data) => {
      if (data.products) setProducts(data.products);
      if (data.categories) setCategories(data.categories);
      if (data.staff) setStaff(data.staff);
      if (data.tables) setTables(data.tables);
      if (data.transactions) setTransactions(data.transactions);
      if (data.tableOrders) setTableOrders(data.tableOrders);
    };

    (async () => {
      const data = await cloudLoad();
      if (data) applyData(data);
      setLoaded(true);
    })();

    const unsub = listenData((data) => applyData(data));
    return () => unsub();
  }, [authUser]);

  const persistAll = useCallback((overrides = {}) => {
    cloudSave({ ...stateRef.current, ...overrides });
  }, []);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const handleLogin = () => {
    if (!selectedStaff) { setPinError("Sélectionnez un profil"); return; }
    const user = staff.find(u => u.id === selectedStaff);
    if (user && user.pin === pinInput) {
      const isOwner = authUser?.email === OWNER_EMAIL;
      const effectiveRole = isOwner ? user.role : "caissier";
      setCurrentUser({ ...user, role: effectiveRole });
      setScreen("app");
      setActiveTab(effectiveRole === "manager" ? "dashboard" : "tables");
      setPinInput(""); setPinError("");
    } else { setPinError("PIN incorrect"); setPinInput(""); }
  };

  const addToCart = (p) => {
    if (p.stock <= 0) { notify("Stock épuisé", "danger"); return; }
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
    });
  };
  const updateQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const assignCartToTable = (tid) => {
    const newTO = { ...tableOrders, [tid]: [...(tableOrders[tid] || []), ...cart] };
    const newTables = tables.map(t => t.id === tid ? { ...t, status: "occupée" } : t);
    setTableOrders(newTO); setTables(newTables); setCart([]); setActiveTable(null);
    persistAll({ tableOrders: newTO, tables: newTables });
    notify("Commande assignée à la table !");
  };

  const encaisserTable = (tid) => {
    const items = tableOrders[tid] || [];
    if (!items.length) return;
    setCart(items); setActiveTable(tid); setPayModal(true);
  };

  const validatePayment = () => {
    const ticket = {
      id: Date.now(), items: [...cart], total: cartTotal,
      method: payMethod, cashier: currentUser.name,
      date: new Date().toLocaleString("fr-FR"),
      change: payMethod === "espèces" ? Math.max(0, parseFloat(cashGiven || 0) - cartTotal) : 0,
      table: activeTable ? `Table ${activeTable}` : null,
    };
    const newTx = [ticket, ...transactions];
    const newProds = products.map(p => { const it = cart.find(i => i.id === p.id); return it ? { ...p, stock: p.stock - it.qty } : p; });
    const newTO = { ...tableOrders }; delete newTO[activeTable];
    const newTables = tables.map(t => t.id === activeTable ? { ...t, status: "libre" } : t);
    setTransactions(newTx); setProducts(newProds); setTableOrders(newTO); setTables(newTables);
    setCart([]); setPayModal(false); setTicketModal(ticket); setCashGiven(""); setActiveTable(null);
    persistAll({ transactions: newTx, products: newProds, tableOrders: newTO, tables: newTables });
  };

  const filterTx = () => {
    const now = new Date();
    return transactions.filter(t => {
      try {
        const d = new Date(t.date.split(" ")[0].split("/").reverse().join("-"));
        if (statPeriod === "jour") return d.toDateString() === now.toDateString();
        if (statPeriod === "semaine") return (now - d) / 86400000 < 7;
        if (statPeriod === "mois") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (statPeriod === "custom" && statFrom && statTo) return d >= new Date(statFrom) && d <= new Date(statTo);
        return true;
      } catch { return false; }
    });
  };

  const topProducts = (txList) => {
    const counts = {};
    txList.forEach(t => t.items.forEach(i => { counts[i.name] = (counts[i.name] || 0) + i.qty; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

  const lowStock = products.filter(p => p.stock <= 5);
  const filteredProds = filterCat === "Tous" ? products : products.filter(p => p.cat === filterCat);

  const printTicket = (ticket) => {
    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(`<html><head><title>Ticket</title><style>body{font-family:monospace;font-size:13px;padding:16px;max-width:300px;margin:auto}h2,p{margin:4px 0;text-align:center}.line{border-top:1px dashed #999;margin:8px 0}.row{display:flex;justify-content:space-between}strong{font-size:15px}</style></head><body>
      <h2>🍽️ LE MONTMORENCY</h2><p>bistro ivoirien · Abidjan</p><p>${ticket.date}</p><p>Caissier: ${ticket.cashier}</p>${ticket.table ? `<p>${ticket.table}</p>` : ""}
      <div class="line"></div>
      ${ticket.items.map(i => `<div class="row"><span>${i.qty}x ${i.name}</span><span>${Math.round(i.price * i.qty).toLocaleString()} FCFA</span></div>`).join("")}
      <div class="line"></div>
      <div class="row"><strong>TOTAL</strong><strong>${Math.round(ticket.total).toLocaleString()} FCFA</strong></div>
      <p>Paiement: ${ticket.method}${ticket.change > 0 ? ` | Rendu: ${Math.round(ticket.change).toLocaleString()} FCFA` : ""}</p>
      <div class="line"></div><p>Merci de votre visite !</p>
      <script>window.print();window.close();<\/script></body></html>`);
    win.document.close();
  };

  // ── Vérification Auth Firebase ───────────────────────────────────────────
  if (authUser === undefined) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: C.muted, background: "#111" }}>
      <div style={{ color: "#E8500A", fontSize: 14 }}>Vérification…</div>
    </div>
  );

  // ── Écran de connexion Firebase Auth ─────────────────────────────────────
  if (!authUser) {
    const handleAuth = async (e) => {
      e.preventDefault();
      setAuthError("");
      setAuthLoading(true);
      try {
        await loginWithEmail(authEmail, authPassword);
      } catch (err) {
        const msg = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found"
          ? "Email ou mot de passe incorrect"
          : err.code === "auth/invalid-email"
          ? "Adresse email invalide"
          : err.code === "auth/too-many-requests"
          ? "Trop de tentatives, réessayez plus tard"
          : "Erreur de connexion";
        setAuthError(msg);
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <div style={{ minHeight: "100vh", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", padding: 16 }}>
        <div style={{ background: "#1A1A1A", borderRadius: 16, padding: 28, width: 320, maxWidth: "100%", border: "1px solid #E8500A30" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <svg width="64" height="70" viewBox="0 0 200 220" style={{ marginBottom: 8 }}>
              <polygon points="100,8 192,110 8,110" fill="none" stroke="#E8500A" strokeWidth="3" />
              <g fill="none" stroke="#E8500A" strokeWidth="2.2">
                <ellipse cx="105" cy="72" rx="38" ry="22" />
                <path d="M68,82 Q60,95 62,100" /><path d="M82,90 Q78,104 80,108" />
                <path d="M128,90 Q132,104 130,108" /><path d="M142,82 Q150,95 148,100" />
                <path d="M143,65 Q155,58 152,75" />
              </g>
            </svg>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#E8500A", letterSpacing: 2 }}>LE MONTMORENCY</div>
            <div style={{ fontSize: 11, color: "#ffffff40", marginTop: 4 }}>Accès sécurisé</div>
          </div>
          <form onSubmit={handleAuth}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#ffffff60", marginBottom: 6 }}>Email</div>
              <input
                type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                placeholder="votre@email.com" required autoComplete="email"
                style={{ width: "100%", background: "#222", border: "1px solid #333", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#ffffff60", marginBottom: 6 }}>Mot de passe</div>
              <div style={{ position: "relative" }}>
                <input
                  type={authShowPwd ? "text" : "password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ width: "100%", background: "#222", border: "1px solid #333", borderRadius: 8, padding: "10px 40px 10px 12px", color: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none" }}
                />
                <button type="button" onClick={() => setAuthShowPwd(v => !v)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#ffffff60", fontSize: 16, padding: 0 }}>
                  {authShowPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            {authError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{authError}</div>}
            <button type="submit" disabled={authLoading}
              style={{ width: "100%", background: authLoading ? "#555" : "#E8500A", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: authLoading ? "not-allowed" : "pointer" }}>
              {authLoading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!loaded) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: C.muted }}>Chargement… 🍽️</div>;

  // ── Écran de connexion ───────────────────────────────────────────────────
  if (screen === "login") {
    const handlePin = (k) => {
      if (k === "⌫") setPinInput(p => p.slice(0, -1));
      else if (k === "✓") handleLogin();
      else if (pinInput.length < 4) setPinInput(p => p + String(k));
    };

    return (
      <div style={{ minHeight: "100vh", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}
        onKeyDown={(e) => e.preventDefault()}
      >
        <div style={{ background: "#1A1A1A", borderRadius: 16, padding: 26, width: 310, border: "1px solid #E8500A30" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <svg width="80" height="88" viewBox="0 0 200 220" style={{ marginBottom: 6 }}>
              <polygon points="100,8 192,110 8,110" fill="none" stroke="#E8500A" strokeWidth="3" />
              <g fill="none" stroke="#E8500A" strokeWidth="2.2">
                <ellipse cx="105" cy="72" rx="38" ry="22" />
                <path d="M68,82 Q60,95 62,100" /><path d="M82,90 Q78,104 80,108" />
                <path d="M128,90 Q132,104 130,108" /><path d="M142,82 Q150,95 148,100" />
                <path d="M143,65 Q155,58 152,75" />
              </g>
            </svg>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#E8500A", letterSpacing: 2 }}>LE MONTMORENCY</div>
            <div style={{ fontSize: 11, color: "#ffffff50", marginTop: 2 }}>bistro ivoirien · Abidjan</div>
            <div style={{ width: 60, height: 1, background: "#E8500A50", margin: "10px auto 6px" }} />
            <div style={{ fontSize: 12, color: "#ffffff60" }}>Connectez-vous</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            {staff.map(m => (
              <div key={m.id}
                onClick={() => { setSelectedStaff(m.id); setPinInput(""); setPinError(""); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, marginBottom: 6, cursor: "pointer", border: `1.5px solid ${selectedStaff === m.id ? "#E8500A" : "#333"}`, background: selectedStaff === m.id ? "#E8500A15" : "#222" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.role === "manager" ? "#E8500A25" : "#05966920", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: m.role === "manager" ? "#E8500A" : C.success }}>{m.name[0]}</div>
                <div><div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{m.name}</div><div style={{ fontSize: 11, color: "#ffffff50" }}>{m.role}</div></div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map(k => (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePin(k);
                }}
                style={{ padding: "11px 0", borderRadius: 8, border: "1px solid #333", background: k === "✓" ? "#E8500A" : "#222", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 500, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >{k}</button>
            ))}
          </div>
          <div style={{ textAlign: "center", letterSpacing: 8, fontSize: 20, marginBottom: 4, color: "#E8500A" }}>{"●".repeat(pinInput.length)}{"○".repeat(4 - pinInput.length)}</div>
          {pinError && <div style={{ color: C.danger, fontSize: 12, textAlign: "center" }}>{pinError}</div>}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "dashboard", label: "📊 Dashboard", mgr: true },
    { id: "tables", label: "🪑 Tables", mgr: false },
    { id: "caisse", label: "🧾 Caisse", mgr: false },
    { id: "menu", label: "🍽️ Menu", mgr: true },
    { id: "stocks", label: "📦 Stocks", mgr: true },
    { id: "stats", label: "📈 Stats", mgr: true },
    { id: "historique", label: "📋 Historique", mgr: true },
    { id: "equipe", label: "👥 Équipe", mgr: true },
  ].filter(t => !t.mgr || currentUser?.role === "manager");

  // ── Application principale ───────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#111827", minHeight: "100vh", background: C.bg }}>
      <Notif n={notif} />

      {/* Barre supérieure */}
      <div style={{ background: "#111111", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="32" height="36" viewBox="0 0 200 220">
            <polygon points="100,8 192,110 8,110" fill="none" stroke="#E8500A" strokeWidth="6" />
            <g fill="none" stroke="#E8500A" strokeWidth="4">
              <ellipse cx="105" cy="72" rx="38" ry="22" />
              <path d="M68,82 Q60,95 62,100" /><path d="M82,90 Q78,104 80,108" />
              <path d="M128,90 Q132,104 130,108" /><path d="M142,82 Q150,95 148,100" />
              <path d="M143,65 Q155,58 152,75" />
            </g>
          </svg>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#E8500A", letterSpacing: 1 }}>LE MONTMORENCY</div>
            <div style={{ fontSize: 9, color: "#ffffff50" }}>bistro ivoirien · Abidjan</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: fbStatus === "OK" ? "#4ade80" : fbStatus.startsWith("ERR") ? "#f87171" : "#ffffff60" }}>
            {fbStatus === "OK" ? "● Firebase OK" : fbStatus.startsWith("ERR") ? "● " + fbStatus : "● sync..."}
          </span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>{currentUser?.name} · {currentUser?.role}</span>
          <button onClick={() => { setCurrentUser(null); setScreen("login"); setCart([]); setSelectedStaff(null); setActiveTable(null); }}
            style={{ ...s.btnO("#fff"), borderColor: "#ffffff30", padding: "5px 10px", fontSize: 12 }}>Déco</button>
          <button onClick={() => { logout(); setCurrentUser(null); setScreen("login"); setCart([]); }}
            style={{ ...s.btnO("#f87171"), borderColor: "#f8717140", padding: "5px 10px", fontSize: 12 }}>Quitter</button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 12px", cursor: "pointer", whiteSpace: "nowrap", borderBottom: `2px solid ${activeTab === t.id ? C.primary : "transparent"}`, color: activeTab === t.id ? C.primary : C.muted, fontWeight: activeTab === t.id ? 500 : 400, fontSize: 12 }}>{t.label}</div>
        ))}
      </div>

      <div style={{ padding: 14 }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (() => {
          const today = transactions.filter(t => t.date.startsWith(new Date().toLocaleDateString("fr-FR")));
          const todayCA = today.reduce((s, t) => s + t.total, 0);
          const monthTx = transactions.filter(t => { try { const d = new Date(t.date.split(" ")[0].split("/").reverse().join("-")); return d.getMonth() === new Date().getMonth(); } catch { return false; } });
          const monthCA = monthTx.reduce((s, t) => s + t.total, 0);
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Vue d'ensemble</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={s.metric(C.primary)}><div style={{ fontSize: 11, color: C.muted }}>CA aujourd'hui</div><div style={{ fontSize: 21, fontWeight: 700, color: C.primary }}>{Math.round(todayCA).toLocaleString()} FCFA</div><div style={{ fontSize: 11, color: C.muted }}>{today.length} ventes</div></div>
                <div style={s.metric(C.success)}><div style={{ fontSize: 11, color: C.muted }}>CA ce mois</div><div style={{ fontSize: 21, fontWeight: 700, color: C.success }}>{Math.round(monthCA).toLocaleString()} FCFA</div></div>
                <div style={s.metric(C.info)}><div style={{ fontSize: 11, color: C.muted }}>Tables occupées</div><div style={{ fontSize: 21, fontWeight: 700, color: C.info }}>{tables.filter(t => t.status === "occupée").length}/{tables.length}</div></div>
                <div style={s.metric(C.warning)}><div style={{ fontSize: 11, color: C.muted }}>Stock faible</div><div style={{ fontSize: 21, fontWeight: 700, color: C.warning }}>{lowStock.length}</div></div>
              </div>
              {lowStock.length > 0 && <div style={{ ...s.card, borderLeft: `3px solid ${C.warning}` }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>⚠️ Alertes stock</div>
                {lowStock.map(p => <div key={p.id} style={{ ...s.row(), padding: "3px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}><span>{p.name}</span><span style={{ color: p.stock === 0 ? C.danger : C.warning, fontWeight: 500 }}>{p.stock} restant(s)</span></div>)}
              </div>}
              <div style={s.card}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>📋 Dernières transactions</div>
                {transactions.slice(0, 5).map(t => <div key={t.id} style={{ ...s.row(), padding: "5px 0", borderBottom: `1px solid ${C.border}` }}><div><div style={{ fontSize: 13 }}>{t.date}</div><div style={{ fontSize: 11, color: C.muted }}>{t.cashier}{t.table ? ` · ${t.table}` : ""} · {t.method}</div></div><span style={{ fontWeight: 600, color: C.success }}>{Math.round(t.total).toLocaleString()} FCFA</span></div>)}
                {transactions.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Aucune transaction</div>}
              </div>
            </div>
          );
        })()}

        {/* TABLES */}
        {activeTab === "tables" && (
          <div>
            <div style={{ ...s.row(), marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Plan de salle</div>
                <div style={{ fontSize: 12, color: C.muted }}>{tables.filter(t => t.status === "libre").length} libres · {tables.filter(t => t.status === "occupée").length} occupées</div>
              </div>
              {currentUser?.role === "manager" && <button onClick={() => setAddTableModal(true)} style={s.btn(C.primary, "6px 12px")}>+ Table</button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px,1fr))", gap: 10 }}>
              {tables.map(t => {
                const items = tableOrders[t.id] || [];
                const total = items.reduce((s, i) => s + i.price * i.qty, 0);
                return (
                  <div key={t.id} style={{ ...s.card, borderLeft: `4px solid ${t.status === "libre" ? C.success : C.warning}`, padding: 12 }}>
                    <div style={{ ...s.row(), marginBottom: 2 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                      {currentUser?.role === "manager" && <button onClick={() => { setEditTable(t); setNewTableName(t.name); setNewTableSeats(t.seats); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.muted }}>✏️</button>}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{t.seats} places · <span style={{ color: t.status === "libre" ? C.success : C.warning, fontWeight: 500 }}>{t.status}</span></div>
                    {items.length > 0 && <div style={{ fontSize: 12, marginBottom: 6, color: C.warning, fontWeight: 500 }}>{items.length} article(s) · {Math.round(total).toLocaleString()} FCFA</div>}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button onClick={() => { setActiveTable(t.id); setActiveTab("caisse"); }} style={s.btn(C.primary, "5px 8px")}>+ Commande</button>
                      {items.length > 0 && <button onClick={() => encaisserTable(t.id)} style={s.btn(C.success, "5px 8px")}>Encaisser</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CAISSE */}
        {activeTab === "caisse" && (
          <div>
            {activeTable && <div style={{ background: C.warning + "20", border: `1px solid ${C.warning}40`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
              Commande pour <strong>Table {activeTable}</strong> ·
              <button onClick={() => assignCartToTable(activeTable)} style={{ ...s.btn(C.warning, "4px 10px"), marginLeft: 8 }}>Envoyer en salle</button>
              <button onClick={() => setActiveTable(null)} style={{ ...s.btnO(), padding: "4px 8px", fontSize: 12, marginLeft: 4 }}>Retirer table</button>
            </div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 12 }}>
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {["Tous", ...categories].map(c => <button key={c} onClick={() => setFilterCat(c)} style={{ ...s.btnO(), background: filterCat === c ? C.primary : "#fff", color: filterCat === c ? "#fff" : "#111", borderColor: filterCat === c ? C.primary : C.border, padding: "5px 10px", fontSize: 12 }}>{c}</button>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 8 }}>
                  {filteredProds.map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, cursor: p.stock > 0 ? "pointer" : "not-allowed", opacity: p.stock === 0 ? 0.5 : 1 }}>
                      <div style={{ fontSize: 10, color: C.muted }}>{p.cat}</div>
                      <div style={{ fontWeight: 500, fontSize: 13, margin: "2px 0 4px" }}>{p.name}</div>
                      {p.desc && <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{p.desc}</div>}
                      <div style={s.row()}><span style={{ fontWeight: 600, color: C.primary }}>{Math.round(p.price).toLocaleString()} FCFA</span><span style={{ fontSize: 10, color: p.stock <= 5 ? C.warning : C.muted }}>{p.stock}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...s.card, alignSelf: "start", position: "sticky", top: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>🛒 Commande{activeTable ? ` – Table ${activeTable}` : ""}</div>
                {cart.length === 0 ? <div style={{ color: C.muted, textAlign: "center", padding: "20px 0", fontSize: 13 }}>Panier vide</div> : <>
                  {cart.map(it => (
                    <div key={it.id} style={{ padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{it.name}</div>
                      <div style={{ ...s.row(), marginTop: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <button onClick={() => updateQty(it.id, -1)} style={{ width: 22, height: 22, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", background: "#fff" }}>−</button>
                          <span style={{ fontSize: 13 }}>{it.qty}</span>
                          <button onClick={() => updateQty(it.id, 1)} style={{ width: 22, height: 22, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", background: "#fff" }}>+</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{(Math.round(it.price) * it.qty).toLocaleString()} FCFA</span>
                          <button onClick={() => removeFromCart(it.id)} style={{ color: C.danger, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ ...s.row(), padding: "8px 0 6px", fontWeight: 600, fontSize: 15 }}><span>Total</span><span style={{ color: C.primary }}>{Math.round(cartTotal).toLocaleString()} FCFA</span></div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setCart([])} style={{ ...s.btnO(), flex: 1, fontSize: 12 }}>Vider</button>
                    <button onClick={() => setPayModal(true)} style={{ ...s.btn(C.success), flex: 2 }}>Encaisser</button>
                  </div>
                </>}
              </div>
            </div>
          </div>
        )}

        {/* MENU */}
        {activeTab === "menu" && (
          <div>
            <div style={{ ...s.row(), marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Gestion du menu</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setCatModal(true)} style={s.btnO()}>+ Catégorie</button>
                <button onClick={() => { setEditProd({ name: "", cat: categories[0] || "Plats", price: "", stock: "", desc: "" }); setProdModal("new"); }} style={s.btn()}>+ Produit</button>
              </div>
            </div>
            {categories.map(cat => {
              const prods = products.filter(p => p.cat === cat);
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ ...s.row(), marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.primary }}>🏷️ {cat} <span style={s.badge(C.muted)}>{prods.length}</span></div>
                    <button onClick={() => { if (window.confirm(`Supprimer "${cat}" ?`)) { setCategories(prev => prev.filter(c => c !== cat)); setProducts(prev => prev.filter(p => p.cat !== cat)); notify("Catégorie supprimée"); } }} style={{ ...s.btnO(C.danger), padding: "3px 8px", fontSize: 11 }}>Suppr.</button>
                  </div>
                  {prods.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Aucun produit.</div>}
                  {prods.map(p => (
                    <div key={p.id} style={{ ...s.card, ...s.row(), padding: "10px 12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        {p.desc && <div style={{ fontSize: 11, color: C.muted }}>{p.desc}</div>}
                        <div style={{ fontSize: 11, color: C.muted }}>Stock: {p.stock}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: C.primary }}>{Math.round(p.price).toLocaleString()} FCFA</span>
                        <button onClick={() => { setEditProd({ ...p, price: p.price.toString(), stock: p.stock.toString() }); setProdModal(p); }} style={s.btnO()}>Modifier</button>
                        <button onClick={() => { setProducts(prev => prev.filter(pr => pr.id !== p.id)); notify("Produit supprimé"); }} style={s.btn(C.danger, "6px 9px")}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* STOCKS */}
        {activeTab === "stocks" && (
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Suivi des stocks</div>
            {[...products].sort((a, b) => a.stock - b.stock).map(p => (
              <div key={p.id} style={{ ...s.card, ...s.row() }}>
                <div><div style={{ fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 11, color: C.muted }}>{p.cat}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 80, height: 6, background: C.border, borderRadius: 4 }}>
                    <div style={{ width: `${Math.min(100, (p.stock / 60) * 100)}%`, height: "100%", background: p.stock <= 5 ? C.danger : p.stock <= 15 ? C.warning : C.success, borderRadius: 4 }} />
                  </div>
                  <span style={{ minWidth: 24, fontWeight: 500, color: p.stock === 0 ? C.danger : p.stock <= 5 ? C.warning : "#111" }}>{p.stock}</span>
                  <button onClick={() => { const n = products.map(pr => pr.id === p.id ? { ...pr, stock: pr.stock + 10 } : pr); setProducts(n); persistAll({ products: n }); }} style={s.btn(C.success, "5px 9px")}>+10</button>
                  <button onClick={() => { const n = products.map(pr => pr.id === p.id ? { ...pr, stock: Math.max(0, pr.stock - 5) } : pr); setProducts(n); persistAll({ products: n }); }} style={s.btn(C.warning, "5px 9px")}>-5</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATISTIQUES */}
        {activeTab === "stats" && (() => {
          const txList = filterTx();
          const totalCA = txList.reduce((s, t) => s + t.total, 0);
          const byMethod = {};
          txList.forEach(t => { byMethod[t.method] = (byMethod[t.method] || 0) + t.total; });
          const top = topProducts(txList);
          const maxQty = top[0]?.[1] || 1;
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Statistiques</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {["jour", "semaine", "mois", "tout", "custom"].map(p => <button key={p} onClick={() => setStatPeriod(p)} style={{ ...s.btnO(), background: statPeriod === p ? C.primary : "#fff", color: statPeriod === p ? "#fff" : "#111", borderColor: statPeriod === p ? C.primary : C.border, fontSize: 12, padding: "5px 10px" }}>{p === "jour" ? "Aujourd'hui" : p === "semaine" ? "7 jours" : p === "mois" ? "Ce mois" : p === "tout" ? "Tout" : "Personnalisé"}</button>)}
                {statPeriod === "custom" && <>
                  <input type="date" style={s.inp("130px")} value={statFrom} onChange={e => setStatFrom(e.target.value)} />
                  <span style={{ fontSize: 12, color: C.muted }}>→</span>
                  <input type="date" style={s.inp("130px")} value={statTo} onChange={e => setStatTo(e.target.value)} />
                </>}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={s.metric(C.primary)}><div style={{ fontSize: 11, color: C.muted }}>CA total</div><div style={{ fontSize: 22, fontWeight: 700, color: C.primary }}>{Math.round(totalCA).toLocaleString()} FCFA</div></div>
                <div style={s.metric(C.success)}><div style={{ fontSize: 11, color: C.muted }}>Transactions</div><div style={{ fontSize: 22, fontWeight: 700, color: C.success }}>{txList.length}</div></div>
                <div style={s.metric(C.info)}><div style={{ fontSize: 11, color: C.muted }}>Panier moyen</div><div style={{ fontSize: 22, fontWeight: 700, color: C.info }}>{txList.length > 0 ? Math.round(totalCA / txList.length).toLocaleString() : 0} FCFA</div></div>
              </div>
              <div style={s.card}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Top produits</div>
                {top.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>Aucune donnée</div> : top.map(([name, qty], i) => (
                  <div key={name} style={{ marginBottom: 8 }}>
                    <div style={{ ...s.row(), fontSize: 13, marginBottom: 3 }}><span>{i + 1}. {name}</span><span style={{ fontWeight: 500 }}>{qty} vendus</span></div>
                    <div style={{ height: 6, background: C.border, borderRadius: 4 }}><div style={{ width: `${(qty / maxQty) * 100}%`, height: "100%", background: C.primary, borderRadius: 4 }} /></div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* HISTORIQUE */}
        {activeTab === "historique" && (
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Historique des ventes</div>
            {transactions.length === 0 ? <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>Aucune transaction</div> : transactions.map(t => (
              <div key={t.id} style={{ ...s.card, cursor: "pointer" }} onClick={() => setTicketModal(t)}>
                <div style={s.row()}>
                  <div><div style={{ fontSize: 13 }}>{t.date}{t.table ? ` · ${t.table}` : ""}</div><div style={{ fontSize: 11, color: C.muted }}>{t.cashier} · {t.method} · {t.items.length} article(s)</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, color: C.success }}>{Math.round(t.total).toLocaleString()} FCFA</div>
                    <button onClick={e => { e.stopPropagation(); printTicket(t); }} style={s.btn(C.info, "5px 9px")}>🖨️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ÉQUIPE */}
        {activeTab === "equipe" && (
          <div>
            <div style={{ ...s.row(), marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Équipe</div>
              <button onClick={() => setStaffModal(true)} style={s.btn()}>+ Ajouter</button>
            </div>
            {staff.map(m => (
              <div key={m.id} style={{ ...s.card, ...s.row() }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: m.role === "manager" ? "#E8500A20" : "#05966920", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, color: m.role === "manager" ? C.primary : C.success }}>{m.name[0]}</div>
                  <div><div style={{ fontWeight: 500 }}>{m.name}</div><div style={{ fontSize: 11, color: C.muted }}>PIN: ●●●●</div></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={s.badge(m.role === "manager" ? C.primary : C.success)}>{m.role}</span>
                  <button onClick={() => { setEditStaff(m); setEditStaffForm({ name: m.name, pin: m.pin, role: m.role }); }} style={s.btnO()}>✏️</button>
                  {m.id !== currentUser?.id && <button onClick={() => { const n = staff.filter(u => u.id !== m.id); setStaff(n); persistAll({ staff: n }); notify("Employé supprimé"); }} style={s.btn(C.danger, "5px 9px")}>✕</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      {payModal && (
        <Modal title="💳 Encaissement" onClose={() => setPayModal(false)} width={310}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.primary, textAlign: "center", marginBottom: 14 }}>{Math.round(cartTotal).toLocaleString()} FCFA</div>
          {activeTable && <div style={{ textAlign: "center", fontSize: 13, color: C.muted, marginBottom: 10 }}>Table {activeTable}</div>}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Mode de paiement</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["espèces", "carte"].map(m => <button key={m} onClick={() => setPayMethod(m)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1.5px solid ${payMethod === m ? C.primary : C.border}`, background: payMethod === m ? C.primary + "10" : "#fff", color: payMethod === m ? C.primary : "#111", cursor: "pointer", fontWeight: payMethod === m ? 500 : 400 }}>{m === "espèces" ? "💵 Espèces" : "💳 Carte"}</button>)}
            </div>
          </div>
          {payMethod === "espèces" && <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Montant remis</div>
            <input type="number" style={s.inp()} value={cashGiven} onChange={e => setCashGiven(e.target.value)} placeholder="0.00" />
            {cashGiven && parseFloat(cashGiven) >= cartTotal && <div style={{ marginTop: 6, color: C.success, fontSize: 13, fontWeight: 500 }}>Rendu: {Math.round(parseFloat(cashGiven) - cartTotal).toLocaleString()} FCFA</div>}
          </div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPayModal(false)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={validatePayment} style={{ ...s.btn(C.success), flex: 2 }}>✓ Valider</button>
          </div>
        </Modal>
      )}

      {ticketModal && (
        <Modal title="🧾 Ticket" onClose={() => setTicketModal(null)} width={290}>
          <div style={{ fontFamily: "monospace", fontSize: 13 }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>🍽️ LE MONTMORENCY</div>
              <div style={{ fontSize: 11, color: C.muted }}>bistro ivoirien · Abidjan</div>
              <div style={{ color: C.muted }}>{ticketModal.date}</div>
              {ticketModal.table && <div style={{ color: C.muted }}>{ticketModal.table}</div>}
              <div style={{ color: C.muted }}>Caissier: {ticketModal.cashier}</div>
            </div>
            <div style={{ borderTop: "1px dashed #ccc", borderBottom: "1px dashed #ccc", padding: "8px 0", margin: "8px 0" }}>
              {ticketModal.items.map((it, i) => <div key={i} style={s.row()}><span>{it.qty}x {it.name}</span><span>{Math.round(it.price * it.qty).toLocaleString()} FCFA</span></div>)}
            </div>
                          <div style={{ ...s.row(), fontWeight: 700, fontSize: 15, marginBottom: 4 }}><span>TOTAL</span><span>{Math.round(ticketModal.total).toLocaleString()} FCFA</span></div>
            <div style={{ color: C.muted, marginBottom: 12, fontSize: 12 }}>Paiement: {ticketModal.method}{ticketModal.change > 0 ? ` · Rendu: ${Math.round(ticketModal.change).toLocaleString()} FCFA` : ""}</div>
            <div style={{ textAlign: "center", color: C.muted, marginBottom: 14 }}>Merci de votre visite !</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setTicketModal(null)} style={{ ...s.btnO(), flex: 1 }}>Fermer</button>
              <button onClick={() => printTicket(ticketModal)} style={{ ...s.btn(C.info), flex: 1 }}>🖨️ Imprimer</button>
            </div>
          </div>
        </Modal>
      )}

      {prodModal && (
        <Modal title={prodModal === "new" ? "Nouveau produit" : "Modifier produit"} onClose={() => setProdModal(null)}>
          {[["Nom", "name", "text"], ["Prix (FCFA)", "price", "number"], ["Stock", "stock", "number"], ["Description", "desc", "text"]].map(([label, key, type]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{label}</div>
              <input type={type} style={s.inp()} value={editProd[key] || ""} onChange={e => setEditProd(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Catégorie</div>
            <select style={s.inp()} value={editProd.cat} onChange={e => setEditProd(p => ({ ...p, cat: e.target.value }))}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setProdModal(null)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={() => {
              if (!editProd.name || !editProd.price || !editProd.stock) { notify("Remplissez tous les champs", "danger"); return; }
              const prod = { ...editProd, price: parseInt(editProd.price), stock: parseInt(editProd.stock), id: prodModal === "new" ? Date.now() : prodModal.id };
              const newP = prodModal === "new" ? [...products, prod] : products.map(p => p.id === prod.id ? prod : p);
              setProducts(newP); persistAll({ products: newP }); setProdModal(null); notify(prodModal === "new" ? "Produit ajouté !" : "Produit modifié !");
            }} style={{ ...s.btn(), flex: 2 }}>Enregistrer</button>
          </div>
        </Modal>
      )}

      {catModal && (
        <Modal title="Nouvelle catégorie" onClose={() => setCatModal(false)} width={280}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nom</div>
            <input style={s.inp()} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="ex: Cocktails, Pizzas…" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setCatModal(false)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={() => {
              if (!newCat.trim()) { notify("Entrez un nom", "danger"); return; }
              const n = [...categories, newCat.trim()]; setCategories(n); persistAll({ categories: n }); setCatModal(false); setNewCat(""); notify("Catégorie ajoutée !");
            }} style={{ ...s.btn(), flex: 2 }}>Ajouter</button>
          </div>
        </Modal>
      )}

      {staffModal && (
        <Modal title="Nouvel employé" onClose={() => setStaffModal(false)} width={280}>
          <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nom</div><input style={s.inp()} value={newStaff.name} onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))} /></div>
          <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>PIN (4 chiffres)</div><input style={s.inp()} maxLength={4} value={newStaff.pin} onChange={e => setNewStaff(p => ({ ...p, pin: e.target.value }))} /></div>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Rôle</div><select style={s.inp()} value={newStaff.role} onChange={e => setNewStaff(p => ({ ...p, role: e.target.value }))}><option value="caissier">Caissier</option><option value="manager">Manager</option></select></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStaffModal(false)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={() => {
              if (!newStaff.name || newStaff.pin.length !== 4) { notify("PIN 4 chiffres requis", "danger"); return; }
const newMember = { ...newStaff, id: Date.now() };
const n = [...stateRef.current.staff, newMember];
setStaff(n);
cloudSave({ ...stateRef.current, staff: n });
notify("Employé ajouté !");
setStaffModal(false);
              
            }} style={{ ...s.btn(), flex: 2 }}>Ajouter</button>
          </div>
        </Modal>
      )}

      {editTable && (
        <Modal title={`Modifier — ${editTable.name}`} onClose={() => setEditTable(null)} width={280}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nom de la table</div>
            <input style={s.inp()} value={newTableName} onChange={e => setNewTableName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nombre de places</div>
            <select style={s.inp()} value={newTableSeats} onChange={e => setNewTableSeats(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n} places</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setEditTable(null)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={() => {
              if (!newTableName.trim()) { notify("Entrez un nom", "danger"); return; }
              const n = tables.map(t => t.id === editTable.id ? { ...t, name: newTableName.trim(), seats: newTableSeats } : t);
              setTables(n); persistAll({ tables: n }); setEditTable(null); notify("Table modifiée !");
            }} style={{ ...s.btn(), flex: 2 }}>Enregistrer</button>
          </div>
          <button onClick={() => {
            if (tableOrders[editTable.id]?.length > 0) { notify("Table occupée, impossible de supprimer", "danger"); return; }
            const n = tables.filter(t => t.id !== editTable.id);
            setTables(n); persistAll({ tables: n }); setEditTable(null); notify("Table supprimée");
          }} style={{ ...s.btn(C.danger), width: "100%" }}>🗑️ Supprimer cette table</button>
        </Modal>
      )}

      {editStaff && (
        <Modal title={`Modifier — ${editStaff.name}`} onClose={() => setEditStaff(null)} width={280}>
          <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nom</div><input style={s.inp()} value={editStaffForm.name} onChange={e => setEditStaffForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>PIN (4 chiffres)</div><input style={s.inp()} maxLength={4} value={editStaffForm.pin} onChange={e => setEditStaffForm(p => ({ ...p, pin: e.target.value }))} /></div>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Rôle</div><select style={s.inp()} value={editStaffForm.role} onChange={e => setEditStaffForm(p => ({ ...p, role: e.target.value }))}><option value="caissier">Caissier</option><option value="manager">Manager</option></select></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditStaff(null)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={() => {
              if (!editStaffForm.name || editStaffForm.pin.length !== 4) { notify("PIN 4 chiffres requis", "danger"); return; }
              const n = staff.map(u => u.id === editStaff.id ? { ...u, ...editStaffForm } : u);
              setStaff(n); persistAll({ staff: n }); setEditStaff(null); notify("Employé modifié !");
            }} style={{ ...s.btn(), flex: 2 }}>Enregistrer</button>
          </div>
        </Modal>
      )}

      {addTableModal && (
        <Modal title="Ajouter une table" onClose={() => setAddTableModal(false)} width={280}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nom de la table</div>
            <input style={s.inp()} value={newTableForm.name} onChange={e => setNewTableForm(p => ({ ...p, name: e.target.value }))} placeholder="ex: Table 21, Terrasse…" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Nombre de places</div>
            <select style={s.inp()} value={newTableForm.seats} onChange={e => setNewTableForm(p => ({ ...p, seats: parseInt(e.target.value) }))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n} places</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAddTableModal(false)} style={{ ...s.btnO(), flex: 1 }}>Annuler</button>
            <button onClick={() => {
              if (!newTableForm.name.trim()) { notify("Entrez un nom", "danger"); return; }
              const newT = { id: Date.now(), name: newTableForm.name.trim(), seats: newTableForm.seats, status: "libre" };
              const n = [...tables, newT];
              setTables(n); persistAll({ tables: n }); setAddTableModal(false); setNewTableForm({ name: "", seats: 4 }); notify("Table ajoutée !");
            }} style={{ ...s.btn(), flex: 2 }}>Ajouter</button>
          </div>
        </Modal>
      )}
    </div>
  );
}