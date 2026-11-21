import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

const origin = process.env.EXPO_PUBLIC_API_ORIGIN?.replace(/\/$/, '');
const tokenKey = 'rentflow.session.v1';
class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const money = (value: string) => Number(value).toLocaleString('vi-VN') + ' đ';
type Lease = { id: string; room: { roomCode: string }; startDate: string; endDate: string; status: string };
type Dashboard = {
  actor: { fullName: string; role: string; email: string };
  invoices: { id: string; leaseId: string; billingPeriod: string; totalAmount: string; paidAmount: string; remainingAmount: string; dueDate: string }[];
  leases: Lease[];
  notifications: { id: string; message: string }[];
};
type Ledger = Lease & {
  rentAmount: string; tenants: { representative: boolean; tenant: { fullName: string } }[];
  depositAgreed: string; depositReceived: string;
  settlement: null | { deduction: string; debtOffset: string; refund: string; reason: string };
  invoices: {
    id: string; billingPeriod: string; dueDate: string; status: string; totalAmount: string; paidAmount: string; remainingAmount: string;
    items: { id: string; description: string; meterStart: string | null; meterEnd: string | null; quantity: string; snapshotUnitPrice: string; lineTotal: string }[];
    payments: { id: string; amount: string; method: string; status: string }[];
  }[];
};
const status: Record<string, string> = {
  ACTIVE: 'Đang thuê', DRAFT: 'Nháp', TERMINATED: 'Đã trả phòng', EXPIRED: 'Hết hạn',
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', REVERSED: 'Đã đảo',
  CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản', DEPOSIT: 'Bù cọc',
};

async function request<T>(path: string, token = '', body?: object): Promise<T> {
  if (!origin) throw new Error('Cần cấu hình địa chỉ API của RentFlow.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(origin + '/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).catch(() => { throw new Error('Không kết nối được RentFlow. Vui lòng thử lại.'); });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error([result?.message ?? 'Máy chủ chưa sẵn sàng.'].flat().join(' · '));
    return result as T;
  } finally { clearTimeout(timeout); }
}

function Button({ label, disabled, press }: { label: string; disabled: boolean; press: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={press}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [dash, setDash] = useState<Dashboard>();
  const [ledger, setLedger] = useState<Ledger>();
  const [expanded, setExpanded] = useState('');
  const [settlement, setSettlement] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void run(async () => {
      const saved = await SecureStore.getItemAsync(tokenKey);
      if (!saved) return;
      try {
        const overview = await request<Dashboard>('overview', saved);
        if (overview.actor.role !== 'RENTER') {
          await SecureStore.deleteItemAsync(tokenKey);
          return;
        }
        setDash(overview);
        setToken(saved);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await SecureStore.deleteItemAsync(tokenKey);
        throw error;
      }
    });
  }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }

  function login() {
    void run(async () => {
      const session = await request<{ token: string; actor: Dashboard['actor'] }>('login', '', { email: email.trim(), password });
      try {
        if (session.actor.role !== 'RENTER') throw new Error('Dùng tài khoản người thuê để đăng nhập.');
        const overview = await request<Dashboard>('overview', session.token);
        await SecureStore.setItemAsync(tokenKey, session.token);
        setDash(overview);
        setToken(session.token); setPassword('');
      } catch (error) {
        await request('logout', session.token, {}).catch(() => undefined);
        throw error;
      }
    });
  }

  const activeLease = dash?.leases.find(lease => lease.status === 'ACTIVE' || lease.status === 'EXPIRED');
  const latest = activeLease && dash?.invoices.filter(invoice => invoice.leaseId === activeLease.id)
    .sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod))[0];
  const date = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const website = (path: string) => void run(async () => {
    if (!origin) throw new Error('Ch?a c? ??a ch? website.');
    await Linking.openURL(origin + path);
  });

  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.page} contentContainerStyle={styles.content}>
    <StatusBar barStyle="dark-content" />
    <Text accessibilityRole="header" style={styles.title}>RentFlow</Text>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {busy && <ActivityIndicator color="#08674f" accessibilityLabel="Đang tải" />}
    {!dash ? <View style={styles.card}>
      <Text style={styles.heading}>Đăng nhập người thuê</Text>
      <TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput accessibilityLabel="Mật khẩu" value={password} onChangeText={setPassword} placeholder="Mật khẩu" secureTextEntry style={styles.input} />
      <Button label="Đăng nhập" disabled={busy || !email.trim() || !password} press={login} />
    </View> : <>
      <Text style={styles.heading}>{dash.actor.fullName}</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>T?ng quan</Text>
        <Text>{activeLease ? 'Ph?ng ' + activeLease.room.roomCode : 'Ch?a c? ph?ng ?ang thu?.'}</Text>
        {latest ? <Text>K? {latest.billingPeriod} ? T?ng {money(latest.totalAmount)} ? ?? thu {money(latest.paidAmount)} ? C?n n? {money(latest.remainingAmount)}</Text> : <Text>Ch?a c? h?a ??n cho ph?ng ?ang thu?.</Text>}
        <Button label="T?i d? li?u m?i" disabled={busy} press={() => void run(async () => {
          setDash(await request<Dashboard>('overview', token));
          if (ledger) setLedger(await request<Ledger>('leases/' + ledger.id + '/ledger', token));
        })} />
      </View>
      <Button label="Đăng xuất" disabled={busy} press={() => void run(async () => {
        try { await request('logout', token, {}); }
        catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
        await SecureStore.deleteItemAsync(tokenKey);
        setDash(undefined); setLedger(undefined); setToken('');
      })} />
      <Text style={styles.heading}>Sổ đối chiếu thuê trọ</Text>
      {!dash.leases.length && <Text>Chưa có hợp đồng.</Text>}
      {dash.leases.map(lease => <Button key={lease.id} label={lease.room.roomCode + ' · ' + (status[lease.status] ?? lease.status)} disabled={busy} press={() => void run(async () => {
        setLedger(await request<Ledger>('leases/' + lease.id + '/ledger', token));
        setExpanded(''); setSettlement(false);
      })} />)}
      {ledger && <View style={styles.card}>
        <Text style={styles.heading}>Phòng {ledger.room.roomCode}</Text>
        <Text>{new Date(ledger.startDate).toLocaleDateString('vi-VN')} – {new Date(ledger.endDate).toLocaleDateString('vi-VN')}</Text>
        <Text>Ti?n thu? {money(ledger.rentAmount)} ? {status[ledger.status] ?? ledger.status}</Text>
        {ledger.tenants.filter(member => member.representative).map(member => <Text key={member.tenant.fullName}>??i di?n {member.tenant.fullName}</Text>)}
        <Button label={settlement ? 'Thu gọn quyết toán' : 'Xem quyết toán'} disabled={busy} press={() => setSettlement(!settlement)} />
        {settlement && <>
          <Text>Cọc thỏa thuận {money(ledger.depositAgreed)} · Thực nhận {money(ledger.depositReceived)}</Text>
          {ledger.settlement ? <>
            <Text>Khấu trừ {money(ledger.settlement.deduction)} · Bù nợ {money(ledger.settlement.debtOffset)}</Text>
            <Text>{ledger.settlement.reason}</Text>
            <Text style={styles.heading}>Hoàn cọc {money(ledger.settlement.refund)}</Text>
          </> : <Text>Chưa chốt quyết toán.</Text>}
        </>}
        {ledger.invoices.map(invoice => <View key={invoice.id} style={styles.section}>
          <Text style={styles.heading}>Hóa đơn {invoice.billingPeriod}</Text>
          <Text>Tổng {money(invoice.totalAmount)} · Đã thu {money(invoice.paidAmount)} · Còn nợ {money(invoice.remainingAmount)}</Text>
          <Button label={expanded === invoice.id ? 'Thu gọn cách tính' : 'Xem cách tính'} disabled={busy} press={() => setExpanded(expanded === invoice.id ? '' : invoice.id)} />
          {expanded === invoice.id && <>
            {invoice.items.map(item => <Text key={item.id}>
              {item.description} · {item.meterStart !== null ? '(' + item.meterEnd + ' − ' + item.meterStart + ') = ' : ''}{item.quantity} × {money(item.snapshotUnitPrice)} = {money(item.lineTotal)}
            </Text>)}
            <Text style={styles.heading}>Lịch sử thanh toán</Text>
            {invoice.payments.map(payment => <Text key={payment.id}>{status[payment.method]} · {money(payment.amount)} · {status[payment.status]}</Text>)}
          </>}
        </View>)}
      </View>}
      <View style={styles.card}>
        <Text style={styles.heading}>Thông báo</Text>
        {dash.notifications.length ? dash.notifications.map(entry => <Text key={entry.id}>{entry.message}</Text>) : <Text>Chưa có thông báo.</Text>}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>T?i kho?n v? quy?n ri?ng t?</Text>
        <Text>{dash.actor.email}</Text>
        <Button label="Quy?n ri?ng t?" disabled={busy} press={() => website('/quyen-rieng-tu')} />
        <Button label="Y?u c?u x?a t?i kho?n" disabled={busy} press={() => website('/xoa-tai-khoan')} />
        <Button label="Li?n h? h? tr?" disabled={busy} press={() => void run(async () => { await Linking.openURL('mailto:hoangphung.tech@gmail.com'); })} />
      </View>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f8f4', paddingTop: (StatusBar.currentHeight ?? 0) + 12 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 34, color: '#08674f', fontWeight: '800' },
  heading: { fontSize: 18, color: '#102924', fontWeight: '700' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, gap: 10, borderColor: '#d3e2da', borderWidth: 1 },
  section: { borderTopColor: '#d3e2da', borderTopWidth: 1, marginTop: 6, paddingTop: 8, gap: 8 },
  button: { backgroundColor: '#08674f', minHeight: 44, padding: 12, borderRadius: 8, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#9eb5aa', padding: 10, borderRadius: 8 },
  error: { color: '#842700', backgroundColor: '#fff0e9', padding: 10 },
  disabled: { opacity: 0.55 },
});
