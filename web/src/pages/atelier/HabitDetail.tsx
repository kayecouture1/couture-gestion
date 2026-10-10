import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateHeure, duree, fcfa, lienWhatsApp, LIBELLES_STATUT } from '../../lib/format';
import { useEmplacements, useMembres, useRoles } from '../../lib/hooks';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, useAction } from '../../components/ui';
import { Fil, progression } from '../../components/Fil';
import { Photo } from '../../components/Photo';
import { EssayageModale, RetoucheModale } from '../../components/EssayagesRetouches';

export default function HabitDetail() {
  const { id } = useParams(); const { ctx } = useAuth(); const qc = useQueryClient();
  const { enCours, lancer } = useAction();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [ess, setEss] = useState(false); const [ret, setRet] = useState(false);
  const essayages = useQuery({ queryKey: ['essayages-habit', id], enabled: peut(ctx, 'essayages.voir'), queryFn: async () => { const { data } = await supabase.from('essayages').select('*').eq('habit_id', id!).order('date_essayage'); return (data ?? []) as any[]; } });
  const retouches = useQuery({ queryKey: ['retouches-habit', id], enabled: peut(ctx, 'retouches.voir'), queryFn: async () => { const { data } = await supabase.from('retouches').select('*').eq('habit_id', id!).order('created_at', { ascending: false }); return (data ?? []) as any[]; } });
  const membres = useMembres(); const roles = useRoles(); const emplacements = useEmplacements();
  const nom = (uid?: string | null) => { const m = membres.data?.find((x) => x.user_id === uid); return m ? `${m.prenom} ${m.nom}` : '—'; };

  const q = useQuery({ queryKey: ['habit', id], queryFn: async () => {
    const { data, error } = await supabase.from('habits').select('*, habit_etapes(*), commandes(id, code, total_fcfa, client_id, date_rdv)').eq('id', id!).single();
    if (error) throw error; return data as any; } });
  const commande = q.data?.commandes;
  const client = useQuery({ queryKey: ['client-habit', commande?.client_id], enabled: !!commande?.client_id, queryFn: async () => {
    const { data } = await supabase.from('clients').select('id, nom, prenom, telephone_e164, whatsapp_e164').eq('id', commande.client_id).maybeSingle(); return data as any; } });
  const paiements = useQuery({ queryKey: ['paiements', commande?.id], enabled: !!commande?.id && peut(ctx, 'paiements.voir'), queryFn: async () => {
    const { data } = await supabase.from('paiements').select('montant_fcfa, annule_at').eq('commande_id', commande.id); return data as any[]; } });

  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const h = q.data;
  const etapes = [...(h.habit_etapes ?? [])].sort((a: any, b: any) => a.ordre - b.ordre);
  const emp = emplacements.data?.find((e) => e.id === h.emplacement_id);

  const paye = (paiements.data ?? []).filter((p: any) => !p.annule_at).reduce((s: number, p: any) => s + Number(p.montant_fcfa), 0);
  const message = client.data ? `Bonjour ${client.data.prenom}, votre habit ${h.code} (${h.type_libelle}) est terminé. Vous pouvez venir le récupérer à l'atelier${emp ? ` (emplacement : ${emp.nom})` : ''}.`
    + (commande && paiements.data ? ` Montant déjà payé : ${fcfa(paye)}. Reste à payer : ${fcfa(commande.total_fcfa - paye)}.` : '') + ' Merci de votre confiance.' : '';
  const numero = client.data?.whatsapp_e164 ?? client.data?.telephone_e164;
  const notifier = (canal: 'appel' | 'whatsapp') => { supabase.from('notifications').insert({ habit_id: h.id, atelier_id: h.atelier_id, canal, message: canal === 'whatsapp' ? message : null }).then(() => {}); };

  const confirmer = () => lancer(async () => {
    if (!confirmation) throw new Error('Choisissez un emplacement.');
    const { error } = await supabase.rpc('confirmer_habit_termine', { p_habit: id, p_emplacement: confirmation }); if (error) throw error;
    setConfirmation(null); qc.invalidateQueries({ queryKey: ['habit', id] });
  }, "Habit confirmé comme terminé. Emplacement enregistré.", (e) => ((e as any)?.message === 'Choisissez un emplacement.' ? 'Choisissez un emplacement.' : msgErreur(e)));

  return (
    <>
      <EnTete titre={h.code} retour={commande && peut(ctx, 'commandes.voir') ? `/app/commandes/${commande.id}` : '/app/production'}>
        <Badge ton={h.statut === 'termine' ? 'ok' : h.statut === 'annule' ? 'gris' : 'ocre'}>{LIBELLES_STATUT[h.statut]}</Badge>
      </EnTete>
      <div className="carte">
        <p style={{ margin: 0 }}><b>{h.type_libelle}</b>{h.modele_libelle && <> · modèle {h.modele_libelle}</>}{commande && peut(ctx, 'commandes.voir') && <> · commande <Link to={`/app/commandes/${commande.id}`}>{commande.code}</Link></>}</p>
        <div className="grille2" style={{ marginTop: '.8rem', gap: '.6rem' }}><div><p className="muted petit">Photo de l'habit</p><Photo chemin={h.photo_habit_path} alt="Photo de l'habit" /></div><div><p className="muted petit">Photo du modèle</p><Photo chemin={h.photo_modele_path} alt="Photo du modèle" /></div></div>
      </div>

      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Progression</h2>
      <div className="carte point"><div className="barre"><span style={{ width: `${progression(etapes)}%` }} /></div><Fil etapes={etapes} /></div>

      {h.statut === 'a_valider' && peut(ctx, 'habits.confirmer_termine') && (
        <Alerte ton="info"><div className="ligne"><span>Toutes les étapes sont terminées. Confirmez que l'habit est terminé pour l'enregistrer et indiquer où il est rangé.</span><span className="espace" /><Btn onClick={() => setConfirmation('')}>Confirmer que l'habit est terminé</Btn></div></Alerte>)}
      {h.statut === 'a_valider' && !peut(ctx, 'habits.confirmer_termine') && <Alerte ton="info">En attente de la confirmation finale par le propriétaire.</Alerte>}

      {h.statut === 'termine' && (
        <div className="carte" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0 }}>Emplacement : <b>{emp?.nom ?? '—'}</b></p>
          <p className="muted petit">Confirmé par {nom(h.valide_par)} le {dateHeure(h.valide_at)}</p>
          {numero && peut(ctx, 'habits.confirmer_termine', 'commandes.voir') && (
            <div className="ligne"><a className="btn sec" href={`tel:${client.data?.telephone_e164 ?? numero}`} onClick={() => notifier('appel')}><Phone size={16} /> Appeler le client</a>
              <a className="btn" target="_blank" rel="noreferrer" href={lienWhatsApp(numero, message)} onClick={() => notifier('whatsapp')}><MessageCircle size={16} /> Envoyer un message WhatsApp</a></div>)}
          {message && <p className="muted petit" style={{ marginTop: '.6rem' }}>Message préparé : « {message} »</p>}
        </div>)}

      {peut(ctx, 'mesures.voir', 'habits.voir') && Array.isArray(h.mesures_utilisees) && h.mesures_utilisees.length > 0 && (<>
        <h2 style={{ margin: '1.4rem 0 .7rem' }}>Mesures utilisées</h2>
        <div className="carte"><div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '.5rem' }}>{h.mesures_utilisees.map((m: any, i: number) => <div key={i}><div className="muted petit">{m.libelle}</div><b>{m.valeur} {m.unite}</b></div>)}</div></div></>)}

      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Historique</h2>
      <div className="carte"><table className="tableau"><thead><tr><th>Étape</th><th>Qui</th><th>Pris</th><th>Terminé</th><th>Durée</th></tr></thead><tbody>
        <tr><td>Habit créé</td><td /><td>{dateHeure(h.created_at)}</td><td /><td /></tr>
        {etapes.map((e: any) => <tr key={e.id}><td><b>{e.nom}</b></td><td>{e.pris_par ? <>{nom(e.pris_par)}{e.role_utilise_id && <span className="muted petit"> ({roles.data?.find((r) => r.id === e.role_utilise_id)?.nom})</span>}</> : <span className="muted petit">{e.mode === 'personne' ? `Pour ${nom(e.user_id)}` : `Rôle ${roles.data?.find((r) => r.id === e.role_id)?.nom ?? ''}`}</span>}</td><td>{dateHeure(e.pris_a)}</td><td>{dateHeure(e.termine_a)}</td><td>{duree(e.duree_secondes)}</td></tr>)}
        {h.valide_at && <tr><td>Confirmation finale</td><td>{nom(h.valide_par)}</td><td /><td>{dateHeure(h.valide_at)}</td><td /></tr>}</tbody></table></div>

      {peut(ctx, 'essayages.voir') && (<>
        <div className="entete" style={{ marginTop: '1.4rem' }}><h2>Essayages</h2><span className="espace" />{peut(ctx, 'essayages.gerer') && <Btn variante="sec" petit onClick={() => setEss(true)}>Planifier</Btn>}</div>
        {essayages.data && !essayages.data.length && <p className="muted petit">Aucun essayage.</p>}
        <div className="pile" style={{ gap: '.4rem' }}>{essayages.data?.map((e) => <div key={e.id} className="carte ligne"><b>{e.date_essayage}{e.heure ? ` à ${e.heure}` : ''}</b><span className="espace" /><Badge ton={e.statut === 'effectue' ? 'ok' : e.statut === 'annule' ? 'gris' : 'ocre'}>{e.statut === 'planifie' ? 'Planifié' : e.statut === 'effectue' ? 'Effectué' : 'Annulé'}</Badge></div>)}</div></>)}
      {peut(ctx, 'retouches.voir') && (<>
        <div className="entete" style={{ marginTop: '1.4rem' }}><h2>Retouches</h2><span className="espace" />{peut(ctx, 'retouches.gerer') && <Btn variante="sec" petit onClick={() => setRet(true)}>Demander une retouche</Btn>}</div>
        {retouches.data && !retouches.data.length && <p className="muted petit">Aucune retouche.</p>}
        <div className="pile" style={{ gap: '.4rem' }}>{retouches.data?.map((r) => <div key={r.id} className="carte ligne"><span>{r.description}</span><span className="espace" /><Badge ton={r.statut === 'terminee' ? 'ok' : r.statut === 'annulee' ? 'gris' : 'ocre'}>{r.statut === 'demandee' ? 'Demandée' : r.statut === 'en_cours' ? 'En cours' : r.statut === 'terminee' ? 'Terminée' : 'Annulée'}</Badge></div>)}</div></>)}
      <EssayageModale ouverte={ess} habitId={id} onFermer={() => setEss(false)} onFait={() => qc.invalidateQueries({ queryKey: ['essayages-habit', id] })} />
      <RetoucheModale ouverte={ret} habitId={id} onFermer={() => setRet(false)} onFait={() => qc.invalidateQueries({ queryKey: ['retouches-habit', id] })} />

      <Modale ouverte={confirmation !== null} titre="Où l'habit est-il rangé ?" onFermer={() => setConfirmation(null)}>
        <Champ label="Emplacement"><select className="input" value={confirmation ?? ''} onChange={(e) => setConfirmation(e.target.value)}><option value="">Choisir…</option>{emplacements.data?.filter((e) => e.actif).map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}</select></Champ>
        {emplacements.data && !emplacements.data.some((e) => e.actif) && <Alerte ton="avert">Aucun emplacement : ajoutez-en dans les Paramètres.</Alerte>}
        <Btn bloc chargement={enCours} onClick={confirmer}>Confirmer et enregistrer l'emplacement</Btn>
      </Modale>
    </>
  );
}
