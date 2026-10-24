import { database, seed } from '../lib/db.mjs';
try { await seed(); console.log('Seed complete: Dwight admin, three unpriced inactive services, and a closed schedule. Existing settings preserved.'); }
finally { const { client } = await database(); await client.close(); }
