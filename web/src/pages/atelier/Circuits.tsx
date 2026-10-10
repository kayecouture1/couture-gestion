import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { msgErreur } from '../../lib/erreurs';
import { useCircuits, useMembres, useRoles } from '../../lib/hooks';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, Vide, useAction } from '../../components/ui';
import { EditeurCircuit, etapeVide, verifierEtapes, type EtapeForm } from '../../components/EditeurCircuit';

export default function Circuits() {
  const { ctx } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const circuits = useCircuits(); const roles = useRoles(); const membres = useMembres();
  const [ed, setEd] = useState<{ id?: string; nom: string; actif: boolean; etapes: EtapeForm[] } | null>(null);
  const [er, setEr] = useState<string | null>(null);
  if (circuits.isLoading) return <Chargement />;
  const nomRole = (id: string) => roles.data?.find((r) => r.id === id)?.nom ?? '?';
  const nomUser = (id: string) => { const m = membres.data?.find((x) => x.user_id === id); return m ? `${m.prenom} ${m.nom}` : '?'; };

  const sauver = () => lancer(async () => {
    setEr(null);
    if (ed!.nom.trim().length < 2) { setEr('Donnez un nom au circuit.'); return; }
    const v = verifierEtapes(ed!.etapes); if (v) { setEr(v); return; }
    let id = ed!.id;
    if (id) { const r = await supabase.from('modeles_circuits').update({ nom: ed!.nom.trim(), actif: ed!.actif }).eq('id', id); if (r.error) throw r.error; const d = await supabase.from('modeles_circuits_etapes').delete().eq('modele_circuit_id', id); if (d.error) throw d.error; }
    else { const r = await supabase.from('modeles_circuits').insert({ nom: ed!.nom.trim(), atelier_id: ctx!.atelier!.id }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
    const lignes = ed!.etapes.map((e, i) => ({ modele_circuit_id: id, atelier_id: ctx!.atelier!.id, ordre: i + 1, nom: e.nom.trim(), mode: e.mode, role_id: e.mode === 'role' ? e.role_id : null, user_id: e.mode === 'personne' ? e.user_id : null }));
    const r = await supabase.from('modeles_circuits_etapes').insert(lignes); if (r.error) throw r.error;
    setEd(null); qc.invalidateQueries({ queryKey: ['modeles-circuits'] });
  }, 'Circuit enregistré. Les habits déjà créés ne sont pas modifiés.', msgErreur);

  return (
    <>
      <EnTete titre="Modèles de circuits"><Btn onClick={() => { setEr(null); setEd({ nom: '', actif: true, etapes: [etapeVide()] }); }}>Nouveau circuit</Btn></EnTete>
      <Alerte ton="info">Un modèle de circuit est copié dans chaque habit au moment de sa création. Le modifier ensuite ne change jamais les habits déjà créés ou en production.</Alerte>
      {!circuits.data?.length && <Vide titre="Aucun circuit" texte="Créez votre premier circuit, par exemple Coupe → Montage → Repassage." />}
      <div className="pile">{circuits.data?.map((c) => (
        <div key={c.id} className="carte"><div className="ligne"><b>{c.nom}</b>{!c.actif && <Badge ton="gris">Désactivé</Badge>}<span className="espace" />
          <Btn variante="sec" petit onClick={() => { setEr(null); setEd({ id: c.id, nom: c.nom, actif: c.actif, etapes: c.etapes.map((e: any) => ({ nom: e.nom, mode: e.mode, role_id: e.role_id ?? '', user_id: e.user_id ?? '' })) }); }}>Modifier</Btn></div>
          <p className="muted petit" style={{ margin: '.4rem 0 0' }}>{c.etapes.map((e: any) => `${e.nom} (${e.mode === 'role' ? nomRole(e.role_id) : nomUser(e.user_id)})`).join(' → ')}</p></div>))}</div>
      <Modale ouverte={!!ed} titre={ed?.id ? 'Modifier le circuit' : 'Nouveau circuit'} onFermer={() => setEd(null)} large>
        {er && <Alerte ton="err">{er}</Alerte>}
        <Champ label="Nom du circuit"><input className="input" value={ed?.nom ?? ''} onChange={(e) => setEd({ ...ed!, nom: e.target.value })} /></Champ>
        <EditeurCircuit etapes={ed?.etapes ?? []} onChange={(etapes) => setEd({ ...ed!, etapes })} roles={roles.data ?? []} membres={membres.data ?? []} />
        {ed?.id && <label className="case" style={{ margin: '1rem 0' }}><input type="checkbox" checked={ed.actif} onChange={(e) => setEd({ ...ed, actif: e.target.checked })} />Circuit actif</label>}
        <Btn bloc chargement={enCours} onClick={sauver} style={{ marginTop: '1rem' }}>Enregistrer</Btn>
      </Modale>
    </>
  );
}
