import { useState } from 'react';
import { Segmented } from '../ui/Segmented.jsx';
import { BillsTab } from '../admin/BillsTab.jsx';
import { AccessTab } from '../admin/AccessTab.jsx';
import { HealthTab } from '../admin/HealthTab.jsx';

const TABS = [{ value: 'bills', label: 'Bills' }, { value: 'access', label: 'Access' }, { value: 'health', label: 'Data health' }];

/**
 * Admin (admin only; the route is wrapped in RequireAccess and every call below is re-checked by the API).
 * Bills: upload, review, approve. Access: who can see real data. Data health: is it arriving, maintenance.
 */
export default function AdminPage() {
  const [tab, setTab] = useState('bills');
  return (
    <>
      <div style={{ alignSelf: 'flex-start' }}><Segmented small role="tablist" options={TABS} value={tab} onChange={setTab} label="Admin sections" /></div>
      {tab === 'bills' && <BillsTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'health' && <HealthTab />}
    </>
  );
}
