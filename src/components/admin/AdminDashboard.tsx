import { useState, useEffect } from 'react';
import { clearAdminSession, isAdminSessionValid } from '~/lib/admin-auth';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/** Anonymized demo rows only — never real customer PII */
const MOCK_ORDERS = [
  {
    id: 'ORD-DEMO-01',
    customer: 'Customer A',
    email: 'hidden@example.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    total: 1800,
    items: 2,
    status: 'NOT_FULFILLED',
  },
  {
    id: 'ORD-DEMO-02',
    customer: 'Customer B',
    email: 'hidden@example.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    total: 4500,
    items: 5,
    status: 'FULFILLED',
  },
  {
    id: 'ORD-DEMO-03',
    customer: 'Customer C',
    email: 'hidden@example.com',
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    total: 900,
    items: 1,
    status: 'NOT_FULFILLED',
  },
];

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  NOT_FULFILLED: { bg: '#fef08a', text: '#854d0e', label: 'Processing' },
  FULFILLED: { bg: '#bbf7d0', text: '#166534', label: 'Shipped' },
  CANCELED: { bg: '#fecaca', text: '#991b1b', label: 'Cancelled' },
};

function fmtCurrency(val: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

export default function AdminDashboard() {
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');
  const [orders, setOrders] = useState(MOCK_ORDERS);

  // Auth Guard — session token with expiry (not a boolean flag)
  useEffect(() => {
    try { localStorage.removeItem('fm:admin_auth'); } catch {}
    if (!isAdminSessionValid()) {
      window.location.replace(`${BASE}/admin/login`);
      return;
    }
    setAuthChecked(true);
    setOrders(MOCK_ORDERS);
  }, []);

  if (!authChecked) return null;

  const handleLogout = () => {
    clearAdminSession();
    window.location.replace(`${BASE}/admin/login`);
  };

  const updateOrderStatus = (id: string, newStatus: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  // KPIs
  const totalRevenue = orders.filter(o => o.status !== 'CANCELED').reduce((sum, o) => sum + o.total, 0);
  const processingCount = orders.filter(o => o.status === 'NOT_FULFILLED').length;
  const totalOrders = orders.length;

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span style={{ fontSize: '1.5rem' }}>🥭</span>
          <div>
            <div style={{ fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>Control Center</div>
            <div style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>FreshMangoes HQ</div>
          </div>
        </div>

        <nav className="admin-nav">
          <button 
            className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📦 Orders
            {processingCount > 0 && <span className="admin-badge">{processingCount}</span>}
          </button>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button className="admin-logout-btn" onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <h1 className="admin-page-title">
            {activeTab === 'overview' ? 'Dashboard Overview' : 'Order Management'}
          </h1>
          <div className="admin-user-info">
            <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Logged in as</span>
            <div className="admin-avatar">A</div>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === 'overview' && (
            <div className="admin-overview">
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">Total Revenue</div>
                  <div className="kpi-value" style={{ color: '#bbf7d0' }}>{fmtCurrency(totalRevenue)}</div>
                  <div className="kpi-trend">↑ 12% from last week</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Orders</div>
                  <div className="kpi-value">{totalOrders}</div>
                  <div className="kpi-trend">Lifetime volume</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Action Required</div>
                  <div className="kpi-value" style={{ color: '#fef08a' }}>{processingCount}</div>
                  <div className="kpi-trend">Orders awaiting shipment</div>
                </div>
              </div>

              <div className="admin-panel">
                <h2 className="admin-panel-title">Recent Activity</h2>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 3).map(order => {
                        const badge = STATUS_BADGES[order.status] || STATUS_BADGES.NOT_FULFILLED;
                        return (
                          <tr key={order.id}>
                            <td style={{ fontWeight: 500 }}>{order.id}</td>
                            <td>{order.customer}</td>
                            <td>
                              <span className="status-badge" style={{ background: badge.bg, color: badge.text }}>
                                {badge.label}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCurrency(order.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="admin-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="admin-panel-title" style={{ margin: 0 }}>All Orders</h2>
                <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Showing {orders.length} orders</div>
              </div>
              
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const dateObj = new Date(order.date);
                      const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })} ${dateObj.getFullYear()}`;
                      const badge = STATUS_BADGES[order.status] || STATUS_BADGES.NOT_FULFILLED;
                      
                      return (
                        <tr key={order.id}>
                          <td style={{ fontWeight: 500 }}>{order.id}</td>
                          <td style={{ color: '#a1a1aa' }}>{dateStr}</td>
                          <td>
                            <div>{order.customer}</div>
                            <div style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>{order.email}</div>
                          </td>
                          <td>{order.items} box{order.items > 1 ? 'es' : ''}</td>
                          <td style={{ fontWeight: 500 }}>{fmtCurrency(order.total)}</td>
                          <td>
                            <span className="status-badge" style={{ background: badge.bg, color: badge.text }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <select 
                              className="admin-select"
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            >
                              <option value="NOT_FULFILLED">Mark Processing</option>
                              <option value="FULFILLED">Mark Shipped</option>
                              <option value="CANCELED">Cancel Order</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .admin-container {
          display: flex;
          min-height: 100vh;
          background: #09090b;
          color: #ededed;
          font-family: 'Inter', sans-serif;
        }
        
        /* Sidebar */
        .admin-sidebar {
          width: 260px;
          background: #18181b;
          border-right: 1px solid #27272a;
          display: flex;
          flex-direction: column;
        }
        .admin-brand {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid #27272a;
        }
        .admin-nav {
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .admin-nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          color: #a1a1aa;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }
        .admin-nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #ededed;
        }
        .admin-nav-item.active {
          background: #27272a;
          color: #fff;
        }
        .admin-badge {
          background: #eab308;
          color: #422006;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.1rem 0.4rem;
          border-radius: 99px;
        }
        .admin-logout-btn {
          width: 100%;
          padding: 0.75rem;
          background: transparent;
          border: 1px solid #3f3f46;
          color: #a1a1aa;
          border-radius: 6px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .admin-logout-btn:hover {
          background: #3f3f46;
          color: #fff;
        }

        /* Main Content */
        .admin-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .admin-header {
          height: 70px;
          padding: 0 2rem;
          border-bottom: 1px solid #27272a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #18181b;
        }
        .admin-page-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          color: #fff;
        }
        .admin-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .admin-avatar {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #eab308, #ca8a04);
          color: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
        }
        .admin-content {
          padding: 2rem;
          overflow-y: auto;
          flex: 1;
        }

        /* Dashboard specific */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .kpi-card {
          background: #18181b;
          border: 1px solid #27272a;
          padding: 1.5rem;
          border-radius: 12px;
        }
        .kpi-label {
          font-size: 0.85rem;
          color: #a1a1aa;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }
        .kpi-value {
          font-size: 2rem;
          font-weight: 600;
          color: #fff;
          margin-bottom: 0.5rem;
        }
        .kpi-trend {
          font-size: 0.75rem;
          color: #a1a1aa;
        }

        .admin-panel {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 1.5rem;
        }
        .admin-panel-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 1.5rem 0;
          color: #fff;
        }

        /* Tables */
        .admin-table-wrapper {
          overflow-x: auto;
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .admin-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          color: #a1a1aa;
          font-weight: 500;
          border-bottom: 1px solid #27272a;
        }
        .admin-table td {
          padding: 1rem;
          border-bottom: 1px solid #27272a;
          vertical-align: middle;
        }
        .admin-table tr:last-child td {
          border-bottom: none;
        }
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .admin-select {
          background: #09090b;
          border: 1px solid #3f3f46;
          color: #ededed;
          padding: 0.4rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          outline: none;
          cursor: pointer;
        }
        .admin-select:focus {
          border-color: #eab308;
        }
      `}</style>
    </div>
  );
}
