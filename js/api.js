/* ============================================================
   BiteBox API client — single place for backend communication.
   API-first with graceful fallback: if the backend is offline,
   callers fall back to the existing localStorage/demo behavior.
   ============================================================ */
window.BB_API = (() => {
  /* Deployment: set window.BB_API_BASE before this script loads, or edit this
     default. Dev default is the local Spring Boot server on :8081. */
  const BASE = window.BB_API_BASE || "http://localhost:8081";
  const TOKEN_KEY = "biteboxToken";
  const USER_KEY = "biteboxApiUser";

  /* ---------- token / session ---------- */
  const token = () => localStorage.getItem(TOKEN_KEY);
  const setSession = (auth) => {
    if (auth && auth.token) localStorage.setItem(TOKEN_KEY, auth.token);
    if (auth) localStorage.setItem(USER_KEY, JSON.stringify({
      userId: auth.userId, name: auth.name, email: auth.email,
      phone: auth.phone, role: auth.role
    }));
  };
  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };
  const apiUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  };

  /* ---------- core request ---------- */
  async function request(path, { method = "GET", body, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth && token()) headers["Authorization"] = "Bearer " + token();
    const res = await fetch(BASE + path, {
      method, headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data && (data.error || (data.fields && Object.values(data.fields)[0]))) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const get  = (p, o) => request(p, { ...o, method: "GET" });
  const post = (p, b, o) => request(p, { ...o, method: "POST", body: b });
  const put  = (p, b, o) => request(p, { ...o, method: "PUT", body: b });
  const patch= (p, b, o) => request(p, { ...o, method: "PATCH", body: b });
  const del  = (p, o) => request(p, { ...o, method: "DELETE" });

  /* ---------- health ---------- */
  async function health() {
    try {
      const res = await fetch(BASE + "/api/menu", { method: "GET" });
      return res.ok;
    } catch { return false; }
  }

  /* ---------- auth ---------- */
  const authApi = {
    register: (name, email, phone, password) =>
      post("/api/auth/register", { name, email, phone, password }, { auth: false }),
    login: (email, password) =>
      post("/api/auth/login", { email, password }, { auth: false })
  };

  /* ---------- menu ---------- */
  const menuApi = {
    list: (category, q) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      const qs = params.toString();
      return get("/api/menu" + (qs ? "?" + qs : ""), { auth: false });
    },
    get: (id) => get(`/api/menu/${id}`, { auth: false }),
    create: (item) => post("/api/menu", item),
    update: (id, item) => put(`/api/menu/${id}`, item),
    remove: (id) => del(`/api/menu/${id}`)
  };

  /* ---------- orders ---------- */
  /* Convert backend OrderResponse -> existing ticket shape so
     orders.js / ordered.html keep working unchanged. */
  const orderToTicket = (o) => ({
    id: o.orderRef,
    createdAt: o.createdAt,
    status: o.status || "PENDING",
    customer: {
      name: o.customerName,
      email: o.customerEmail,
      phone: o.customerPhone,
      house: o.house, street: o.street, city: o.city,
      state: o.state, pin: o.pin,
      instructions: o.instructions,
      payment: o.paymentMethod
    },
    items: (o.items || []).map(i => ({
      name: i.name, category: i.category, price: Number(i.price),
      img: i.imageUrl, quantity: i.quantity
    })),
    subtotal: Number(o.subtotal || 0),
    delivery: Number(o.deliveryCharge || 0),
    packaging: Number(o.packagingCharge || 0),
    discount: Number(o.discount || 0),
    coupon: o.couponCode || null,
    total: Number(o.total || 0)
  });

  const orderApi = {
    create: (payload) => post("/api/orders", payload),
    mine: () => get("/api/orders"),
    get: (ref) => get(`/api/orders/${ref}`),
    toTicket: orderToTicket
  };

  /* ---------- admin ---------- */
  const adminApi = {
    stats: () => get("/api/admin/stats"),
    orders: () => get("/api/admin/orders"),
    updateStatus: (ref, status) => patch(`/api/admin/orders/${ref}/status`, { status }),
    customers: () => get("/api/admin/customers"),
    analytics: () => get("/api/admin/analytics")
  };

  return {
    BASE, token, setSession, clearSession, apiUser, health,
    auth: authApi, menu: menuApi, orders: orderApi, admin: adminApi,
    get, post, put, patch, del
  };
})();
