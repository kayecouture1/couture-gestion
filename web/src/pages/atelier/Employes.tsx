import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateHeure } from '../../lib/format';
import { useMembres, useProfilsAcces, useRoles, type Membre } from '../../lib/hooks';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, Vide, useAction, useRetours } from '../../components/ui';
import { Photo } from '../../components/Photo';

const Coches = ({ items, choisis, onChange, desactives = [] }: { items: { id: string; nom: string }[]; choisis: string[]; onChange: (ids: string[]) => void; desactives?: string[] }) => (
  <div className="cases">{items.map((i) => { const on = choisis.includes(i.id); return (
    <label key={i.id} className={`case ${on ? 'on' : ''}`}><input type="checkbox" checked={on} disabled={desactives.includes(i.id)} onChange={() => onChange(on ? choisis.filter((x) => x !== i.id) : [...choisis, i.id])} />{i.nom}</label>); })}</div>
);

export default function Employes() {
  const { ctx } = useAuth(); const qc = useQueryClient(); const { confirmer } = useRetours(); const { enCours, lancer } = useAction();
  const membres = useMembres(); const roles = useRoles(); const profils = useProfilsAcces();
  const liens = useQuery({ queryKey: ['liens-membres'], queryFn: async () => {
    const [r, p] = await Promise.all([supabase.from('membre_roles_production').select('user_id, role_id'), supabase.from('membre_profils_acces').select('user_id, profil_acces_id')]);
    if (r.error) throw r.error; if (p.error) throw p.error; return { roles: r.data as any[], profils: p.data as any[] };
  } });
  const [ajout, setAjout] = useState(false);
  const [f, setF] = useState({ nom: '', prenom: '', telephone: '', email: '', roles: [] as string[], profils: [] as string[] });
  const [er, setEr] = useState<string | null>(null);
  const [identifiants, setIdentifiants] = useState<any | null>(null);
  const [fiche, setFiche] = useState<Membre | null>(null);
  const [infos, setInfos] = useState({ nom: '', prenom: '', telephone: '' });
  const actualiser = () => { qc.invalidateQueries({ queryKey: ['membres'] }); qc.invalidateQueries({ queryKey: ['liens-membres'] }); };

  const activite = useQuery({ queryKey: ['activite', fiche?.user_id], enabled: !!fiche && peut(ctx, 'habits.voir_circuit', 'habits.voir'), queryFn: async () => {
    const { data } = await supabase.from('habit_etapes').select('id, nom, statut, pris_a, termine_a, habits(code)').eq('pris_par', fiche!.user_id).order('pris_a', { ascending: false }).limit(10); return data as any[]; } });

  if (membres.isLoading || roles.isLoading) return <Chargement />;
  const rolesDe = (uid: string) => (liens.data?.roles ?? []).filter((x) => x.user_id === uid).map((x) => x.role_id as string);
  const profilsDe = (uid: string) => (liens.data?.profils ?? []).filter((x) => x.user_id === uid).map((x) => x.profil_acces_id as string);
  const permsEffectives = (uid: string, proprio: boolean) => proprio ? ['Toutes les permissions (propriétaire)'] : [...new Set(profilsDe(uid).flatMap((pid) => profils.data?.find((p) => p.id === pid)?.permissions ?? []))].sort();
  const mesPerms = new Set(ctx?.permissions ?? []);
  const profilsAttribuables = (profils.data ?? []).filter((p) => ctx?.est_proprietaire || p.permissions.every((x) => mesPerms.has(x)));
  const interdits = (profils.data ?? []).filter((p) => !profilsAttribuables.includes(p)).map((p) => p.id);

  const creer = () => lancer(async () => {
    setEr(null);
    if (!f.nom.trim() || !f.prenom.trim()) { setEr('Nom et prénom requis.'); return; }
    const r = await api('/api/employes', { body: { ...f, telephone: f.telephone || undefined, email: f.email || undefined } });
    setAjout(false); setIdentifiants(r); setF({ nom: '', prenom: '', telephone: '', email: '', roles: [], profils: [] }); actualiser();
  }, undefined, msgErreur);

  async function basculerLien(table: 'membre_roles_production' | 'membre_profils_acces', cle: 'role_id' | 'profil_acces_id', uid: string, id: string, ajouter: boolean) {
    await lancer(async () => {
      const r = ajouter ? await supabase.from(table).insert({ user_id: uid, [cle]: id, atelier_id: ctx!.atelier!.id }) : await supabase.from(table).delete().eq('user_id', uid).eq(cle, id);
      if (r.error) throw r.error; actualiser();
    }, undefined, (e) => ((e as any)?.message ?? '').includes('ESCALADE') ? msgErreur(e) : msgErreur(e));
  }

  return (
    <>
      <EnTete titre="Employés">{peut(ctx, 'employes.creer') && <Btn onClick={() => setAjout(true)}>Ajouter un employé</Btn>}</EnTete>
      <div className="grille" style={{ marginBottom: '1rem' }}>
        <div className="carte"><div className="stat">{membres.data?.filter((m) => m.statut === 'actif').length}<small>Actifs</small></div></div>
        <div className="carte"><div className="stat">{membres.data?.filter((m) => m.statut !== 'actif').length}<small>Désactivés</small></div></div>
      </div>
      {!membres.data?.length && <Vide titre="Aucun employé" />}
      <div className="pile">
        {membres.data?.map((m) => (
          <button key={m.user_id} type="button" className="carte cliquable" style={{ textAlign: 'left', cursor: 'pointer', opacity: m.statut === 'actif' ? 1 : .6 }} onClick={() => { setFiche(m); setInfos({ nom: m.nom, prenom: m.prenom, telephone: m.telephone ?? '' }); }}>
            <div className="ligne">{m.photo_path && <div style={{ width: 40 }}><Photo bucket="avatars" chemin={m.photo_path} alt="" classe="vignette" /></div>}<b>{m.prenom} {m.nom}</b>{m.est_proprietaire && <Badge ton="ocre">Propriétaire</Badge>}{m.statut !== 'actif' && <Badge ton="gris">Désactivé</Badge>}<span className="espace" /><span className="muted petit">{m.identifiant_interne ?? m.email ?? ''}</span></div>
            <div className="cases" style={{ marginTop: '.4rem' }}>{rolesDe(m.user_id).map((rid) => <Badge key={rid}>{roles.data?.find((r) => r.id === rid)?.nom}</Badge>)}
              {profilsDe(m.user_id).map((pid) => <Badge key={pid} ton="ok">{profils.data?.find((p) => p.id === pid)?.nom}</Badge>)}</div>
          </button>))}
      </div>

      <Modale ouverte={ajout} titre="Ajouter un employé" onFermer={() => setAjout(false)} large>
        {er && <Alerte ton="err">{er}</Alerte>}
        <div className="grille2"><Champ label="Nom"><input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ><Champ label="Prénom"><input className="input" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></Champ>
          <Champ label="Téléphone (facultatif)"><input className="input" type="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></Champ>
          <Champ label="Email (facultatif)" aide="Sans email, l'employé se connecte avec un identifiant interne."><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Champ></div>
        <Champ label="Rôles de production" aide="Détermine les étapes de fabrication qu'il peut recevoir."><Coches items={(roles.data ?? []).filter((r) => r.actif)} choisis={f.roles} onChange={(x) => setF({ ...f, roles: x })} /></Champ>
        <Champ label="Profils d'accès" aide="Détermine ce qu'il peut faire dans l'application."><Coches items={profilsAttribuables} choisis={f.profils} onChange={(x) => setF({ ...f, profils: x })} /></Champ>
        <Btn bloc chargement={enCours} onClick={creer}>Créer le compte</Btn>
      </Modale>

      <Modale ouverte={!!identifiants} titre="Compte créé" onFermer={() => setIdentifiants(null)}>
        <Alerte ton="avert">Notez ces identifiants maintenant et transmettez-les à l'employé. Le mot de passe ne sera plus affiché. Il devra le changer à sa première connexion.</Alerte>
        <div className="carte point"><p style={{ margin: 0 }}>Code atelier : <b>{identifiants?.code_atelier}</b></p><p style={{ margin: '.3rem 0' }}>Identifiant : <b>{identifiants?.identifiant}</b></p><p style={{ margin: 0 }}>Mot de passe temporaire : <b>{identifiants?.mot_de_passe_temporaire}</b></p></div>
        <Btn style={{ marginTop: '1rem' }} onClick={() => navigator.clipboard?.writeText(`Code atelier : ${identifiants.code_atelier}\nIdentifiant : ${identifiants.identifiant}\nMot de passe temporaire : ${identifiants.mot_de_passe_temporaire}`)}><Copy size={16} /> Copier</Btn>
      </Modale>

      <Modale ouverte={!!fiche} titre={fiche ? `${fiche.prenom} ${fiche.nom}` : ''} onFermer={() => setFiche(null)} large>
        {fiche && (<>
          <div className="ligne" style={{ marginBottom: '.7rem' }}>{fiche.est_proprietaire && <Badge ton="ocre">Propriétaire</Badge>}<Badge ton={fiche.statut === 'actif' ? 'ok' : 'gris'}>{fiche.statut === 'actif' ? 'Actif' : 'Désactivé'}</Badge><span className="muted petit">{fiche.identifiant_interne ?? fiche.email}</span></div>
          {peut(ctx, 'employes.modifier') && !fiche.est_proprietaire && (<div className="grille2"><Champ label="Nom"><input className="input" value={infos.nom} onChange={(e) => setInfos({ ...infos, nom: e.target.value })} /></Champ><Champ label="Prénom"><input className="input" value={infos.prenom} onChange={(e) => setInfos({ ...infos, prenom: e.target.value })} /></Champ>
            <Champ label="Téléphone"><input className="input" value={infos.telephone} onChange={(e) => setInfos({ ...infos, telephone: e.target.value })} /></Champ></div>)}
          <>
            <Champ label="Rôles de production" aide="Le propriétaire peut également recevoir un ou plusieurs rôles de production."><Coches items={(roles.data ?? []).filter((r) => r.actif || rolesDe(fiche.user_id).includes(r.id))} choisis={rolesDe(fiche.user_id)} onChange={() => {}} desactives={(roles.data ?? []).map((r) => r.id)} /></Champ>
            {peut(ctx, 'roles.attribuer') && <div className="cases" style={{ marginBottom: '.9rem' }}>{(roles.data ?? []).filter((r) => r.actif).map((r) => { const on = rolesDe(fiche.user_id).includes(r.id); return <Btn key={r.id} petit variante={on ? undefined : 'sec'} disabled={enCours} onClick={() => basculerLien('membre_roles_production', 'role_id', fiche.user_id, r.id, !on)}>{on ? '✓ ' : '+ '}{r.nom}</Btn>; })}</div>}
            {!fiche.est_proprietaire && <Champ label="Profils d'accès" aide="Les profils d'accès ne sont pas nécessaires pour le propriétaire, qui possède déjà toutes les permissions.">
              <div className="cases">{(profils.data ?? []).map((p) => { const on = profilsDe(fiche.user_id).includes(p.id); const bloque = !peut(ctx, 'roles.attribuer') || interdits.includes(p.id); return <Btn key={p.id} petit variante={on ? 'ocre' : 'sec'} disabled={enCours || bloque} onClick={() => basculerLien('membre_profils_acces', 'profil_acces_id', fiche.user_id, p.id, !on)}>{on ? '✓ ' : '+ '}{p.nom}</Btn>; })}</div></Champ>}
          </>
          <h3 style={{ margin: '.8rem 0 .4rem' }}>Permissions effectives</h3>
          <p className="muted petit">{permsEffectives(fiche.user_id, fiche.est_proprietaire).join(', ') || 'Aucune permission.'}</p>
          {activite.data && activite.data.length > 0 && (<><h3 style={{ margin: '.8rem 0 .4rem' }}>Activité récente</h3><table className="tableau"><tbody>{activite.data.map((a) => <tr key={a.id}><td>{a.habits?.code}</td><td>{a.nom}</td><td>{dateHeure(a.pris_a)}</td><td>{a.statut === 'terminee' ? 'Terminé' : 'En cours'}</td></tr>)}</tbody></table></>)}
          {!fiche.est_proprietaire && (<div className="ligne" style={{ marginTop: '1rem' }}>
            {peut(ctx, 'employes.modifier') && <Btn chargement={enCours} onClick={() => lancer(async () => { await api(`/api/employes/${fiche.user_id}`, { method: 'PATCH', body: { ...infos } }); actualiser(); }, 'Informations enregistrées.', msgErreur)}>Enregistrer</Btn>}
            {peut(ctx, 'employes.modifier') && <Btn variante="sec" disabled={enCours} onClick={async () => { if (!(await confirmer('Réinitialiser le mot de passe de cet employé ?'))) return; lancer(async () => { const r = await api('/api/employes/' + fiche.user_id + '/reinitialiser-mdp', { method: 'POST', body: {} }); setFiche(null); setIdentifiants(r); }, undefined, msgErreur); }}>Réinitialiser le mot de passe</Btn>}
            {peut(ctx, 'employes.desactiver') && <Btn variante={fiche.statut === 'actif' ? 'danger sec' : undefined} disabled={enCours} onClick={async () => {
              const actif = fiche.statut !== 'actif';
              if (!(await confirmer(actif ? 'Réactiver cet employé ?' : 'Désactiver cet employé ? Il ne pourra plus se connecter ni prendre de travaux. Son historique est conservé.', { danger: !actif }))) return;
              lancer(async () => { await api(`/api/employes/${fiche.user_id}/statut`, { method: 'PATCH', body: { actif } }); setFiche(null); actualiser(); }, actif ? 'Employé réactivé.' : 'Employé désactivé.', msgErreur); }}>{fiche.statut === 'actif' ? 'Désactiver' : 'Réactiver'}</Btn>}
          </div>)}
        </>)}
      </Modale>
    </>
  );
}
