'use client';
import { useState } from 'react';
import { businessPhone } from '../lib/business.mjs';
export default function StaffEditor({ staff, busy, onSave }) {
 const [data,setData]=useState(staff);
 return <form onSubmit={e=>{e.preventDefault();onSave(data);}}><h2>Staff & customer contact</h2><p>The business phone appears on booking confirmations and invoices. This section does not change admin sign-in access.</p><div className="field-grid"><label>Staff name<input required maxLength={100} value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></label><label>Business phone<input type="tel" maxLength={40} placeholder={businessPhone} value={data.phone} onChange={e=>setData({...data,phone:e.target.value})}/></label></div>{!data.phone&&<p className="fine">Leave blank to use the main business number, {businessPhone}.</p>}<button className="button" disabled={busy}>Save staff details →</button><p className="fine">Manage Stripe, Venmo, and other accepted payment methods in Payments.</p></form>;
}
