import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateFr, dateHeure, fcfa, lienWhatsApp, LIBELLES_STATUT } from '../../lib/format';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, Vide, useAction } from '../../components/ui';
import { Fil, progression } from '../../components/Fil';
import { Photo } from '../../components/Photo';

const MODES: Record<string, string> = { especes: 'Espèces', mobile_money: 'Mobile money', virement: 'Virement', autre: 'Autre' };

export default function CommandeDetail() {
  const { id } = useParams(); const { ctx } = useAuth(); const qc = useQueryClient();
  const { enCours, lancer } = useAction();
  const [paiement, setPaiement] = useState<{ montant: string; mode: string; note: string } | null>(null);
  const [annulPaie, setAnnulPaie] = useState<{ id: string; motif: string } | null>(null);
  const [annulCmd, setAnnulCmd] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ date: string; total: string; note: string } | null>(null);
  const recharger = () => { qc.invalidateQueries({ queryKey: ['commande', id] }); qc.invalidateQueries({ queryKey: ['paiements', id] }); qc.invalidateQueries({ queryKey: ['factures', id] }); };

  const cmd = useQuery({ queryKey: ['commande', id], queryFn: async () => {
    const { data, error } = await supabase.from('commandes')
      .select('*, clients(id, nom, prenom, telephone_e164, whatsapp_e164), habits(id, code, type_libelle, modele_libelle, statut, photo_habit_path, emplacement_id, habit_etapes(nom, ordre, statut))')
      .eq('id', id!).single(); if (error) throw error; return data as any; } });
  const paiements = useQuery({ queryKey: ['paiements', id], enabled: peut(ctx, 'paiements.voir'), queryFn: async () => {
    const { data, error } = await supabase.from('paiements').select('*').eq('commande_id', id!).order('paye_le'); if (error) throw error; return data as any[]; } });
  const factures = useQuery({ queryKey: ['factures', id], enabled: peut(ctx, 'factures.voir'), queryFn: async () => {
    const { data, error } = await supabase.from('factures').select('*').eq('commande_id', id!).order('created_at', { ascending: false }); if (error) throw error; return data as any[]; } });
  const props = useQuery({ queryKey: ['props', id], enabled: peut(ctx, 'rendez_vous.voir'), queryFn: async () => {
    const { data, error } = await supabase.from('propositions_rdv').select('*').eq('commande_id', id!).order('created_at'); if (error) throw error; return data as any[]; } });

  if (cmd.isLoading) return <Chargement />;
  if (cmd.error) return <Alerte ton="err">{msgErreur(cmd.error)}</Alerte>;
  const c = cmd.data;
  const paye = (paiements.data ?? []).filter((p) => !p.annule_at).reduce((s, p) => s + Number(p.montant_fcfa), 0);
  const reste = c.total_fcfa - paye;
  const ouverte = c.statut === 'en_cours';

  const generer = () => lancer(async () => {
    const r = await api<any>('/api/factures', { body: { commande_id: id } });
    recharger(); if (r.url) window.open(r.url, '_blank', 'noopener');
  }, 'Facture générée.', msgErreur);
  const ouvrirFacture = async (f: any) => { const { data, error } = await supabase.storage.from('documents').createSignedUrl(f.pdf_path, 600, { download: `${f.numero}.pdf` }); if (error || !data) return window.alert('Le PDF est introuvable.'); window.open(data.signedUrl, '_blank', 'noopener'); };
  const partager = async (f: any) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(f.pdf_path, 7 * 86400);
    const num = c.clients?.whatsapp_e164 ?? c.clients?.telephone_e164; if (!num || !data) return window.alert('Aucun numéro WhatsApp enregistré pour ce client.');
    const message = `Bonjour ${c.clients.prenom}, voici votre facture ${f.numero}. Net à payer : ${fcfa(f.reste_fcfa)}.`;
    try {
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('Téléchargement du PDF impossible.');
      const fichier = new File([await response.blob()], `${f.numero}.pdf`, { type: 'application/pdf' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [fichier] }))) {
        await navigator.share({ files: [fichier], text: message, title: `Facture ${f.numero}` });
        return;
      }
      const url = URL.createObjectURL(fichier);
      const lien = document.createElement('a');
      lien.href = url; lien.download = fichier.name; lien.click();
      URL.revokeObjectURL(url);
      window.open(lienWhatsApp(num, message), '_blank', 'noopener');
      window.alert('Le PDF a été téléchargé. Joignez ce fichier dans la conversation WhatsApp ouverte.');
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      window.alert('Impossible de préparer le PDF pour WhatsApp. Téléchargez-le puis joignez-le manuellement.');
    }
  };

  return (
    <>
      <EnTete titre={c.code} retour="/app/commandes">
        <Badge ton={c.statut === 'terminee' ? 'ok' : c.statut === 'annulee' ? 'gris' : 'ocre'}>{LIBELLES_STATUT[c.statut]}</Badge>
        {ouverte && peut(ctx, 'commandes.modifier', 'rendez_vous.gerer') && <Btn variante="sec" petit onClick={() => setEdition({ date: c.date_rdv ?? '', total: String(c.total_fcfa), note: c.note ?? '' })}>Modifier</Btn>}
        {ouverte && peut(ctx, 'commandes.annuler') && <Btn variante="danger sec" petit onClick={() => setAnnulCmd('')}>Annuler la commande</Btn>}
      </EnTete>
      <div className="carte">
        <div className="grille2" style={{ gap: '.4rem 1rem' }}>
          <p style={{ margin: 0 }}>Client : {c.clients ? <Link to={`/app/clients/${c.clients.id}`}><b>{c.clients.prenom} {c.clients.nom}</b></Link> : '—'}</p>
          <p style={{ margin: 0 }}>Rendez-vous : <b>{dateFr(c.date_rdv)}</b></p>
          <p style={{ margin: 0 }}>Créée le : {dateHeure(c.created_at)}</p>
          <p style={{ margin: 0 }}>Montant total : <b>{fcfa(c.total_fcfa)}</b></p>
        </div>
        {c.note && <p className="muted" style={{ margin: '.5rem 0 0' }}>{c.note}</p>}
        {c.statut === 'annulee' && <Alerte ton="avert">Commande annulée. Motif : {c.motif_annulation}</Alerte>}
      </div>

      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Habits ({c.habits.length})</h2>
      <div className="pile">
        {c.habits.map((h: any) => { const et = [...(h.habit_etapes ?? [])].sort((a: any, b: any) => a.ordre - b.ordre); return (
          <Link key={h.id} to={`/app/habits/${h.id}`} className="carte cliquable">
            <div className="ligne" style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 64 }}><Photo chemin={h.photo_habit_path} alt={h.code} classe="vignette" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ligne"><b>{h.code}</b><span>{h.type_libelle}</span><span className="espace" /><Badge ton={h.statut === 'termine' ? 'ok' : h.statut === 'annule' ? 'gris' : h.statut === 'a_valider' ? 'ocre' : undefined}>{LIBELLES_STATUT[h.statut]}</Badge></div>
                <div className="barre" style={{ margin: '.4rem 0' }}><span style={{ width: `${progression(et)}%` }} /></div>
                <Fil etapes={et} />
              </div>
            </div>
          </Link>); })}
      </div>

      {peut(ctx, 'paiements.voir') && (<>
        <div className="entete" style={{ marginTop: '1.4rem' }}><h2>Paiements</h2><span className="espace" />
          {c.statut !== 'annulee' && reste > 0 && peut(ctx, 'paiements.enregistrer') && <Btn onClick={() => setPaiement({ montant: String(reste), mode: 'especes', note: '' })}>Enregistrer un paiement</Btn>}</div>
        <div className="carte">
          <div className="grille2" style={{ gap: '.3rem 1rem' }}><p style={{ margin: 0 }}>Déjà payé : <b>{fcfa(paye)}</b></p><p style={{ margin: 0 }}>Reste à payer : <b style={{ color: reste > 0 ? 'var(--alerte)' : 'var(--ok)' }}>{fcfa(reste)}</b></p></div>
          {paiements.data && paiements.data.length > 0 && <table className="tableau" style={{ marginTop: '.7rem' }}><thead><tr><th>Date</th><th>Mode</th><th>Montant</th><th /></tr></thead><tbody>
            {paiements.data.map((p) => <tr key={p.id} style={p.annule_at ? { opacity: .5, textDecoration: 'line-through' } : undefined}><td>{dateHeure(p.paye_le)}</td><td>{MODES[p.mode]}{p.note ? ` · ${p.note}` : ''}</td><td>{fcfa(p.montant_fcfa)}</td>
              <td>{!p.annule_at && peut(ctx, 'paiements.modifier') && <Btn variante="danger sec" petit onClick={() => setAnnulPaie({ id: p.id, motif: '' })}>Annuler</Btn>}</td></tr>)}</tbody></table>}
        </div></>)}

      {peut(ctx, 'factures.voir', 'factures.generer') && (<>
        <div className="entete" style={{ marginTop: '1.4rem' }}><h2>Factures</h2><span className="espace" />
          {c.statut !== 'annulee' && peut(ctx, 'factures.generer') && <Btn variante="ocre" chargement={enCours} onClick={generer}><FileText size={16} /> Générer une facture PDF</Btn>}</div>
        {factures.data && !factures.data.length && <Vide titre="Aucune facture" texte="Chaque génération crée un nouveau justificatif avec les montants du moment." />}
        <div className="pile">{factures.data?.map((f) => (
          <div key={f.id} className="carte ligne"><div><b>{f.numero}</b><div className="muted petit">{dateHeure(f.created_at)} · total {fcfa(f.total_fcfa)} · payé {fcfa(f.avance_fcfa)} · reste {fcfa(f.reste_fcfa)}</div></div><span className="espace" />
            {f.pdf_path && <Btn variante="sec" petit onClick={() => ouvrirFacture(f)}>Télécharger</Btn>}
            {f.pdf_path && peut(ctx, 'factures.partager') && <Btn variante="sec" petit onClick={() => partager(f)}><MessageCircle size={14} /> WhatsApp</Btn>}</div>))}</div></>)}

      {props.data && props.data.length > 0 && (<><h2 style={{ margin: '1.4rem 0 .7rem' }}>Rendez-vous : propositions</h2>
        <div className="carte"><table className="tableau"><tbody>{props.data.map((p) => <tr key={p.id}><td>{dateHeure(p.created_at)}</td><td>Proposé : {dateFr(p.date_proposee)}</td>
          <td>{p.statut === 'acceptee' ? 'Accepté' : p.statut === 'modifiee' ? 'Modifié' : p.statut === 'refusee' ? `Refusé — ${p.motif}` : 'Proposé'}</td></tr>)}</tbody></table></div></>)}

      <Modale ouverte={!!paiement} titre="Enregistrer un paiement" onFermer={() => setPaiement(null)}>
        <Champ label="Montant (FCFA)" aide={`Reste à payer : ${fcfa(reste)}`}><input className="input" inputMode="numeric" value={paiement?.montant ?? ''} onChange={(e) => setPaiement({ ...paiement!, montant: e.target.value.replace(/\D/g, '') })} /></Champ>
        <Champ label="Mode"><select className="input" value={paiement?.mode} onChange={(e) => setPaiement({ ...paiement!, mode: e.target.value })}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Champ>
        <Champ label="Note (facultatif)"><input className="input" value={paiement?.note ?? ''} onChange={(e) => setPaiement({ ...paiement!, note: e.target.value })} /></Champ>
        <Btn bloc chargement={enCours} onClick={() => lancer(async () => {
          const m = Number(paiement!.montant); if (!m || m <= 0) throw new Error('Indiquez un montant.'); if (m > reste) throw new Error('Le montant dépasse le reste à payer.');
          const { error } = await supabase.rpc('enregistrer_paiement', { p_commande: id, p_montant: m, p_mode: paiement!.mode, p_note: paiement!.note || null }); if (error) throw error;
          setPaiement(null); recharger();
        }, 'Paiement enregistré. Vous pouvez générer un nouveau justificatif.', (e) => (e as any)?.message?.startsWith('Indiquez') || (e as any)?.message?.startsWith('Le montant') ? (e as any).message : msgErreur(e))}>Enregistrer</Btn>
      </Modale>

      <Modale ouverte={!!annulPaie} titre="Annuler ce paiement" onFermer={() => setAnnulPaie(null)}>
        <Champ label="Motif"><input className="input" value={annulPaie?.motif ?? ''} onChange={(e) => setAnnulPaie({ ...annulPaie!, motif: e.target.value })} /></Champ>
        <Btn bloc variante="danger" chargement={enCours} onClick={() => lancer(async () => { const { error } = await supabase.rpc('annuler_paiement', { p_paiement: annulPaie!.id, p_motif: annulPaie!.motif }); if (error) throw error; setAnnulPaie(null); recharger(); }, 'Paiement annulé.', msgErreur)}>Annuler le paiement</Btn>
      </Modale>

      <Modale ouverte={annulCmd !== null} titre="Annuler la commande" onFermer={() => setAnnulCmd(null)}>
        <Alerte ton="avert">Tous les habits non terminés seront annulés. Cette action est tracée dans l'historique.</Alerte>
        <Champ label="Motif"><input className="input" value={annulCmd ?? ''} onChange={(e) => setAnnulCmd(e.target.value)} /></Champ>
        <Btn bloc variante="danger" chargement={enCours} onClick={() => lancer(async () => { const { error } = await supabase.rpc('annuler_commande', { p_commande: id, p_motif: annulCmd }); if (error) throw error; setAnnulCmd(null); recharger(); }, 'Commande annulée.', msgErreur)}>Annuler la commande</Btn>
      </Modale>

      <Modale ouverte={!!edition} titre="Modifier la commande" onFermer={() => setEdition(null)}>
        <Champ label="Date de rendez-vous"><input className="input" type="date" value={edition?.date ?? ''} onChange={(e) => setEdition({ ...edition!, date: e.target.value })} /></Champ>
        {peut(ctx, 'commandes.modifier') && <>
          <Champ label="Prix total (FCFA)" aide={`Ne peut pas être inférieur aux paiements reçus (${fcfa(paye)}).`}><input className="input" inputMode="numeric" value={edition?.total ?? ''} onChange={(e) => setEdition({ ...edition!, total: e.target.value.replace(/\D/g, '') })} /></Champ>
          <Champ label="Note"><textarea className="input" value={edition?.note ?? ''} onChange={(e) => setEdition({ ...edition!, note: e.target.value })} /></Champ></>}
        <Btn bloc chargement={enCours} onClick={() => lancer(async () => {
          const maj: any = { date_rdv: edition!.date || null };
          if (peut(ctx, 'commandes.modifier')) { maj.total_fcfa = Number(edition!.total); maj.note = edition!.note || null; }
          const { error } = await supabase.from('commandes').update(maj).eq('id', id!); if (error) throw error; setEdition(null); recharger();
        }, 'Commande modifiée.', msgErreur)}>Enregistrer</Btn>
      </Modale>
    </>
  );
}
