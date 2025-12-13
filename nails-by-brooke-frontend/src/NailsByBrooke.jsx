import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  Users,
  Home,
  Plus,
  X,
  Edit2,
  Trash2,
  LogOut,
  BarChart3
} from 'lucide-react';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const NailsByBrooke = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [apptForm, setApptForm] = useState({
    client_id: '',
    appointment_date: '',
    service: '',
    price: '',
    tip: '',
    paid: false,
    notes: '',
  });
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState({ monthly: [], annual: [], year: new Date().getFullYear() });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');


  // ---------- API helper ----------
  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  };

  // ---------- Auth ----------
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      setToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setClients([]);
    setAppointments([]);
    setCurrentPage('dashboard');
  };

  // ---------- Load data ----------
  useEffect(() => {
    if (isAuthenticated && token) {
      loadClients();
      loadAppointments();
    }
  }, [isAuthenticated, token]);

  //This might need to be moved.
  useEffect(() => {
    if (isAuthenticated && token && currentPage === 'reports') {
      loadReport(reportYear);
    }
  }, [isAuthenticated, token, currentPage, reportYear]);

  const loadClients = async () => {
    try {
      const data = await apiCall('/clients');
      setClients(data.clients);
    } catch (err) {
      console.error('Error loading clients:', err);
      setError('Failed to load clients');
    }
  };

  const loadAppointments = async () => {
    try {
      const data = await apiCall('/appointments');
      setAppointments(data.appointments);
    } catch (err) {
      console.error('Error loading appointments:', err);
      setError('Failed to load appointments');
    }
  };

  const loadReport = async (year) => {
    try {
      setReportError('');
      setReportLoading(true);

      const data = await apiCall(`/reports/summary?year=${year}`);
      setReportData({
        monthly: data.monthly || [],
        annual: data.annual || [],
        year: data.year || year
      });
    } catch (err) {
      console.error('Error loading report:', err);
      setReportError('Failed to load report');
    } finally {
      setReportLoading(false);
    }
  };

  const downloadReportPdf = async () => {
    try {
      setReportError('');

      const response = await fetch(`${API_BASE_URL}/reports/summary/pdf?year=${reportYear}`, {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nails-by-brooke-income-report-${reportYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setReportError('Failed to download PDF');
    }
  };


  // ---------- Client CRUD ----------
  const addClient = async () => {
    try {
      await apiCall('/clients', {
        method: 'POST',
        body: JSON.stringify(clientForm),
      });
      await loadClients();
      setClientForm({ name: '', phone: '', email: '', notes: '' });
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateClient = async () => {
    try {
      await apiCall(`/clients/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(clientForm),
      });
      await loadClients();
      setClientForm({ name: '', phone: '', email: '', notes: '' });
      setEditingId(null);
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteClient = async (id) => {
    if (window.confirm('Delete this client? This will also delete all their appointments.')) {
      try {
        await apiCall(`/clients/${id}`, { method: 'DELETE' });
        await loadClients();
        await loadAppointments();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  // ---------- Appointment CRUD ----------
  const addAppointment = async () => {
    try {
      await apiCall('/appointments', {
        method: 'POST',
        body: JSON.stringify(apptForm),
      });
      await loadAppointments();
      setApptForm({
        client_id: '',
        appointment_date: '',
        service: '',
        price: '',
        tip: '',
        paid: false,
        notes: '',
      });
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateAppointment = async () => {
    try {
      await apiCall(`/appointments/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(apptForm),
      });
      await loadAppointments();
      setApptForm({
        client_id: '',
        appointment_date: '',
        service: '',
        price: '',
        tip: '',
        paid: false,
        notes: '',
      });
      setEditingId(null);
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteAppointment = async (id) => {
    if (window.confirm('Delete this appointment?')) {
      try {
        await apiCall(`/appointments/${id}`, { method: 'DELETE' });
        await loadAppointments();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const togglePaid = async (id, currentPaid) => {
    try {
      await apiCall(`/appointments/${id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paid: !currentPaid }),
      });
      await loadAppointments();
    } catch (err) {
      setError(err.message);
    }
  };

  // ---------- Modal helpers ----------
  const openModal = (type, item = null) => {
    setModalType(type);
    if (item) {
      setEditingId(item.id);
      if (type === 'client') {
        setClientForm({
          name: item.name || '',
          phone: item.phone || '',
          email: item.email || '',
          notes: item.notes || '',
        });
      } else {
        setApptForm({
          client_id: item.client_id,
          appointment_date: item.appointment_date,
          service: item.service,
          price: item.price,
          tip: item.tip,
          paid: item.paid,
          notes: item.notes || '',
        });
      }
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setClientForm({ name: '', phone: '', email: '', notes: '' });
    setApptForm({
      client_id: '',
      appointment_date: '',
      service: '',
      price: '',
      tip: '',
      paid: false,
      notes: '',
    });
  };

  // ---------- Derived totals ----------
  const totalEarnings = appointments
    .filter((a) => a.paid)
    .reduce((sum, a) => sum + parseFloat(a.price || 0) + parseFloat(a.tip || 0), 0);

  const pendingPayments = appointments
    .filter((a) => !a.paid)
    .reduce((sum, a) => sum + parseFloat(a.price || 0) + parseFloat(a.tip || 0), 0);

  const totalTips = appointments
    .filter((a) => a.paid)
    .reduce((sum, a) => sum + parseFloat(a.tip || 0), 0);

  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
    .slice(0, 5);

  // Determine which years are available for Reports dropdown
  const appointmentYears = Array.from(
    new Set(
      appointments
        .filter(a => a.appointment_date)
        .map(a => new Date(a.appointment_date).getFullYear())
    )
  ).sort((a, b) => a - b);

  // Ensure at least current year if no data
  if (appointmentYears.length === 0) {
    appointmentYears.push(new Date().getFullYear());
  }


  // ---------- Monthly summary ----------
  const monthlySummaryMap = appointments
    .filter((a) => a.paid && a.appointment_date)
    .reduce((acc, a) => {
      const date = new Date(a.appointment_date);
      if (Number.isNaN(date.getTime())) return acc;

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      const price = parseFloat(a.price || 0);
      const tip = parseFloat(a.tip || 0);

      if (!acc[key]) {
        acc[key] = {
          year,
          month,
          appointmentCount: 0,
          serviceTotal: 0,
          tipTotal: 0,
          grandTotal: 0,
        };
      }

      acc[key].appointmentCount += 1;
      acc[key].serviceTotal += price;
      acc[key].tipTotal += tip;
      acc[key].grandTotal += price + tip;

      return acc;
    }, {});

  const monthlySummaries = Object.values(monthlySummaryMap).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  // ---------- Auth screen ----------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full border border-stone-200">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[var(--blush)] mb-2">
              💅 Nails by Brooke
            </h1>
            <p className="text-gray-600">Sign in to manage your business</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Email
              </label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)]"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Password
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--blush)] text-white py-3 rounded-lg hover:bg-[var(--blush-dark)] transition-colors font-semibold disabled:bg-gray-400"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------- Main app ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100">
      <header className="bg-[var(--blush)] text-white shadow-md">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">💅 Nails by Brooke</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-rose-50/90">
              Welcome, {user && user.name}!
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors text-sm font-medium"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="container mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex justify-between items-center text-sm">
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="text-red-900 hover:text-red-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <nav className="bg-white/80 backdrop-blur shadow-sm border-b border-stone-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-center space-x-2 py-3">
            {[
              { id: 'dashboard', icon: Home, label: 'Dashboard' },
              { id: 'clients', icon: Users, label: 'Clients' },
              { id: 'appointments', icon: Calendar, label: 'Appointments' },
              { id: 'transactions', icon: DollarSign, label: 'Transactions' },
              { id: 'reports', icon: BarChart3, label: 'Reports' }
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                  currentPage === id
                    ? 'bg-[var(--blush)] border-[var(--blush)] text-white'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* ---------- Dashboard ---------- */}
        {currentPage === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-stone-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">
                      Total Clients
                    </p>
                    <p className="text-3xl font-bold text-[var(--blush)] mt-1">
                      {clients.length}
                    </p>
                  </div>
                  <Users className="text-stone-300" size={40} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-emerald-400 border border-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">
                      Total Earnings
                    </p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      ${totalEarnings.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="text-emerald-200" size={40} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-[var(--blush)] border border-stone-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">
                      Total Tips
                    </p>
                    <p className="text-3xl font-bold text-[var(--blush)] mt-1">
                      ${totalTips.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="text-stone-300" size={40} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-amber-300 border border-amber-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">
                      Pending
                    </p>
                    <p className="text-3xl font-bold text-amber-500 mt-1">
                      ${pendingPayments.toFixed(2)}
                    </p>
                  </div>
                  <Calendar className="text-amber-200" size={40} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-stone-200">
              <h2 className="text-xl font-semibold text-stone-800 mb-4">
                Recent Appointments
              </h2>
              {recentAppointments.length === 0 ? (
                <p className="text-stone-500">No appointments yet</p>
              ) : (
                <div className="space-y-3">
                  {recentAppointments.map((appt) => {
                    const total =
                      parseFloat(appt.price || 0) + parseFloat(appt.tip || 0);
                    return (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-3 bg-stone-50 rounded-lg"
                      >
                        <div>
                          <p className="font-semibold text-stone-800">
                            {appt.client_name}
                          </p>
                          <p className="text-xs text-stone-500">
                            {appt.service} • {appt.appointment_date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[var(--blush)]">
                            ${total.toFixed(2)}
                          </p>
                          {appt.tip > 0 && (
                            <p className="text-xs text-stone-500">
                              (+${appt.tip} tip)
                            </p>
                          )}
                          <span
                            className={`inline-block mt-1 text-xs px-2 py-1 rounded-full border ${
                              appt.paid
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}
                          >
                            {appt.paid ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- Clients ---------- */}
        {currentPage === 'clients' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-stone-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-stone-800">Clients</h2>
              <button
                onClick={() => openModal('client')}
                className="bg-[var(--blush)] text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-[var(--blush-dark)] text-sm font-medium shadow-sm"
              >
                <Plus size={18} /> Add Client
              </button>
            </div>
            {clients.length === 0 ? (
              <p className="text-stone-500 text-center py-8">
                No clients yet. Add your first client!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-stone-800">
                        {client.name}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal('client', client)}
                          className="text-sky-600 hover:text-sky-800"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteClient(client.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-stone-600">📞 {client.phone}</p>
                    {client.email && (
                      <p className="text-sm text-stone-600">✉️ {client.email}</p>
                    )}
                    {client.notes && (
                      <p className="text-sm text-stone-500 mt-2">
                        {client.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- Appointments ---------- */}
        {currentPage === 'appointments' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-stone-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-stone-800">
                Appointments
              </h2>
              <button
                onClick={() => openModal('appointment')}
                className="bg-[var(--blush)] text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-[var(--blush-dark)] text-sm font-medium shadow-sm"
              >
                <Plus size={18} /> Add Appointment
              </button>
            </div>
            {appointments.length === 0 ? (
              <p className="text-stone-500 text-center py-8">
                No appointments yet. Add your first appointment!
              </p>
            ) : (
              <div className="space-y-3">
                {[...appointments]
                  .sort(
                    (a, b) =>
                      new Date(b.appointment_date) -
                      new Date(a.appointment_date),
                  )
                  .map((appt) => {
                    const total =
                      parseFloat(appt.price || 0) + parseFloat(appt.tip || 0);
                    return (
                      <div
                        key={appt.id}
                        className="border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-stone-800">
                              {appt.client_name}
                            </h3>
                            <p className="text-sm text-stone-600">
                              {appt.service}
                            </p>
                            <p className="text-xs text-stone-500">
                              📅 {appt.appointment_date}
                            </p>
                            {appt.notes && (
                              <p className="text-sm text-stone-500 mt-1">
                                {appt.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-[var(--blush)]">
                              ${total.toFixed(2)}
                            </p>
                            <p className="text-xs text-stone-500">
                              Service: ${appt.price}
                            </p>
                            {appt.tip > 0 && (
                              <p className="text-xs text-stone-500">
                                Tip: ${appt.tip}
                              </p>
                            )}
                            <button
                              onClick={() => togglePaid(appt.id, appt.paid)}
                              className={`text-xs px-3 py-1 rounded-full mt-1 border ${
                                appt.paid
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700'
                              }`}
                            >
                              {appt.paid ? '✓ Paid' : 'Pending'}
                            </button>
                            <div className="flex gap-2 mt-2 justify-end">
                              <button
                                onClick={() => openModal('appointment', appt)}
                                className="text-sky-600 hover:text-sky-800"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteAppointment(appt.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ---------- Transactions + Monthly Summary ---------- */}
        {currentPage === 'transactions' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-stone-200">
            <h2 className="text-2xl font-semibold text-stone-800 mb-6">
              Transaction History
            </h2>

            {/* Monthly summary */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-stone-800 mb-3">
                Monthly Summary (Paid Appointments)
              </h3>
              {monthlySummaries.length === 0 ? (
                <p className="text-stone-500 text-sm">
                  No paid appointments yet to summarize.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-stone-200 bg-stone-50/60">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-stone-100 text-left">
                        <th className="px-4 py-2 font-semibold text-stone-700">
                          Month
                        </th>
                        <th className="px-4 py-2 font-semibold text-stone-700">
                          # Appts
                        </th>
                        <th className="px-4 py-2 font-semibold text-stone-700">
                          Service Total
                        </th>
                        <th className="px-4 py-2 font-semibold text-stone-700">
                          Tip Total
                        </th>
                        <th className="px-4 py-2 font-semibold text-stone-700">
                          Grand Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummaries.map((m) => {
                        const monthName = new Date(
                          m.year,
                          m.month - 1,
                          1,
                        ).toLocaleString('default', { month: 'long' });
                        return (
                          <tr
                            key={`${m.year}-${m.month}`}
                            className="border-t border-stone-200"
                          >
                            <td className="px-4 py-2">
                              {monthName} {m.year}
                            </td>
                            <td className="px-4 py-2">
                              {m.appointmentCount}
                            </td>
                            <td className="px-4 py-2">
                              ${m.serviceTotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-2">
                              ${m.tipTotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 font-semibold text-[var(--blush)]">
                              ${m.grandTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Individual transactions */}
            {appointments.length === 0 ? (
              <p className="text-stone-500 text-center py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-2">
                {[...appointments]
                  .sort(
                    (a, b) =>
                      new Date(b.appointment_date) -
                      new Date(a.appointment_date),
                  )
                  .map((appt) => {
                    const total =
                      parseFloat(appt.price || 0) + parseFloat(appt.tip || 0);
                    return (
                      <div
                        key={appt.id}
                        className={`flex justify-between items-center p-4 rounded-lg border ${
                          appt.paid
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-stone-800">
                            {appt.client_name}
                          </p>
                          <p className="text-sm text-stone-600">
                            {appt.service} • {appt.appointment_date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[var(--blush)]">
                            ${total.toFixed(2)}
                          </p>
                          <p className="text-xs text-stone-500">
                            Service: ${appt.price}{' '}
                            {appt.tip > 0 && `+ Tip: $${appt.tip}`}
                          </p>
                          <span
                            className={`inline-block text-xs px-2 py-1 rounded-full border ${
                              appt.paid
                                ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                                : 'bg-amber-100 border-amber-200 text-amber-800'
                            }`}
                          >
                            {appt.paid ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Reporting */}
        {currentPage === 'reports' && (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-rose-700">Income Reports</h2>
          <p className="text-sm text-gray-600">
            Breakdown of paid appointments by month and year, with tips separated from service income.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <select
            value={reportYear}
            onChange={(e) => setReportYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            {appointmentYears.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={downloadReportPdf}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <BarChart3 size={16} />
            Download PDF
          </button>
        </div>
      </div>

      {reportError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {reportError}
        </div>
      )}

      {reportLoading ? (
        <p className="text-gray-500">Loading report…</p>
      ) : (
        <div className="space-y-8">
          {/* Monthly table */}
          <div>
            <h3 className="text-xl font-semibold text-rose-700 mb-3">
              Monthly Summary for {reportData.year}
            </h3>
            {reportData.monthly.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No paid appointments recorded for this year yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-rose-50 text-left">
                      <th className="px-3 py-2 font-semibold text-gray-700">Month</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Service Income</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Tips</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthly.map((row) => {
                      const monthName = new Date(reportData.year, row.month - 1, 1).toLocaleString(
                        'default',
                        { month: 'long' }
                      );
                      const service = parseFloat(row.service_total || 0);
                      const tips = parseFloat(row.tip_total || 0);
                      const total = parseFloat(row.grand_total || 0);
                      return (
                        <tr key={row.month} className="border-t border-rose-50">
                          <td className="px-3 py-2">{monthName}</td>
                          <td className="px-3 py-2">${service.toFixed(2)}</td>
                          <td className="px-3 py-2">${tips.toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold">${total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Annual table */}
          <div>
            <h3 className="text-xl font-semibold text-rose-700 mb-3">
              Annual Summary (All Years)
            </h3>
            {reportData.annual.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No paid appointments recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-rose-50 text-left">
                      <th className="px-3 py-2 font-semibold text-gray-700">Year</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Service Income</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Tips</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.annual.map((row) => {
                      const service = parseFloat(row.service_total || 0);
                      const tips = parseFloat(row.tip_total || 0);
                      const total = parseFloat(row.grand_total || 0);
                      return (
                        <tr key={row.year} className="border-t border-rose-50">
                          <td className="px-3 py-2">{row.year}</td>
                          <td className="px-3 py-2">${service.toFixed(2)}</td>
                          <td className="px-3 py-2">${tips.toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold">${total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Note: Reports include only appointments marked as <span className="font-semibold">Paid</span>.
          </p>
        </div>
      )}
    </div>
  )}

      </main>

      {/* ---------- Modal ---------- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-stone-800">
                {editingId ? 'Edit' : 'Add'}{' '}
                {modalType === 'client' ? 'Client' : 'Appointment'}
              </h3>
              <button
                onClick={closeModal}
                className="text-stone-400 hover:text-stone-600"
              >
                <X size={24} />
              </button>
            </div>

            {modalType === 'client' ? (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Name *"
                  value={clientForm.name}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={clientForm.phone}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={clientForm.email}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                />
                <textarea
                  placeholder="Notes"
                  value={clientForm.notes}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                  rows="3"
                />
                <button
                  onClick={editingId ? updateClient : addClient}
                  disabled={!clientForm.name || !clientForm.phone}
                  className="w-full bg-[var(--blush)] text-white py-2 rounded-lg hover:bg-[var(--blush-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {editingId ? 'Update' : 'Add'} Client
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <select
                  value={apptForm.client_id}
                  onChange={(e) =>
                    setApptForm({ ...apptForm, client_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                >
                  <option value="">Select Client *</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={apptForm.appointment_date}
                  onChange={(e) =>
                    setApptForm({
                      ...apptForm,
                      appointment_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                />
                <input
                  type="text"
                  placeholder="Service (e.g., Full Set, Fill) *"
                  value={apptForm.service}
                  onChange={(e) =>
                    setApptForm({ ...apptForm, service: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Service Price *"
                    value={apptForm.price}
                    onChange={(e) =>
                      setApptForm({ ...apptForm, price: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                    step="0.01"
                  />
                  <input
                    type="number"
                    placeholder="Tip Amount"
                    value={apptForm.tip}
                    onChange={(e) =>
                      setApptForm({ ...apptForm, tip: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                    step="0.01"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={apptForm.paid}
                    onChange={(e) =>
                      setApptForm({ ...apptForm, paid: e.target.checked })
                    }
                    className="w-4 h-4 text-[var(--blush)]"
                  />
                  <span className="text-stone-700">Payment Received</span>
                </label>
                <textarea
                  placeholder="Notes"
                  value={apptForm.notes}
                  onChange={(e) =>
                    setApptForm({ ...apptForm, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blush)] text-sm"
                  rows="2"
                />
                <button
                  onClick={editingId ? updateAppointment : addAppointment}
                  disabled={
                    !apptForm.client_id ||
                    !apptForm.appointment_date ||
                    !apptForm.service ||
                    !apptForm.price
                  }
                  className="w-full bg-[var(--blush)] text-white py-2 rounded-lg hover:bg-[var(--blush-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {editingId ? 'Update Appointment' : 'Add Appointment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NailsByBrooke;
