import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { dateFr, dateHeure } from '../../lib/format';
import { useEffect } from 'react';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, useAction, useRetours } from '../../components/ui';

const ETATS: Record<string, [string, 'ok' | 'alerte' | 'ocre' | 'gris']> = {
  actif: ['Actif', 'ok'], a_venir: ['À venir', 'ocre'], expire: ['Expiré', 'alerte'], desactive: ['Désactivé', 'gris'], en_attente: ['Code non activé', 'ocre'],
};
const ACTIONS: Record<string, string> = {
  abonnement_cree: 'Abonnement créé', code_genere: 'Code généré', code_regenere: 'Code régénéré', code_active: 'Code activé',
  prolonge: 'Abonnement prolongé', desactive: 'Abonnement désactivé', reactive: 'Abonnement réactivé', modifie: 'Abonnement modifié',
  abonnement_supprime: 'Abonnement supprimé', atelier_desactive: 'Atelier désactivé', atelier_reactive: 'Atelier réactivé',
};

export default function AdminAtelier() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { confirmer } = useRetours();
  const { enCours, lancer } = useAction();
  const q = useQuery({ queryKey: ['admin-atelier', id], queryFn: () => api<any>(`/api/admin/ateliers/${id}`) });
  const [nouveau, setNouveau] = useState(false);
  const [form, setForm] = useState({ duree: '30', fenetre: '30', note: '' });
  const [codeAffiche, setCodeAffiche] = useState<{ code: string; valide: string } | null>(null);
  const [prolong, setProlong] = useState<{ id: string; jours: string } | null>(null);
  const [edition, setEdition] = useState<{ id: string; debut: string; fin: string } | null>(null);
  const params = useQuery({ queryKey: ['admin-parametres'], queryFn: () => api<any>('/api/admin/parametres') });
  useEffect(() => { if (params.data) setForm((f) => ({ ...f, duree: String(params.data.duree_abonnement_defaut_jours ?? 30), fenetre: String(params.data.fenetre_activation_defaut_jours ?? 30) })); }, [params.data]);
  const recharger = () => qc.invalidateQueries({ queryKey: ['admin-atelier', id] });

  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const { atelier, proprietaire, abonnements, historique } = q.data;

  const creer = () => lancer(async () => {
    const r = await api<any>('/api/admin/abonnements', { body: { atelier_id: id, duree_jours: Number(form.duree), fenetre_jours: Number(form.fenetre), note: form.note || undefined } });
    setNouveau(false); setCodeAffiche({ code: r.code, valide: r.valide_jusqu_a }); recharger();
  }, undefined, msgErreur);
  const regenerer = async (aid: string) => {
    if (!(await confirmer("Générer un nouveau code ? L'ancien code ne fonctionnera plus."))) return;
    lancer(async () => { const r = await api<any>(`/api/admin/abonnements/${aid}/regenerer-code`, { body: {} }); setCodeAffiche({ code: r.code, valide: r.valide_jusqu_a }); recharger(); }, undefined, msgErreur);
  };
  const post = (aid: string, action: string, msg: string, corps: object = {}) =>
    lancer(async () => { await api(`/api/admin/abonnements/${aid}/${action}`, { body: corps }); recharger(); }, msg, msgErreur);

  return (
    <>
      <EnTete titre={atelier.nom} retour="/admin/ateliers">
        <Btn variante={atelier.statut === 'actif' ? 'danger sec' : undefined} petit onClick={async () => {
          if (!(await confirmer(atelier.statut === 'actif' ? "Désactiver cet atelier ? Tous ses accès seront bloqués." : 'Réactiver cet atelier ?', { danger: atelier.statut === 'actif' }))) return;
          lancer(async () => { await api(`/api/admin/ateliers/${id}/statut`, { method: 'PATCH', body: { actif: atelier.statut !== 'actif' } }); recharger(); }, 'Statut de l’atelier mis à jour.', msgErreur);
        }}>{atelier.statut === 'actif' ? "Désactiver l'atelier" : "Réactiver l'atelier"}</Btn>
      </EnTete>
      <div className="carte">
        <p><b>Code atelier :</b> {atelier.code_atelier} · <b>Créé le</b> {dateFr(atelier.created_at)} · {atelier.statut === 'actif' ? <Badge ton="ok">Actif</Badge> : <Badge ton="gris">Désactivé</Badge>}</p>
        {proprietaire && <p className="muted" style={{ margin: 0 }}>Propriétaire : {proprietaire.prenom} {proprietaire.nom} · {proprietaire.telephone ?? '—'} · {proprietaire.email ?? '—'}</p>}
      </div>

      <div className="entete" style={{ marginTop: '1.4rem' }}><h2>Abonnements</h2><span className="espace" /><Btn onClick={() => setNouveau(true)}>Nouvel abonnement</Btn></div>
      {!abonnements.length && <Alerte ton="info">Aucun abonnement. Créez-en un après réception du paiement : un code de confirmation sera généré pour le propriétaire.</Alerte>}
      <div className="pile">
        {abonnements.map((a: any) => {
          const [libelle, ton] = ETATS[a.etat];
          const codeActuel = a.codes.find((c: any) => c.statut === 'non_utilise');
          return (
            <div key={a.id} className="carte point">
              <div className="ligne"><b>{a.duree_jours} jour(s)</b><Badge ton={ton}>{libelle}</Badge><span className="espace" /><span className="muted petit">créé le {dateFr(a.created_at)}</span></div>
              {a.debut_at ? <p style={{ margin: '.5rem 0' }}>Du <b>{dateFr(a.debut_at)}</b> au <b>{dateFr(new Date(new Date(a.fin_at).getTime() - 1).toISOString())}</b> (fin de journée, heure de Bamako)</p>
                : <p className="muted" style={{ margin: '.5rem 0' }}>Démarre à l'activation du code par le propriétaire.</p>}
              {a.note && <p className="muted petit">Note : {a.note}</p>}
              {codeActuel && <p className="petit">Code en attente d'activation (se termine par <b>{codeActuel.apercu}</b>) — valable jusqu'au {dateFr(codeActuel.valide_jusqu_a)}.</p>}
              <div className="ligne">
                {a.statut === 'en_attente' && <><Btn petit variante="sec" disabled={enCours} onClick={() => regenerer(a.id)}>Régénérer le code</Btn>
                  <Btn petit variante="danger sec" disabled={enCours} onClick={async () => { if (await confirmer('Supprimer cet abonnement non activé ?', { danger: true })) lancer(async () => { await api(`/api/admin/abonnements/${a.id}`, { method: 'DELETE' }); recharger(); }, 'Abonnement supprimé.', msgErreur); }}>Supprimer</Btn></>}
                {a.debut_at && <><Btn petit variante="sec" disabled={enCours} onClick={() => setProlong({ id: a.id, jours: '30' })}>Prolonger</Btn>
                  <Btn petit variante="sec" disabled={enCours} onClick={() => setEdition({ id: a.id, debut: a.debut_at.slice(0, 16), fin: a.fin_at.slice(0, 16) })}>Modifier les dates</Btn></>}
                {a.statut !== 'desactive' && <Btn petit variante="danger sec" disabled={enCours} onClick={async () => { if (await confirmer("Désactiver cet abonnement ? L'accès sera bloqué immédiatement.", { danger: true })) post(a.id, 'desactiver', 'Abonnement désactivé.'); }}>Désactiver</Btn>}
                {a.statut === 'desactive' && <Btn petit variante="sec" disabled={enCours} onClick={() => post(a.id, 'reactiver', 'Abonnement réactivé.')}>Réactiver</Btn>}
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ margin: '1.6rem 0 .7rem' }}>Historique</h2>
      {!historique.length ? <p className="muted">Aucun événement.</p> : (
        <div className="carte"><table className="tableau"><thead><tr><th>Date</th><th>Action</th><th>Détails</th></tr></thead><tbody>
          {historique.map((h: any) => <tr key={h.id}><td>{dateHeure(h.created_at)}</td><td>{ACTIONS[h.action] ?? h.action}</td>
            <td className="muted petit">{h.details?.duree_jours ? `${h.details.duree_jours} j` : ''}{h.details?.jours ? `+${h.details.jours} j` : ''}{h.details?.fin_at ? ` fin ${dateFr(h.details.fin_at)}` : ''}</td></tr>)}
        </tbody></table></div>)}

      <Modale ouverte={nouveau} titre="Nouvel abonnement" onFermer={() => setNouveau(false)}>
        <Alerte ton="info">Le paiement est reçu hors de l'application. Créez l'abonnement, puis transmettez le code au propriétaire.</Alerte>
        <div className="grille2">
          <Champ label="Durée (jours)" aide="Ex. 7, 30, 90, 365"><input className="input" type="number" min={1} max={3660} value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value })} /></Champ>
          <Champ label="Code valable (jours)" aide="Délai pour l'activer"><input className="input" type="number" min={1} max={365} value={form.fenetre} onChange={(e) => setForm({ ...form, fenetre: e.target.value })} /></Champ>
        </div>
        <Champ label="Note (facultatif)"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Champ>
        <p className="muted petit">La durée commence à l'activation du code. Le jour d'activation compte pour le premier jour.</p>
        <Btn bloc chargement={enCours} onClick={creer}>Créer et générer le code</Btn>
      </Modale>

      <Modale ouverte={!!codeAffiche} titre="Code de confirmation" onFermer={() => setCodeAffiche(null)}>
        <Alerte ton="avert">Copiez ce code maintenant : il ne sera plus affichable. En cas de perte, vous pourrez en régénérer un.</Alerte>
        <div className="carte point" style={{ textAlign: 'center' }}><div className="stat" style={{ fontSize: '1.7rem', letterSpacing: '.05em' }}>{codeAffiche?.code}</div>
          <p className="muted petit" style={{ margin: '.5rem 0 0' }}>À activer avant le {dateFr(codeAffiche?.valide)}</p></div>
        <div className="ligne" style={{ marginTop: '1rem' }}>
          <Btn onClick={() => navigator.clipboard?.writeText(codeAffiche!.code)}>Copier</Btn>
          <a className="btn sec" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Votre code de confirmation COUTURE GESTION : ${codeAffiche?.code}`)}`}>Partager par WhatsApp</a>
        </div>
      </Modale>

      <Modale ouverte={!!prolong} titre="Prolonger l'abonnement" onFermer={() => setProlong(null)}>
        <Champ label="Jours à ajouter"><input className="input" type="number" min={1} value={prolong?.jours ?? ''} onChange={(e) => setProlong({ ...prolong!, jours: e.target.value })} /></Champ>
        <Btn bloc chargement={enCours} onClick={async () => { await post(prolong!.id, 'prolonger', 'Abonnement prolongé.', { jours: Number(prolong!.jours) }); setProlong(null); }}>Prolonger</Btn>
      </Modale>

      <Modale ouverte={!!edition} titre="Modifier les dates" onFermer={() => setEdition(null)}>
        <Champ label="Début"><input className="input" type="datetime-local" value={edition?.debut ?? ''} onChange={(e) => setEdition({ ...edition!, debut: e.target.value })} /></Champ>
        <Champ label="Fin" aide="Heure UTC (identique à l'heure de Bamako)."><input className="input" type="datetime-local" value={edition?.fin ?? ''} onChange={(e) => setEdition({ ...edition!, fin: e.target.value })} /></Champ>
        <Btn bloc chargement={enCours} onClick={() => lancer(async () => {
          await api(`/api/admin/abonnements/${edition!.id}`, { method: 'PATCH', body: { debut_at: new Date(edition!.debut + ':00Z').toISOString(), fin_at: new Date(edition!.fin + ':00Z').toISOString() } });
          setEdition(null); recharger();
        }, 'Dates modifiées.', msgErreur)}>Enregistrer</Btn>
      </Modale>
    </>
  );
}
