import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { CATEGORIES, dateFr, fcfa, LIBELLES_STATUT } from '../../lib/format';
import { Alerte, Badge, Btn, Chargement, EnTete, Modale, Vide, useAction } from '../../components/ui';
import { ClientForm } from '../../components/ClientForm';

export default function ClientDetail() {
  const { id } = useParams(); const { ctx } = useAuth(); const qc = useQueryClient();
  const { enCours, lancer } = useAction();
  const [edition, setEdition] = useState(false);
  const [cat, setCat] = useState('homme');
  const [vals, setVals] = useState<Record<string, string>>({});

  const client = useQuery({ queryKey: ['client', id], queryFn: async () => { const { data, error } = await supabase.from('clients').select('*').eq('id', id!).single(); if (error) throw error; return data; } });
  const champs = useQuery({ queryKey: ['champs'], queryFn: async () => { const { data, error } = await supabase.from('mesure_champs').select('*').eq('actif', true).order('ordre'); if (error) throw error; return data; } });
  const mesures = useQuery({ queryKey: ['mesures', id], enabled: peut(ctx, 'mesures.voir'), queryFn: async () => { const { data, error } = await supabase.from('client_mesures').select('champ_id, valeur').eq('client_id', id!); if (error) throw error; return data; } });
  const commandes = useQuery({ queryKey: ['client-commandes', id], enabled: peut(ctx, 'commandes.voir'), queryFn: async () => { const { data, error } = await supabase.from('commandes').select('id, code, total_fcfa, statut, date_rdv, created_at').eq('client_id', id!).order('created_at', { ascending: false }); if (error) throw error; return data; } });

  useEffect(() => {
    if (mesures.data) setVals(Object.fromEntries(mesures.data.map((m: any) => [m.champ_id, String(m.valeur)])));
  }, [mesures.data]);

  if (client.isLoading) return <Chargement />;
  if (client.error) return <Alerte ton="err">{msgErreur(client.error)}</Alerte>;
  const c = client.data;
  const peutMesures = peut(ctx, 'mesures.modifier');

  const enregistrerMesures = () => lancer(async () => {
    const lignes: any[] = []; const aSupprimer: string[] = [];
    for (const ch of champs.data ?? []) {
      const brut = (vals[ch.id] ?? '').replace(',', '.').trim();
      if (brut === '') { if (mesures.data?.some((m: any) => m.champ_id === ch.id)) aSupprimer.push(ch.id); continue; }
      const n = Number(brut);
      if (!isFinite(n) || n < 0 || n > 999) throw new Error(`Mesure invalide : ${ch.libelle}`);
      lignes.push({ client_id: id, champ_id: ch.id, atelier_id: ctx!.atelier!.id, valeur: n, updated_at: new Date().toISOString() });
    }
    if (lignes.length) { const { error } = await supabase.from('client_mesures').upsert(lignes, { onConflict: 'client_id,champ_id' }); if (error) throw error; }
    if (aSupprimer.length) { const { error } = await supabase.from('client_mesures').delete().eq('client_id', id!).in('champ_id', aSupprimer); if (error) throw error; }
    qc.invalidateQueries({ queryKey: ['mesures', id] });
  }, 'Mesures enregistrées.', (e) => (e as any)?.message?.startsWith('Mesure invalide') ? (e as any).message : msgErreur(e));

  return (
    <>
      <EnTete titre={`${c.prenom} ${c.nom}`} retour="/app/clients">
        {peut(ctx, 'clients.modifier') && <Btn variante="sec" onClick={() => setEdition(true)}>Modifier</Btn>}
        {peut(ctx, 'clients.modifier') && <Btn variante="sec" disabled={enCours} onClick={() => lancer(async () => { const { error } = await supabase.from('clients').update({ archived_at: c.archived_at ? null : new Date().toISOString() }).eq('id', c.id); if (error) throw error; qc.invalidateQueries({ queryKey: ['client', id] }); }, c.archived_at ? 'Client restauré.' : 'Client archivé. Son historique est conservé.', msgErreur)}>{c.archived_at ? 'Restaurer' : 'Archiver'}</Btn>}
        {peut(ctx, 'commandes.creer') && !c.archived_at && <Link className="btn" to={`/app/commandes/nouvelle?client=${c.id}`}>Nouvelle commande</Link>}
      </EnTete>
      <div className="carte"><p style={{ margin: 0 }}>Téléphone : <b>{c.telephone_e164 ?? '—'}</b> · WhatsApp : <b>{c.whatsapp_e164 ?? '—'}</b></p>{c.notes && <p className="muted" style={{ margin: '.4rem 0 0' }}>{c.notes}</p>}</div>

      {peut(ctx, 'mesures.voir') && (
        <>
          <h2 style={{ margin: '1.4rem 0 .7rem' }}>Mesures</h2>
          <div className="onglets">{Object.entries(CATEGORIES).map(([k, l]) => <button key={k} type="button" className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}</div>
          <div className="carte"><div className="grille2">
            {(champs.data ?? []).filter((ch: any) => ch.categorie === cat).map((ch: any) => (
              <div className="champ" key={ch.id}><label>{ch.libelle} ({ch.unite})</label>
                <input className="input" inputMode="decimal" disabled={!peutMesures} value={vals[ch.id] ?? ''} onChange={(e) => setVals({ ...vals, [ch.id]: e.target.value })} /></div>))}
          </div>
            {peutMesures && <Btn chargement={enCours} onClick={enregistrerMesures}>Enregistrer les mesures</Btn>}
            <p className="muted petit" style={{ marginBottom: 0, marginTop: '.6rem' }}>Les mesures sont reprises automatiquement dans les nouvelles commandes, et restent modifiables à ce moment-là.</p>
          </div>
        </>
      )}

      {peut(ctx, 'commandes.voir') && (
        <>
          <h2 style={{ margin: '1.4rem 0 .7rem' }}>Historique des commandes</h2>
          {commandes.data && !commandes.data.length && <Vide titre="Aucune commande" />}
          <div className="pile">{commandes.data?.map((o: any) => (
            <Link key={o.id} to={`/app/commandes/${o.id}`} className="carte cliquable ligne"><b>{o.code}</b><span className="muted petit">{dateFr(o.created_at)}</span><span className="espace" /><span>{fcfa(o.total_fcfa)}</span><Badge>{LIBELLES_STATUT[o.statut]}</Badge></Link>))}</div>
        </>
      )}
      <Modale ouverte={edition} titre="Modifier le client" onFermer={() => setEdition(false)}>
        <ClientForm client={c} onFait={() => { setEdition(false); qc.invalidateQueries({ queryKey: ['client', id] }); }} />
      </Modale>
    </>
  );
}
