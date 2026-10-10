import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { blobEnBase64, compresserImage } from '../../lib/images';
import { normaliserTelephone } from '../../lib/format';
import { emailValide, verifierMotDePasse } from '../../lib/validation';
import { Alerte, Btn, Champ } from '../../components/ui';

export default function Inscription() {
  const nav = useNavigate();
  const [f, setF] = useState({ nom_atelier: '', nom: '', prenom: '', telephone: '', email: '', password: '', confirmation: '' });
  const [logo, setLogo] = useState<{ blob: Blob; apercu: string } | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const maj = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function choisirLogo(fichier?: File | null) {
    setErreurs((x) => ({ ...x, logo: '' }));
    if (!fichier) return setLogo(null);
    if (!/^image\/(png|jpeg)$/.test(fichier.type)) return setErreurs((x) => ({ ...x, logo: 'Format incorrect : PNG ou JPEG uniquement.' }));
    if (fichier.size > 5 * 1024 * 1024) return setErreurs((x) => ({ ...x, logo: 'Logo trop volumineux (5 Mo maximum).' }));
    try {
      const blob = await compresserImage(fichier, 512, 0.85);
      setLogo({ blob, apercu: URL.createObjectURL(blob) });
    } catch (e) { setErreurs((x) => ({ ...x, logo: (e as Error).message })); }
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.nom_atelier.trim().length < 2) er.nom_atelier = "Saisissez le nom de l'atelier.";
    if (!f.nom.trim()) er.nom = 'Nom requis.';
    if (!f.prenom.trim()) er.prenom = 'Prénom requis.';
    if (!normaliserTelephone(f.telephone)) er.telephone = 'Numéro invalide (ex. 76 12 34 56 ou +223 76 12 34 56).';
    if (!emailValide(f.email)) er.email = 'Email invalide.';
    const mp = verifierMotDePasse(f.password); if (mp) er.password = mp;
    if (f.password !== f.confirmation) er.confirmation = 'Les mots de passe ne correspondent pas.';
    setErreurs(er); setErreurGlobale(null);
    if (Object.keys(er).length) return;

    setChargement(true);
    try {
      await api('/api/ateliers/inscription', {
        auth: false,
        body: {
          nom_atelier: f.nom_atelier.trim(), nom: f.nom.trim(), prenom: f.prenom.trim(),
          telephone: f.telephone.trim(), email: f.email.trim().toLowerCase(), password: f.password,
          logo: logo ? { mime: 'image/jpeg', base64: await blobEnBase64(logo.blob) } : undefined,
        },
      });
      nav(`/verification?email=${encodeURIComponent(f.email.trim().toLowerCase())}`);
    } catch (err) {
      setErreurGlobale(msgErreur(err));
    } finally { setChargement(false); }
  }

  return (
    <div className="public">
      <div className="public-haut"><Link to="/" className="btn sec petit">← Accueil</Link></div>
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>Créer un atelier</h1>
        <form onSubmit={soumettre} noValidate>
          {erreurGlobale && <Alerte ton="err">{erreurGlobale}</Alerte>}
          <h3 style={{ margin: '.2rem 0 .7rem' }}>L'atelier</h3>
          <Champ label="Nom de l'atelier" erreur={erreurs.nom_atelier}><input className="input" value={f.nom_atelier} onChange={maj('nom_atelier')} /></Champ>
          <Champ label="Logo (facultatif)" erreur={erreurs.logo} aide="PNG ou JPEG. Il apparaîtra sur vos factures.">
            <input className="input" type="file" accept="image/png,image/jpeg" onChange={(e) => choisirLogo(e.target.files?.[0])} />
          </Champ>
          {logo && <img src={logo.apercu} alt="Aperçu du logo" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, marginBottom: '.9rem' }} />}
          <h3 style={{ margin: '1rem 0 .7rem' }}>Le propriétaire</h3>
          <div className="grille2">
            <Champ label="Nom" erreur={erreurs.nom}><input className="input" autoComplete="family-name" value={f.nom} onChange={maj('nom')} /></Champ>
            <Champ label="Prénom" erreur={erreurs.prenom}><input className="input" autoComplete="given-name" value={f.prenom} onChange={maj('prenom')} /></Champ>
          </div>
          <Champ label="Téléphone" erreur={erreurs.telephone}><input className="input" type="tel" autoComplete="tel" value={f.telephone} onChange={maj('telephone')} /></Champ>
          <Champ label="Email" erreur={erreurs.email}><input className="input" type="email" autoComplete="email" value={f.email} onChange={maj('email')} /></Champ>
          <Champ label="Mot de passe" erreur={erreurs.password} aide="8 caractères minimum, avec une lettre et un chiffre.">
            <input className="input" type="password" autoComplete="new-password" value={f.password} onChange={maj('password')} /></Champ>
          <Champ label="Confirmer le mot de passe" erreur={erreurs.confirmation}>
            <input className="input" type="password" autoComplete="new-password" value={f.confirmation} onChange={maj('confirmation')} /></Champ>
          <Btn type="submit" bloc chargement={chargement}>{chargement ? 'Création de votre atelier…' : 'Créer mon atelier'}</Btn>
        </form>
      </div>
    </div>
  );
}
