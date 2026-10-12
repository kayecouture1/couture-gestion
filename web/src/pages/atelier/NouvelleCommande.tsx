import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { CATEGORIES, dateFr, fcfa } from '../../lib/format';
import { compresserImage, televerser } from '../../lib/images';
import { useCircuits, useMembres, useRoles, useTypesVetements } from '../../lib/hooks';
import { Alerte, Btn, Champ, Chargement, EnTete, Modale, useAction } from '../../components/ui';
import { ClientForm, type ClientRow } from '../../components/ClientForm';
import { EditeurCircuit, etapeVide, verifierEtapes, type EtapeForm } from '../../components/EditeurCircuit';

interface HabitForm {
  cle: string; type_vetement_id: string; modele_id: string; categorie: string;
  photo_habit: { blob: Blob; apercu: string } | null; photo_modele: { blob: Blob; apercu: string } | null;
  mesures: Record<string, string>; circuit_id: string; etapes: EtapeForm[]; personnalise: boolean;
}
const nouvelHabit = (): HabitForm => ({ cle: crypto.randomUUID(), type_vetement_id: '', modele_id: '', categorie: 'homme', photo_habit: null, photo_modele: null, mesures: {}, circuit_id: '', etapes: [], personnalise: false });

export default function NouvelleCommande() {
  const { ctx } = useAuth(); const nav = useNavigate(); const [params] = useSearchParams();
  const { enCours, lancer } = useAction();
  const atelierId = ctx!.atelier!.id;

  const [client, setClient] = useState<ClientRow | null>(null);
  const [terme, setTerme] = useState(''); const [nouveauClient, setNouveauClient] = useState(false); const [clientsOuverte, setClientsOuverte] = useState(false);
  const [habits, setHabits] = useState<HabitForm[]>([nouvelHabit()]);
  const [total, setTotal] = useState(''); const [avance, setAvance] = useState('');
  const [note, setNote] = useState(''); const [majProfil, setMajProfil] = useState(true);
  const [rdv, setRdv] = useState<{ date: string; prop?: { date_proposee: string; statut: string; motif?: string } }>({ date: '' });
  const [propose, setPropose] = useState<string | null>(null);
  const [rejet, setRejet] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const types = useTypesVetements(); const circuits = useCircuits(); const roles = useRoles(); const membres = useMembres();
  const modeles = useQuery({ queryKey: ['modeles'], queryFn: async () => { const { data, error } = await supabase.from('modeles').select('id, nom, type_vetement_id, photo_path').eq('actif', true).order('nom'); if (error) throw error; return data as any[]; } });
  const champs = useQuery({ queryKey: ['champs'], queryFn: async () => { const { data, error } = await supabase.from('mesure_champs').select('*').eq('actif', true).order('ordre'); if (error) throw error; return data as any[]; } });
  const mesuresClient = useQuery({ queryKey: ['mesures', client?.id], enabled: !!client && peut(ctx, 'mesures.voir'),
    queryFn: async () => { const { data, error } = await supabase.from('client_mesures').select('champ_id, valeur').eq('client_id', client!.id); if (error) throw error; return data as any[]; } });
  const recherche = useQuery({ queryKey: ['recherche-client', terme], enabled: !client && terme.trim().length >= 2,
    queryFn: async () => { const t = terme.trim().replace(/[%,()]/g, ''); const { data, error } = await supabase.from('clients').select('id, nom, prenom, telephone_e164, whatsapp_e164, notes').is('archived_at', null).or(`nom.ilike.%${t}%,prenom.ilike.%${t}%,telephone_e164.ilike.%${t}%`).limit(8); if (error) throw error; return data as ClientRow[]; } });
  const clients = useQuery({
    queryKey: ['clients-selection-commande'],
    enabled: clientsOuverte,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, nom, prenom, telephone_e164, whatsapp_e164, notes').is('archived_at', null).order('nom').order('prenom').limit(300);
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  useEffect(() => { // client passé dans l'adresse (depuis la fiche client)
    const id = params.get('client');
    if (id && !client) supabase.from('clients').select('id, nom, prenom, telephone_e164, whatsapp_e164, notes').eq('id', id).maybeSingle().then(({ data }) => data && setClient(data as ClientRow));
  }, [params, client]);

  // Mesures du client reprises automatiquement (restent modifiables) pour les habits dont les champs sont vides.
  const preremplir = (h: HabitForm, force = false): HabitForm => {
    if (!mesuresClient.data || !champs.data) return h;
    const m: Record<string, string> = { ...h.mesures };
    for (const ch of champs.data.filter((c: any) => c.categorie === h.categorie)) {
      const v = mesuresClient.data.find((x: any) => x.champ_id === ch.id);
      if (v && (force || m[ch.id] === undefined)) m[ch.id] = String(v.valeur);
    }
    return { ...h, mesures: m };
  };
  useEffect(() => { setHabits((hs) => hs.map((h) => preremplir(h))); /* eslint-disable-next-line */ }, [mesuresClient.data, champs.data]);

  const maj = (cle: string, p: Partial<HabitForm>) => setHabits((hs) => hs.map((h) => (h.cle === cle ? { ...h, ...p } : h)));
  const choisirPhoto = async (cle: string, champ: 'photo_habit' | 'photo_modele', f?: File | null) => {
    if (!f) return maj(cle, { [champ]: null } as any);
    try { const blob = await compresserImage(f); maj(cle, { [champ]: { blob, apercu: URL.createObjectURL(blob) } } as any); }
    catch (e) { setErreur((e as Error).message); }
  };
  const choisirCircuit = (h: HabitForm, id: string) => {
    if (!id) return maj(h.cle, { circuit_id: '', personnalise: true, etapes: h.etapes.length ? h.etapes : [etapeVide()] });
    const c = circuits.data?.find((x) => x.id === id);
    // Copie des étapes dans l'habit : le modèle de circuit n'est jamais lié à l'habit après sa création.
    maj(h.cle, { circuit_id: id, personnalise: false, etapes: (c?.etapes ?? []).map((e: any) => ({ nom: e.nom, mode: e.mode, role_id: e.role_id ?? '', user_id: e.user_id ?? '' })) });
  };

  const nbHabits = habits.length;
  const proposer = () => lancer(async () => {
    const { data, error } = await supabase.rpc('proposer_date_rdv', { p_nb: nbHabits, p_apres: null });
    if (error) throw error; setPropose(data as string); setRdv({ date: '' });
  }, undefined, msgErreur);

  const montantTotal = Number(total.replace(/\s/g, '')) || 0, montantAvance = Number(avance.replace(/\s/g, '')) || 0;
  const typesActifs = useMemo(() => (types.data ?? []).filter((t) => t.actif), [types.data]);

  async function enregistrer() {
    setErreur(null);
    if (!client) return setErreur('Sélectionnez un client.');
    for (const [i, h] of habits.entries()) {
      if (!h.type_vetement_id) return setErreur(`Habit ${i + 1} : choisissez le type de vêtement.`);
      const ev = verifierEtapes(h.etapes); if (ev) return setErreur(`Habit ${i + 1} : ${ev}`);
    }
    if (!(montantTotal >= 0) || total.trim() === '') return setErreur('Indiquez le prix total.');
    if (montantAvance < 0 || montantAvance > montantTotal) return setErreur("L'avance ne peut pas dépasser le prix total.");
    if (montantAvance > 0 && !peut(ctx, 'paiements.enregistrer')) return setErreur("Vous n'avez pas l'autorisation d'enregistrer une avance.");
    if (!rdv.date) return setErreur('Choisissez une date de rendez-vous (proposition ou date manuelle).');

    await lancer(async () => {
      const lignes: any[] = [];
      for (const h of habits) {
        const tv = types.data?.find((t) => t.id === h.type_vetement_id); const mo = modeles.data?.find((m: any) => m.id === h.modele_id);
        let photoHabit: string | null = null, photoModele: string | null = mo?.photo_path ?? null;
        if (h.photo_habit) { photoHabit = `${atelierId}/habits/${crypto.randomUUID()}.jpg`; await televerser('photos-habits', photoHabit, h.photo_habit.blob); }
        if (h.photo_modele) { photoModele = `${atelierId}/habits/${crypto.randomUUID()}.jpg`; await televerser('photos-habits', photoModele, h.photo_modele.blob); }
        const mesures = (champs.data ?? []).filter((c: any) => c.categorie === h.categorie && (h.mesures[c.id] ?? '').trim() !== '')
          .map((c: any) => { const v = Number(h.mesures[c.id].replace(',', '.')); if (!isFinite(v) || v < 0) throw new Error(`Mesure invalide : ${c.libelle}`); return { champ_id: c.id, libelle: c.libelle, unite: c.unite, valeur: v }; });
        lignes.push({
          type_vetement_id: h.type_vetement_id, type_libelle: tv?.nom ?? 'Habit', modele_id: h.modele_id || null, modele_libelle: mo?.nom ?? null,
          photo_habit_path: photoHabit, photo_modele_path: photoModele, mesures,
          ...(h.circuit_id && !h.personnalise ? { circuit_modele_id: h.circuit_id } : { etapes: h.etapes.map((e) => ({ nom: e.nom.trim(), mode: e.mode, role_id: e.role_id || null, user_id: e.user_id || null })) }),
        });
      }
      const { data: id, error } = await supabase.rpc('creer_commande', {
        p_client: client.id, p_date_rdv: rdv.date, p_total: montantTotal, p_avance: montantAvance, p_note: note || null, p_habits: lignes, p_proposition: rdv.prop ?? null,
      });
      if (error) throw error;
      if (majProfil && peut(ctx, 'mesures.modifier')) { // enregistre les mesures dans le profil du client
        const m = new Map<string, any>();
        for (const h of habits) for (const c of (champs.data ?? []).filter((x: any) => x.categorie === h.categorie)) {
          const v = (h.mesures[c.id] ?? '').replace(',', '.').trim(); if (v !== '' && isFinite(Number(v))) m.set(c.id, { client_id: client.id, champ_id: c.id, atelier_id: atelierId, valeur: Number(v) });
        }
        if (m.size) await supabase.from('client_mesures').upsert([...m.values()], { onConflict: 'client_id,champ_id' });
      }
      nav(`/app/commandes/${id}`, { replace: true });
    }, 'Commande créée avec succès.', (e) => ((e as any)?.message?.startsWith('Mesure invalide') ? (e as any).message : msgErreur(e)));
  }

  if (types.isLoading || circuits.isLoading || champs.isLoading) return <Chargement />;

  return (
    <>
      <EnTete titre="Nouvelle commande" retour="/app/commandes" />
      {erreur && <Alerte ton="err">{erreur}</Alerte>}

      <section className="carte"><h2 style={{ marginBottom: '.7rem' }}>1. Client</h2>
        {client ? (
          <div className="ligne"><div><b>{client.prenom} {client.nom}</b><div className="muted petit">{client.telephone_e164 ?? client.whatsapp_e164 ?? '—'}</div></div><span className="espace" />
            <Btn variante="sec" petit onClick={() => { setClient(null); setTerme(''); }}>Changer</Btn></div>
        ) : (
          <>
            <input className="input" placeholder="Rechercher un client (nom, prénom, téléphone)" value={terme} onChange={(e) => setTerme(e.target.value)} />
            <div className="pile" style={{ gap: '.4rem', marginTop: '.6rem' }}>
              {recherche.data?.map((c) => <button key={c.id} type="button" className="carte cliquable" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setClient(c)}><b>{c.prenom} {c.nom}</b> <span className="muted petit">{c.telephone_e164 ?? ''}</span></button>)}
              {recherche.data && !recherche.data.length && <p className="muted petit">Aucun client trouvé.</p>}
            </div>
            <div className="ligne" style={{ marginTop: '.6rem', flexWrap: 'wrap' }}>
              <Btn variante="sec" petit onClick={() => setClientsOuverte(true)}>Voir les clients</Btn>
              {peut(ctx, 'clients.creer') && <Btn variante="sec" petit onClick={() => setNouveauClient(true)}>+ Nouveau client</Btn>}
            </div>
          </>
        )}
      </section>

      {habits.map((h, i) => {
        const champsCat = (champs.data ?? []).filter((c: any) => c.categorie === h.categorie);
        const modelesType = (modeles.data ?? []).filter((m: any) => !h.type_vetement_id || !m.type_vetement_id || m.type_vetement_id === h.type_vetement_id);
        return (
          <section key={h.cle} className="carte point" style={{ marginTop: '1rem' }}>
            <div className="ligne"><h2>Habit {i + 1}</h2><span className="espace" />
              {habits.length > 1 && <Btn variante="danger sec" petit onClick={() => setHabits(habits.filter((x) => x.cle !== h.cle))}><Trash2 size={14} /> Retirer</Btn>}</div>
            <div className="grille2" style={{ marginTop: '.7rem' }}>
              <Champ label="Type de vêtement"><select className="input" value={h.type_vetement_id} onChange={(e) => maj(h.cle, { type_vetement_id: e.target.value })}><option value="">Choisir…</option>{typesActifs.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></Champ>
              <Champ label="Modèle (facultatif)"><select className="input" value={h.modele_id} onChange={(e) => maj(h.cle, { modele_id: e.target.value })}><option value="">Aucun / autre</option>{modelesType.map((m: any) => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></Champ>
              <Champ label="Photo du vêtement"><input className="input" type="file" accept="image/*" capture="environment" onChange={(e) => choisirPhoto(h.cle, 'photo_habit', e.target.files?.[0])} />{h.photo_habit && <img className="vignette" src={h.photo_habit.apercu} alt="Aperçu" />}</Champ>
              <Champ label="Photo du modèle" aide="Sinon, la photo du modèle choisi est utilisée."><input className="input" type="file" accept="image/*" onChange={(e) => choisirPhoto(h.cle, 'photo_modele', e.target.files?.[0])} />{h.photo_modele && <img className="vignette" src={h.photo_modele.apercu} alt="Aperçu" />}</Champ>
            </div>

            <h3 style={{ margin: '.6rem 0' }}>Mesures</h3>
            <div className="onglets">{Object.entries(CATEGORIES).map(([k, l]) => <button key={k} type="button" className={h.categorie === k ? 'on' : ''} onClick={() => setHabits((hs) => hs.map((x) => (x.cle === h.cle ? preremplir({ ...x, categorie: k }) : x)))}>{l}</button>)}</div>
            <div className="grille2">{champsCat.map((c: any) => <div className="champ" key={c.id}><label>{c.libelle} ({c.unite})</label><input className="input" inputMode="decimal" value={h.mesures[c.id] ?? ''} onChange={(e) => maj(h.cle, { mesures: { ...h.mesures, [c.id]: e.target.value } })} /></div>)}</div>
            {client && peut(ctx, 'mesures.voir') && <Btn variante="sec" petit onClick={() => setHabits((hs) => hs.map((x) => (x.cle === h.cle ? preremplir(x, true) : x)))}>Recharger depuis le profil du client</Btn>}

            <h3 style={{ margin: '1rem 0 .6rem' }}>Circuit de fabrication</h3>
            <Champ label="Modèle de circuit"><select className="input" value={h.personnalise ? '' : h.circuit_id} onChange={(e) => choisirCircuit(h, e.target.value)}><option value="">Personnalisé</option>{circuits.data?.filter((c) => c.actif).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></Champ>
            {h.circuit_id && !h.personnalise ? (
              <div><p className="petit muted">Étapes copiées du modèle : {h.etapes.map((e) => e.nom).join(' → ')}.</p><Btn variante="sec" petit onClick={() => maj(h.cle, { personnalise: true })}>Adapter pour cet habit</Btn></div>
            ) : <EditeurCircuit etapes={h.etapes} onChange={(e) => maj(h.cle, { etapes: e, personnalise: true })} roles={roles.data ?? []} membres={membres.data ?? []} />}
          </section>
        );
      })}
      <Btn variante="sec" onClick={() => setHabits([...habits, nouvelHabit()])} style={{ marginTop: '1rem' }}><Plus size={16} /> Ajouter un habit à cette commande</Btn>

      <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Rendez-vous</h2>
        {rdv.date ? (
          <div className="ligne"><b>{dateFr(rdv.date)}</b>{rdv.prop && <span className="muted petit">({rdv.prop.statut === 'acceptee' ? 'proposition acceptée' : rdv.prop.statut === 'modifiee' ? 'proposition modifiée' : 'choix manuel après refus'})</span>}<span className="espace" /><Btn variante="sec" petit onClick={() => { setRdv({ date: '' }); setPropose(null); }}>Changer</Btn></div>
        ) : propose ? (
          <>
            <Alerte ton="info">Date proposée selon la capacité de l'atelier : <b>{dateFr(propose)}</b></Alerte>
            <div className="ligne">
              <Btn onClick={() => { setRdv({ date: propose, prop: { date_proposee: propose, statut: 'acceptee' } }); }}>Accepter</Btn>
              <input className="input" type="date" style={{ maxWidth: 170 }} onChange={(e) => e.target.value && setRdv({ date: e.target.value, prop: { date_proposee: propose, statut: 'modifiee' } })} aria-label="Modifier la date" />
              <Btn variante="danger sec" onClick={() => setRejet('')}>Rejeter</Btn>
            </div>
          </>
        ) : (
          <div className="ligne"><Btn variante="sec" chargement={enCours} onClick={proposer}>Proposer une date automatiquement</Btn><span className="muted petit">ou</span>
            <input className="input" type="date" style={{ maxWidth: 170 }} onChange={(e) => e.target.value && setRdv({ date: e.target.value })} aria-label="Date manuelle" /></div>
        )}
      </section>

      <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Prix et avance</h2>
        <div className="grille2">
          <Champ label="Prix total (FCFA)"><input className="input" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d\s]/g, ''))} /></Champ>
          <Champ label="Avance versée (FCFA)"><input className="input" inputMode="numeric" value={avance} onChange={(e) => setAvance(e.target.value.replace(/[^\d\s]/g, ''))} /></Champ>
        </div>
        <p className="gras">Reste à payer : {fcfa(Math.max(0, montantTotal - montantAvance))}</p>
        <Champ label="Note (facultatif)"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Champ>
        {peut(ctx, 'mesures.modifier') && <label className="case" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={majProfil} onChange={(e) => setMajProfil(e.target.checked)} />Enregistrer ces mesures dans le profil du client</label>}
        <Btn bloc chargement={enCours} onClick={enregistrer}>Créer la commande</Btn>
      </section>

      <Modale ouverte={nouveauClient} titre="Nouveau client" onFermer={() => setNouveauClient(false)}><ClientForm onFait={(c) => { setClient(c); setNouveauClient(false); }} /></Modale>
      <Modale ouverte={clientsOuverte} titre="Sélectionner un client" onFermer={() => setClientsOuverte(false)} large>
        {clients.isLoading && <Chargement />}
        {clients.error && <Alerte ton="err">{msgErreur(clients.error)}</Alerte>}
        {clients.data && !clients.data.length && <p className="muted">Aucun client actif pour le moment.</p>}
        <div className="pile" style={{ gap: '.4rem' }}>
          {clients.data?.map((c) => (
            <button key={c.id} type="button" className="carte cliquable" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => { setClient(c); setClientsOuverte(false); setTerme(''); }}>
              <b>{c.prenom} {c.nom}</b>
              <div className="muted petit">{c.telephone_e164 ?? c.whatsapp_e164 ?? 'Aucun numéro enregistré'}</div>
            </button>
          ))}
        </div>
      </Modale>
      <Modale ouverte={rejet !== null} titre="Rejeter la proposition" onFermer={() => setRejet(null)}>
        <Champ label="Motif du refus" aide="Conservé dans l'historique de la commande."><input className="input" value={rejet ?? ''} onChange={(e) => setRejet(e.target.value)} /></Champ>
        <Champ label="Date choisie manuellement"><input className="input" type="date" id="date-manuelle" /></Champ>
        <Btn bloc onClick={() => { const d = (document.getElementById('date-manuelle') as HTMLInputElement).value; if (!rejet || rejet.trim().length < 3 || !d) return setErreur('Indiquez un motif et une date.'); setRdv({ date: d, prop: { date_proposee: propose!, statut: 'refusee', motif: rejet.trim() } }); setRejet(null); setErreur(null); }}>Valider</Btn>
      </Modale>
    </>
  );
}
