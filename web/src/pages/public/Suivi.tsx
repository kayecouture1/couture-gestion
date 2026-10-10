import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Badge, Btn, Champ, Vide } from '../../components/ui';
import { Fil, progression } from '../../components/Fil';
import { LIBELLES_STATUT } from '../../lib/format';

type Mode = 'code' | 'telephone' | 'nom';

export default function Suivi() {
  const { id } = useParams();
  const [mode, setMode] = useState<Mode>('code');
  const [v, setV] = useState({ code: '', telephone: '', nom: '', prenom: '' });
  const [res, setRes] = useState<{ atelier?: string; resultats: any[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attente, setAttente] = useState(false);

  async function chercher(e: FormEvent) {
    e.preventDefault(); setErreur(null); setRes(null);
    const corps: any = { atelier_id: id };
    if (mode === 'code') { if (!v.code.trim()) return setErreur("Saisissez l'ID de l'habit (ex. HAB-000123)."); corps.code = v.code; }
    if (mode === 'telephone') { if (!v.telephone.trim()) return setErreur('Saisissez votre numéro de téléphone.'); corps.telephone = v.telephone; }
    if (mode === 'nom') { if (!v.nom.trim() || !v.prenom.trim()) return setErreur('Saisissez votre nom ET votre prénom.'); corps.nom = v.nom; corps.prenom = v.prenom; }
    setAttente(true);
    try { setRes(await api('/api/public/suivi', { auth: false, body: corps })); }
    catch (err) { setErreur(msgErreur(err)); }
    finally { setAttente(false); }
  }
  const set = (k: keyof typeof v) => (e: any) => setV({ ...v, [k]: e.target.value });

  return (
    <div className="public">
      <div className="public-haut"><Link to="/ateliers" className="btn sec petit">← Ateliers</Link></div>
      <div className="public-corps large">
        <h1 style={{ marginBottom: '1rem' }}>Suivre mon habit</h1>
        <div className="onglets">
          <button type="button" className={mode === 'code' ? 'on' : ''} onClick={() => setMode('code')}>Par ID</button>
          <button type="button" className={mode === 'telephone' ? 'on' : ''} onClick={() => setMode('telephone')}>Par téléphone</button>
          <button type="button" className={mode === 'nom' ? 'on' : ''} onClick={() => setMode('nom')}>Par nom</button>
        </div>
        <form onSubmit={chercher} noValidate>
          {erreur && <Alerte ton="err">{erreur}</Alerte>}
          {mode === 'code' && <Champ label="ID de l'habit" aide="Il figure sur votre reçu, par exemple HAB-000123."><input className="input" value={v.code} onChange={set('code')} autoCapitalize="characters" /></Champ>}
          {mode === 'telephone' && <Champ label="Téléphone" aide="Le numéro donné à l'atelier lors de la commande."><input className="input" type="tel" value={v.telephone} onChange={set('telephone')} /></Champ>}
          {mode === 'nom' && <div className="grille2"><Champ label="Nom"><input className="input" value={v.nom} onChange={set('nom')} /></Champ><Champ label="Prénom"><input className="input" value={v.prenom} onChange={set('prenom')} /></Champ></div>}
          <Btn type="submit" bloc chargement={attente}>Rechercher</Btn>
        </form>

        {res && !res.resultats.length && <div style={{ marginTop: '1rem' }}><Vide titre="Aucun résultat" texte="Vérifiez les informations saisies. Si le problème persiste, contactez directement l'atelier." /></div>}
        <div className="pile" style={{ marginTop: '1rem' }}>
          {res?.resultats.map((h) => (
            <article key={h.code} className="carte point">
              <div className="ligne"><h3>{h.type}</h3><Badge ton={h.statut === 'termine' ? 'ok' : 'ocre'}>{LIBELLES_STATUT[h.statut] ?? h.statut}</Badge><span className="espace" /><b>{h.code}</b></div>
              <p className="muted petit">{h.client && <>Client : {h.client} · </>}{h.modele && <>Modèle : {h.modele}</>}</p>
              <div className="grille2" style={{ gap: '.6rem' }}>
                {h.photo_habit && <img className="photo" src={h.photo_habit} alt="Photo de l'habit" />}
                {h.photo_modele && <img className="photo" src={h.photo_modele} alt="Photo du modèle" />}
              </div>
              <div className="barre" style={{ margin: '.8rem 0 .2rem' }}><span style={{ width: `${progression(h.circuit)}%` }} /></div>
              <p className="petit">{h.statut === 'termine' ? 'Votre habit est prêt : vous pouvez venir le récupérer.' : h.etape_actuelle ? <>Étape actuelle : <b>{h.etape_actuelle}</b></> : "En attente de démarrage."}</p>
              <Fil etapes={h.circuit} />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
