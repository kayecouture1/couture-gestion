import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { msgErreur } from '../../lib/erreurs';
import { compresserImage } from '../../lib/images';
import { normaliserTelephone } from '../../lib/format';
import { Alerte, Btn, Champ, Chargement, EnTete, useAction } from '../../components/ui';
import { Photo } from '../../components/Photo';

// Mon profil : chacun modifie ses propres informations (la base n'autorise que sa propre ligne).
export default function Profil() {
  const { session, ctx } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const uid = session!.user.id; const avecPhoto = ctx?.type === 'membre';
  const [f, setF] = useState<{ nom: string; prenom: string; telephone: string } | null>(null);
  const q = useQuery({ queryKey: ['mon-profil', uid], queryFn: async () => {
    const { data, error } = await supabase.from('profils').select('*').eq('id', uid).single(); if (error) throw error;
    setF({ nom: data.nom, prenom: data.prenom, telephone: data.telephone ?? '' }); return data as any; } });
  if (q.isLoading || !f) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;

  const enregistrer = () => lancer(async () => {
    if (!f.nom.trim() || !f.prenom.trim()) throw new Error('Nom et prénom requis.');
    const tel = f.telephone.trim() ? normaliserTelephone(f.telephone) : null;
    if (f.telephone.trim() && !tel) throw new Error('Numéro de téléphone invalide.');
    const { error } = await supabase.from('profils').update({ nom: f.nom.trim(), prenom: f.prenom.trim(), telephone: tel }).eq('id', uid); if (error) throw error;
    qc.invalidateQueries({ queryKey: ['membres'] });
  }, 'Profil enregistré.', (e) => /requis|invalide/.test((e as any)?.message ?? '') ? (e as any).message : msgErreur(e));

  const photo = (fichier?: File | null) => fichier && lancer(async () => {
    const blob = await compresserImage(fichier, 400, 0.8);
    const chemin = `${ctx!.atelier!.id}/${uid}.jpg`;
    const up = await supabase.storage.from('avatars').upload(chemin, blob, { contentType: 'image/jpeg', upsert: true }); if (up.error) throw up.error;
    const { error } = await supabase.from('profils').update({ photo_path: chemin }).eq('id', uid); if (error) throw error;
    qc.invalidateQueries({ queryKey: ['mon-profil', uid] }); qc.invalidateQueries({ queryKey: ['membres'] }); qc.invalidateQueries({ queryKey: ['url', 'avatars'] });
  }, 'Photo enregistrée.', msgErreur);

  return (
    <>
      <EnTete titre="Mon profil" />
      <div className="carte" style={{ maxWidth: 560 }}>
        {avecPhoto && <div className="ligne" style={{ marginBottom: '1rem' }}><div style={{ width: 84 }}><Photo bucket="avatars" chemin={q.data.photo_path} alt="Ma photo" classe="vignette" /></div>
          <Champ label="Photo (facultatif)"><input className="input" type="file" accept="image/*" onChange={(e) => photo(e.target.files?.[0])} /></Champ></div>}
        <div className="grille2"><Champ label="Nom"><input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ><Champ label="Prénom"><input className="input" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></Champ></div>
        <Champ label="Téléphone"><input className="input" type="tel" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></Champ>
        <p className="muted petit">{q.data.email ? `Email : ${q.data.email}` : ctx?.identifiant ? `Identifiant : ${ctx.identifiant}` : ''}</p>
        <div className="ligne"><Btn chargement={enCours} onClick={enregistrer}>Enregistrer</Btn><Link className="btn sec" to="/changer-mot-de-passe">Changer mon mot de passe</Link></div>
      </div>
    </>
  );
}
