import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { msgErreur } from '../../lib/erreurs';
import { compresserImage, televerser } from '../../lib/images';
import { useTypesVetements } from '../../lib/hooks';
import { Alerte, Badge, Btn, Champ, Chargement, EnTete, Modale, Vide, useAction } from '../../components/ui';
import { Photo } from '../../components/Photo';

export default function Modeles() {
  const { ctx } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const types = useTypesVetements();
  const q = useQuery({ queryKey: ['modeles-tous'], queryFn: async () => { const { data, error } = await supabase.from('modeles').select('*').order('nom'); if (error) throw error; return data as any[]; } });
  const [m, setM] = useState<{ id?: string; nom: string; type_vetement_id: string; actif: boolean; photo?: Blob; apercu?: string; photo_path?: string | null } | null>(null);
  const [er, setEr] = useState<string | null>(null);
  if (q.isLoading) return <Chargement />;
  const fin = () => { qc.invalidateQueries({ queryKey: ['modeles-tous'] }); qc.invalidateQueries({ queryKey: ['modeles'] }); };

  const sauver = () => lancer(async () => {
    setEr(null); if (m!.nom.trim().length < 1) { setEr('Donnez un nom au modèle.'); return; }
    let chemin = m!.photo_path ?? null;
    if (m!.photo) { chemin = `${ctx!.atelier!.id}/modeles/${crypto.randomUUID()}.jpg`; await televerser('photos-habits', chemin, m!.photo); }
    const ligne = { nom: m!.nom.trim(), type_vetement_id: m!.type_vetement_id || null, actif: m!.actif, photo_path: chemin };
    const r = m!.id ? await supabase.from('modeles').update(ligne).eq('id', m!.id) : await supabase.from('modeles').insert({ ...ligne, atelier_id: ctx!.atelier!.id });
    if (r.error) throw r.error; setM(null); fin();
  }, 'Modèle enregistré.', msgErreur);

  return (
    <>
      <EnTete titre="Modèles de vêtements"><Btn onClick={() => { setEr(null); setM({ nom: '', type_vetement_id: '', actif: true }); }}>Nouveau modèle</Btn></EnTete>
      {!q.data?.length && <Vide titre="Aucun modèle" texte="Ajoutez des modèles avec photo pour les réutiliser dans vos commandes." />}
      <div className="grille">{q.data?.map((x) => (
        <button key={x.id} type="button" className="carte cliquable" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => { setEr(null); setM({ id: x.id, nom: x.nom, type_vetement_id: x.type_vetement_id ?? '', actif: x.actif, photo_path: x.photo_path }); }}>
          <Photo chemin={x.photo_path} alt={x.nom} /><div className="ligne" style={{ marginTop: '.5rem' }}><b>{x.nom}</b>{!x.actif && <Badge ton="gris">Désactivé</Badge>}</div></button>))}</div>
      <Modale ouverte={!!m} titre={m?.id ? 'Modifier le modèle' : 'Nouveau modèle'} onFermer={() => setM(null)}>
        {er && <Alerte ton="err">{er}</Alerte>}
        <Champ label="Nom"><input className="input" value={m?.nom ?? ''} onChange={(e) => setM({ ...m!, nom: e.target.value })} /></Champ>
        <Champ label="Type de vêtement (facultatif)"><select className="input" value={m?.type_vetement_id ?? ''} onChange={(e) => setM({ ...m!, type_vetement_id: e.target.value })}><option value="">—</option>{types.data?.filter((t) => t.actif).map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}</select></Champ>
        <Champ label="Photo" aide="Compressée automatiquement avant l'envoi."><input className="input" type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const b = await compresserImage(f); setM({ ...m!, photo: b, apercu: URL.createObjectURL(b) }); } catch (x) { setEr((x as Error).message); } }} /></Champ>
        {m?.apercu ? <img className="photo" src={m.apercu} alt="Aperçu" style={{ marginBottom: '.9rem' }} /> : m?.photo_path ? <div style={{ marginBottom: '.9rem' }}><Photo chemin={m.photo_path} alt="Photo actuelle" /></div> : null}
        {m?.id && <label className="case" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={m.actif} onChange={(e) => setM({ ...m, actif: e.target.checked })} />Modèle actif</label>}
        <Btn bloc chargement={enCours} onClick={sauver}>Enregistrer</Btn>
      </Modale>
    </>
  );
}
