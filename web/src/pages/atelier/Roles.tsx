import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { useMembres, useProfilsAcces, useRoles } from '../../lib/hooks';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, Vide, useAction, useRetours } from '../../components/ui';

export default function Roles() {
  const { ctx, session } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction(); const { confirmer } = useRetours();
  const roles = useRoles(); const profils = useProfilsAcces(); const membres = useMembres();
  const permsCat = useQuery({ queryKey: ['permissions'], queryFn: async () => { const { data, error } = await supabase.from('permissions').select('*').order('groupe').order('code'); if (error) throw error; return data as any[]; } });
  const liens = useQuery({ queryKey: ['liens-membres'], queryFn: async () => {
    const [r, p] = await Promise.all([supabase.from('membre_roles_production').select('user_id, role_id'), supabase.from('membre_profils_acces').select('user_id, profil_acces_id')]);
    return { roles: (r.data ?? []) as any[], profils: (p.data ?? []) as any[] }; } });
  const [onglet, setOnglet] = useState<'roles' | 'profils'>('roles');
  const [role, setRole] = useState<{ id?: string; nom: string; description: string; actif: boolean } | null>(null);
  const [profil, setProfil] = useState<{ id?: string; nom: string; description: string; perms: string[] } | null>(null);
  const [er, setEr] = useState<string | null>(null);
  const moi = session!.user.id; const mesPerms = new Set(ctx?.permissions ?? []);
  const refresh = () => { ['roles-production', 'profils-acces', 'liens-membres'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); };

  if (roles.isLoading || profils.isLoading) return <Chargement />;
  const mesProfilsIds = (liens.data?.profils ?? []).filter((x) => x.user_id === moi).map((x) => x.profil_acces_id);

  const sauverRole = () => lancer(async () => {
    setEr(null); const n = role!.nom.trim(); if (n.length < 2) { setEr('Nom trop court.'); return; }
    const ligne = { nom: n, description: role!.description.trim() || null, actif: role!.actif };
    const r = role!.id ? await supabase.from('roles_production').update(ligne).eq('id', role!.id) : await supabase.from('roles_production').insert({ ...ligne, atelier_id: ctx!.atelier!.id });
    if (r.error) throw r.error; setRole(null); refresh();
  }, 'Rôle enregistré.', msgErreur);

  const sauverProfil = () => lancer(async () => {
    setEr(null); const n = profil!.nom.trim(); if (n.length < 2) { setEr('Nom trop court.'); return; }
    let id = profil!.id;
    if (id) { const r = await supabase.from('profils_acces').update({ nom: n, description: profil!.description.trim() || null }).eq('id', id); if (r.error) throw r.error; }
    else { const r = await supabase.from('profils_acces').insert({ nom: n, description: profil!.description.trim() || null, atelier_id: ctx!.atelier!.id }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
    const actuelles = profils.data?.find((p) => p.id === id)?.permissions ?? [];
    const aAjouter = profil!.perms.filter((p) => !actuelles.includes(p)), aRetirer = actuelles.filter((p) => !profil!.perms.includes(p));
    if (aAjouter.length) { const r = await supabase.from('profil_acces_permissions').insert(aAjouter.map((p) => ({ profil_acces_id: id, atelier_id: ctx!.atelier!.id, permission_code: p }))); if (r.error) throw r.error; }
    if (aRetirer.length) { const r = await supabase.from('profil_acces_permissions').delete().eq('profil_acces_id', id!).in('permission_code', aRetirer); if (r.error) throw r.error; }
    setProfil(null); refresh();
  }, 'Profil d’accès enregistré.', msgErreur);

  const groupes = [...new Set((permsCat.data ?? []).map((p) => p.groupe))];
  const bloque = profil?.id ? mesProfilsIds.includes(profil.id) && !ctx?.est_proprietaire : false;

  return (
    <>
      <EnTete titre="Rôles et accès">
        {onglet === 'roles' && peut(ctx, 'roles.creer') && <Btn onClick={() => { setEr(null); setRole({ nom: '', description: '', actif: true }); }}>Nouveau rôle</Btn>}
        {onglet === 'profils' && peut(ctx, 'roles.creer') && <Btn onClick={() => { setEr(null); setProfil({ nom: '', description: '', perms: [] }); }}>Nouveau profil d'accès</Btn>}
      </EnTete>
      <div className="onglets"><button className={onglet === 'roles' ? 'on' : ''} onClick={() => setOnglet('roles')}>Rôles de production</button><button className={onglet === 'profils' ? 'on' : ''} onClick={() => setOnglet('profils')}>Profils d'accès</button></div>

      {onglet === 'roles' && (<>
        <p className="muted petit">Les rôles de production (Coupeur, Monteur…) décident qui peut recevoir quelle étape de fabrication. Une personne peut en avoir plusieurs ; plusieurs personnes peuvent avoir le même.</p>
        {!roles.data?.length && <Vide titre="Aucun rôle" />}
        <div className="pile">{roles.data?.map((r) => { const gens = (liens.data?.roles ?? []).filter((x) => x.role_id === r.id).map((x) => membres.data?.find((m) => m.user_id === x.user_id)).filter(Boolean);
          return (<div key={r.id} className="carte"><div className="ligne"><b>{r.nom}</b>{!r.actif && <Badge ton="gris">Désactivé</Badge>}<span className="espace" />{peut(ctx, 'roles.modifier') && <Btn variante="sec" petit onClick={() => { setEr(null); setRole({ id: r.id, nom: r.nom, description: r.description ?? '', actif: r.actif }); }}>Modifier</Btn>}</div>
            {r.description && <p className="muted petit" style={{ margin: '.3rem 0 0' }}>{r.description}</p>}
            <div className="cases" style={{ marginTop: '.5rem' }}>{gens.length ? gens.map((m: any) => <Badge key={m.user_id}>{m.prenom} {m.nom}</Badge>) : <span className="muted petit">Personne n'a ce rôle.</span>}</div></div>); })}</div></>)}

      {onglet === 'profils' && (<>
        <p className="muted petit">Un profil d'accès regroupe des permissions (ce qu'on a le droit de faire). Vous ne pouvez attribuer que des permissions que vous possédez, et vous ne pouvez pas modifier vos propres accès.</p>
        <div className="pile">{profils.data?.map((p) => (<div key={p.id} className="carte"><div className="ligne"><b>{p.nom}</b><span className="muted petit">{p.permissions.length} permission(s) · {(liens.data?.profils ?? []).filter((x) => x.profil_acces_id === p.id).length} personne(s)</span><span className="espace" />
          {peut(ctx, 'roles.modifier') && <Btn variante="sec" petit onClick={() => { setEr(null); setProfil({ id: p.id, nom: p.nom, description: p.description ?? '', perms: p.permissions }); }}>{ctx?.est_proprietaire || !mesProfilsIds.includes(p.id) ? 'Modifier' : 'Voir'}</Btn>}</div>
          {p.description && <p className="muted petit" style={{ margin: '.3rem 0 0' }}>{p.description}</p>}</div>))}</div></>)}

      <Modale ouverte={!!role} titre={role?.id ? 'Modifier le rôle' : 'Nouveau rôle'} onFermer={() => setRole(null)}>
        {er && <Alerte ton="err">{er}</Alerte>}
        <Champ label="Nom"><input className="input" value={role?.nom ?? ''} onChange={(e) => setRole({ ...role!, nom: e.target.value })} /></Champ>
        <Champ label="Description (facultatif)"><input className="input" value={role?.description ?? ''} onChange={(e) => setRole({ ...role!, description: e.target.value })} /></Champ>
        {role?.id && <label className="case" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={role.actif} onChange={(e) => setRole({ ...role, actif: e.target.checked })} />Rôle actif (décocher pour le désactiver sans perdre l'historique)</label>}
        <Btn bloc chargement={enCours} onClick={sauverRole}>Enregistrer</Btn>
        {role?.id && peut(ctx, 'roles.modifier') && <Btn bloc variante="danger sec" disabled={enCours} style={{ marginTop: '.6rem' }} onClick={async () => {
          if (!(await confirmer('Supprimer ce rôle ? Possible uniquement s\'il n\'est attribué à personne et absent des circuits et de l\'historique.', { danger: true, libelle: 'Supprimer' }))) return;
          lancer(async () => { const { error } = await supabase.from('roles_production').delete().eq('id', role.id!); if (error) throw error; setRole(null); refresh(); }, 'Rôle supprimé.', (e) => /foreign key|violates/i.test((e as any)?.message ?? '') ? 'Ce rôle est encore utilisé (personnes, circuits ou historique) : désactivez-le plutôt.' : msgErreur(e));
        }}>Supprimer ce rôle</Btn>}
      </Modale>

      <Modale ouverte={!!profil} titre={profil?.id ? 'Profil d’accès' : 'Nouveau profil d’accès'} onFermer={() => setProfil(null)} large>
        {er && <Alerte ton="err">{er}</Alerte>}
        {bloque && <Alerte ton="avert">Vous possédez ce profil : vous ne pouvez pas le modifier.</Alerte>}
        <div className="grille2"><Champ label="Nom"><input className="input" disabled={bloque} value={profil?.nom ?? ''} onChange={(e) => setProfil({ ...profil!, nom: e.target.value })} /></Champ><Champ label="Description"><input className="input" disabled={bloque} value={profil?.description ?? ''} onChange={(e) => setProfil({ ...profil!, description: e.target.value })} /></Champ></div>
        {groupes.map((g) => (<div key={g} style={{ marginBottom: '.8rem' }}><h3 style={{ marginBottom: '.4rem' }}>{g}</h3><div className="cases">{permsCat.data?.filter((p) => p.groupe === g).map((p) => { const on = profil?.perms.includes(p.code); const interdit = bloque || (!ctx?.est_proprietaire && !mesPerms.has(p.code));
          return <label key={p.code} className={`case ${on ? 'on' : ''}`} title={interdit && !bloque ? "Vous ne possédez pas cette permission" : undefined}><input type="checkbox" disabled={interdit} checked={!!on} onChange={() => setProfil({ ...profil!, perms: on ? profil!.perms.filter((x) => x !== p.code) : [...profil!.perms, p.code] })} />{p.libelle}</label>; })}</div></div>))}
        {!bloque && <Btn bloc chargement={enCours} onClick={sauverProfil}>Enregistrer</Btn>}
      </Modale>
    </>
  );
}
