import { useEffect, useState } from 'react';
import { getDb } from './db';

export function App() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { getDb().then((db) => db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises')).then((r) => setN(r?.n ?? 0)); }, []);
  return <p>exercises: {n ?? '…'}</p>;
}
