import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Btn, Chargement, EnTete, Modale, Vide } from '../../components/ui';
import { ClientForm } from '../../components/ClientForm';

export default function Clients() {
  const { ctx } = useAuth(); const nav = useNavigate();
  const [terme, setTerme] = useState(''); const [nouveau, setNouveau] = useState(false); const [archives, setArchives] = useState(false);
  const q = useQuery({
    queryKey: ['clients', terme, archives],
    queryFn: async () => {
      let r = supabase.from('clients').select('id, nom, prenom, telephone_e164, whatsapp_e164').order('nom').limit(200);
      r = archives ? r.not('archived_at', 'is', null) : r.is('archived_at', null);
      const t = terme.trim().replace(/[%,()]/g, '');
      if (t) r = r.or(`nom.ilike.%${t}%,prenom.ilike.%${t}%,telephone_e164.ilike.%${t}%`);
      const { data, error } = await r; if (error) throw error; return data;
    },
  });
  return (
    <>
      <EnTete titre="Clients">{peut(ctx, 'clients.creer') && <Btn onClick={() => setNouveau(true)}>Nouveau client</Btn>}</EnTete>
      <input className="input" placeholder="Rechercher par nom, prénom ou téléphone" value={terme} onChange={(e) => setTerme(e.target.value)} style={{ marginBottom: '1rem' }} />
      <label className="case" style={{ marginBottom: '1rem' }}><input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)} />Afficher les clients archivés</label>
      {q.isLoading && <Chargement />}
      {q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !q.data.length && <Vide titre={terme ? 'Aucun client trouvé' : 'Aucun client pour le moment'} texte={terme ? 'Essayez une autre recherche.' : 'Ajoutez votre premier client pour pouvoir créer des commandes.'} />}
      <div className="grille">
        {q.data?.map((c: any) => (
          <Link key={c.id} to={`/app/clients/${c.id}`} className="carte cliquable">
            <b>{c.prenom} {c.nom}</b><div className="muted petit">{c.telephone_e164 ?? c.whatsapp_e164 ?? '—'}</div>
          </Link>
        ))}
      </div>
      <Modale ouverte={nouveau} titre="Nouveau client" onFermer={() => setNouveau(false)}>
        <ClientForm onFait={(c) => { setNouveau(false); nav(`/app/clients/${c.id}`); }} />
      </Modale>
    </>
  );
}
