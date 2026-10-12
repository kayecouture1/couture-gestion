import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { aujourdhui, dateFr, normaliserTelephone } from '../../lib/format';
import { compresserImage } from '../../lib/images';
import { useEmplacements, useTypesVetements } from '../../lib/hooks';
import { Alerte, Badge, Btn, Champ, EnTete, Modale, useAction, useRetours } from '../../components/ui';
import { urlLogo } from '../../components/Photo';
import { useQuery } from '@tanstack/react-query';

const JOURS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [7, 'Dim']] as const;
type MesureChamp = { id: string; categorie: string; libelle: string; unite: string; ordre: number; actif: boolean };
type ElementCatalogue = { id: string; nom: string; actif: boolean };
const CATEGORIES_MESURES: Record<string, string> = { homme: 'Homme', femme: 'Femme', garcon: 'Garçon', jeune_fille: 'Jeune fille' };

function BoutonMesure({ champ, onClick, onLongPress }: { champ: MesureChamp; onClick: () => void; onLongPress: () => void }) {
  const timer = useRef<number>();
  const appuiLong = useRef(false);
  const annuler = () => { if (timer.current !== undefined) window.clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => annuler, []);
  return <Btn petit variante="sec" className="bouton-mesure"
    style={champ.actif ? undefined : { opacity: .5 }}
    onPointerDown={(e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      appuiLong.current = false;
      timer.current = window.setTimeout(() => { appuiLong.current = true; onLongPress(); }, 1500);
    }}
    onPointerUp={(e) => { annuler(); e.currentTarget.releasePointerCapture?.(e.pointerId); }}
    onPointerLeave={(e) => { if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) annuler(); }}
    onPointerCancel={annuler} onContextMenu={(e) => e.preventDefault()} onSelect={(e) => e.preventDefault()}
    onClick={() => { if (appuiLong.current) { appuiLong.current = false; return; } onClick(); }}
    aria-label={`${champ.libelle}. Appui long pour les options`}>{champ.libelle}{champ.actif ? '' : ' (désactivé)'}</Btn>;
}

function BoutonCatalogue({ element, onClick, onLongPress }: { element: ElementCatalogue; onClick: () => void; onLongPress: () => void }) {
  const timer = useRef<number>();
  const appuiLong = useRef(false);
  const annuler = () => { if (timer.current !== undefined) window.clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => annuler, []);
  return <Btn petit variante={element.actif ? undefined : 'sec'} className="bouton-mesure"
    style={element.actif ? undefined : { opacity: .5 }}
    onPointerDown={(e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      appuiLong.current = false;
      timer.current = window.setTimeout(() => { appuiLong.current = true; onLongPress(); }, 1500);
    }}
    onPointerUp={(e) => { annuler(); e.currentTarget.releasePointerCapture?.(e.pointerId); }}
    onPointerLeave={(e) => { if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) annuler(); }}
    onPointerCancel={annuler} onContextMenu={(e) => e.preventDefault()} onSelect={(e) => e.preventDefault()}
    onClick={() => { if (appuiLong.current) { appuiLong.current = false; return; } onClick(); }}
    aria-label={`${element.nom}. Appui long pour les options`}>{element.nom}{element.actif ? '' : ' (désactivé)'}</Btn>;
}

export default function Parametres() {
  const { ctx, rafraichir } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const { confirmer } = useRetours();
  const a = ctx!.atelier!;
  const [f, setF] = useState({ nom: a.nom, telephone: '', adresse: '', visible: a.visible_public, cap: String(a.capacite_jour), delai: String(a.delai_min_jours), jours: a.jours_travail });
  const [logoMsg, setLogoMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [nvEmp, setNvEmp] = useState(''); const [nvType, setNvType] = useState('');
  const emplacements = useEmplacements(); const types = useTypesVetements();
  const champs = useQuery({ queryKey: ['champs-tous'], queryFn: async () => { const { data, error } = await supabase.from('mesure_champs').select('*').order('categorie').order('ordre'); if (error) throw error; return data as MesureChamp[]; } });
  const [nvChamp, setNvChamp] = useState({ categorie: 'homme', libelle: '' });
  const [champOptions, setChampOptions] = useState<MesureChamp | null>(null);
  const [champEdition, setChampEdition] = useState<MesureChamp | null>(null);
  const [catalogueOptions, setCatalogueOptions] = useState<{ table: 'emplacements' | 'types_vetements'; titre: string; element: ElementCatalogue } | null>(null);
  const [catalogueEdition, setCatalogueEdition] = useState<{ table: 'emplacements' | 'types_vetements'; titre: string; element: ElementCatalogue } | null>(null);
  const detail = useQuery({ queryKey: ['atelier-detail'], queryFn: async () => { const { data } = await supabase.from('ateliers').select('telephone, adresse').eq('id', a.id).single(); if (data) setF((x) => ({ ...x, telephone: data.telephone ?? '', adresse: data.adresse ?? '' })); return data; } });
  void detail;
  const fin = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  const enregistrer = () => lancer(async () => {
    const tel = f.telephone.trim() ? normaliserTelephone(f.telephone) : null;
    if (f.telephone.trim() && !tel) throw new Error('Numéro de téléphone invalide.');
    const cap = Number(f.cap), delai = Number(f.delai);
    if (f.nom.trim().length < 2) throw new Error("Nom de l'atelier trop court.");
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) throw new Error('Capacité : entre 1 et 500 habits par jour.');
    if (!Number.isInteger(delai) || delai < 0 || delai > 120) throw new Error('Délai minimum : entre 0 et 120 jours.');
    if (!f.jours.length) throw new Error('Choisissez au moins un jour de travail.');
    const { error } = await supabase.from('ateliers').update({ nom: f.nom.trim(), telephone: tel, adresse: f.adresse.trim() || null, visible_public: f.visible, capacite_jour: cap, delai_min_jours: delai, jours_travail: f.jours }).eq('id', a.id);
    if (error) throw error; await rafraichir();
  }, 'Paramètres enregistrés.', (e) => { const m = (e as any)?.message ?? ''; return /invalide|trop court|entre|Choisissez/.test(m) ? m : msgErreur(e); });

  async function remplacerLogo(fichier?: File | null) {
    setLogoMsg(null); if (!fichier) return;
    if (!/^image\/(png|jpeg)$/.test(fichier.type)) return setLogoMsg({ ok: false, t: 'Format incorrect : PNG ou JPEG uniquement.' });
    try {
      const blob = await compresserImage(fichier, 512, 0.85);
      const chemin = `${a.id}/logo-${Date.now()}.jpg`;
      const up = await supabase.storage.from('logos').upload(chemin, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
      const { error } = await supabase.from('ateliers').update({ logo_path: chemin }).eq('id', a.id); if (error) throw error;
      if (a.logo_path) await supabase.storage.from('logos').remove([a.logo_path]);
      await rafraichir(); setLogoMsg({ ok: true, t: 'Logo enregistré avec succès.' });
    } catch { setLogoMsg({ ok: false, t: 'Impossible d’enregistrer le logo. Veuillez réessayer.' }); }
  }

  const ajouter = (table: string, ligne: object, k: string, reset: () => void, msg: string) => lancer(async () => { const { error } = await supabase.from(table).insert({ ...ligne, atelier_id: a.id }); if (error) throw error; reset(); fin(k); }, msg, msgErreur);
  const basculer = (table: string, id: string, actif: boolean, k: string) => lancer(async () => { const { error } = await supabase.from(table).update({ actif }).eq('id', id); if (error) throw error; fin(k); }, undefined, msgErreur);
  const supprimerChamp = async () => {
    if (!champOptions || !(await confirmer(`Supprimer définitivement la mesure « ${champOptions.libelle } » ?`, { libelle: 'Supprimer', danger: true }))) return;
    const id = champOptions.id;
    setChampOptions(null);
    await lancer(async () => {
      const { error } = await supabase.rpc('supprimer_catalogue', { p_table: 'mesure_champs', p_id: id });
      if (error) throw error;
      fin('champs-tous');
    }, 'Mesure supprimée.', msgErreur);
  };
  const supprimerCatalogue = async () => {
    if (!catalogueOptions || !(await confirmer(`Supprimer définitivement « ${catalogueOptions.element.nom} » ?`, { libelle: 'Supprimer', danger: true }))) return;
    const { table, element } = catalogueOptions;
    setCatalogueOptions(null);
    await lancer(async () => {
      const { error } = await supabase.rpc('supprimer_catalogue', { p_table: table, p_id: element.id });
      if (error) throw error;
      fin(table);
    }, `${catalogueOptions.titre} supprimé.`, msgErreur);
  };
  const logo = urlLogo(a.logo_path);

  return (
    <>
      <EnTete titre="Paramètres" />
      <section className="carte"><h2 style={{ marginBottom: '.7rem' }}>Atelier</h2>
        <p className="petit">Code atelier (pour la connexion des employés) : <Badge ton="ocre">{a.code}</Badge></p>
        <div className="ligne" style={{ marginBottom: '.9rem' }}>{logo ? <img className="vignette" src={logo} alt="Logo" /> : <span className="vignette photo-vide">Logo</span>}
          <div><input type="file" accept="image/png,image/jpeg" onChange={(e) => remplacerLogo(e.target.files?.[0])} aria-label="Remplacer le logo" /></div></div>
        {logoMsg && <Alerte ton={logoMsg.ok ? 'ok' : 'err'}>{logoMsg.t}</Alerte>}
        <div className="grille2"><Champ label="Nom de l'atelier"><input className="input" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ><Champ label="Téléphone"><input className="input" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></Champ></div>
        <Champ label="Adresse (apparaît sur les factures)"><input className="input" value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></Champ>
        <label className="case" style={{ marginBottom: '.9rem' }}><input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} />Afficher mon atelier dans la liste publique « Voir les ateliers »</label>
        <p className="muted petit">Par défaut, l'atelier est invisible. S'il est visible, vos clients peuvent suivre leur habit sans compte.</p>
        <h3 style={{ margin: '.8rem 0' }}>Capacité de production</h3>
        <div className="grille2"><Champ label="Habits par jour" aide="Sert à proposer des dates de rendez-vous."><input className="input" inputMode="numeric" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} /></Champ><Champ label="Délai minimum (jours)"><input className="input" inputMode="numeric" value={f.delai} onChange={(e) => setF({ ...f, delai: e.target.value })} /></Champ></div>
        <Champ label="Jours de travail"><div className="cases">{JOURS.map(([n, l]) => <label key={n} className={`case ${f.jours.includes(n) ? 'on' : ''}`}><input type="checkbox" checked={f.jours.includes(n)} onChange={() => setF({ ...f, jours: f.jours.includes(n) ? f.jours.filter((x) => x !== n) : [...f.jours, n].sort() })} />{l}</label>)}</div></Champ>
        <Btn chargement={enCours} onClick={enregistrer}>Enregistrer</Btn>
      </section>

      {peut(ctx, 'donnees.exporter') && <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Export des données</h2>
        <p className="muted petit">Télécharge toutes les données de l'atelier (clients, mesures, commandes, habits, paiements, factures, dépenses…) dans un fichier JSON, pour sauvegarde. Les photos et PDF restent dans le stockage. La restauration automatique n'est pas disponible.</p>
        <Btn variante="sec" chargement={enCours} onClick={() => lancer(async () => {
          const { data, error } = await supabase.rpc('exporter_atelier'); if (error) throw error;
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `export-${a.dataset.n ?? 'atelier'}-${aujourdhui()}.json`; a.click(); URL.revokeObjectURL(a.href);
          await supabase.rpc('journaliser_export');
        }, 'Export téléchargé.', msgErreur)}>Exporter les données (JSON)</Btn></section>}

      <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Abonnement</h2>
        <p style={{ margin: 0 }}>{ctx?.abonnement?.actif ? <>Actif jusqu'au <b>{dateFr(ctx.abonnement.fin_at ? new Date(new Date(ctx.abonnement.fin_at).getTime() - 1).toISOString() : null)}</b></> : 'Inactif'}</p></section>

      {peut(ctx, 'emplacements.gerer') && <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Emplacements</h2>
        <div className="cases">{emplacements.data?.map((e) => <BoutonCatalogue key={e.id} element={e} onClick={() => basculer('emplacements', e.id, !e.actif, 'emplacements')} onLongPress={() => setCatalogueOptions({ table: 'emplacements', titre: 'Emplacement', element: e })} />)}</div>
        <div className="ligne" style={{ marginTop: '.7rem' }}><input className="input" style={{ maxWidth: 240 }} placeholder="Ex. Étagère D" value={nvEmp} onChange={(e) => setNvEmp(e.target.value)} /><Btn variante="sec" onClick={() => nvEmp.trim() && ajouter('emplacements', { nom: nvEmp.trim() }, 'emplacements', () => setNvEmp(''), 'Emplacement ajouté.')}>Ajouter</Btn></div>
        <p className="muted petit">Clic court : activer ou désactiver. Appui long : modifier, activer/désactiver ou supprimer.</p></section>}

      <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Types de vêtements</h2>
        <div className="cases">{types.data?.map((t) => <BoutonCatalogue key={t.id} element={t} onClick={() => basculer('types_vetements', t.id, !t.actif, 'types-vetements')} onLongPress={() => setCatalogueOptions({ table: 'types_vetements', titre: 'Type de vêtement', element: t })} />)}</div>
        <div className="ligne" style={{ marginTop: '.7rem' }}><input className="input" style={{ maxWidth: 240 }} placeholder="Ex. Kaftan" value={nvType} onChange={(e) => setNvType(e.target.value)} /><Btn variante="sec" onClick={() => nvType.trim() && ajouter('types_vetements', { nom: nvType.trim() }, 'types-vetements', () => setNvType(''), 'Type ajouté.')}>Ajouter</Btn></div></section>

      <section className="carte" style={{ marginTop: '1rem' }}><h2 style={{ marginBottom: '.7rem' }}>Mesures disponibles</h2>
        <p className="muted petit">Ajoutez de nouvelles mesures sans toucher aux anciennes. Désactiver une mesure la masque sans effacer les valeurs déjà enregistrées.</p>
        <p className="muted petit">Clic court : activer ou désactiver. Appui long (environ 2 secondes) : modifier, désactiver ou supprimer.</p>
        {['homme', 'femme', 'garcon', 'jeune_fille'].map((cat) => <div key={cat} style={{ marginBottom: '.6rem' }}><b className="petit">{CATEGORIES_MESURES[cat]}</b>
          <div className="cases" style={{ marginTop: '.3rem' }}>{champs.data?.filter((c) => c.categorie === cat).map((c) => <BoutonMesure key={c.id} champ={c} onClick={() => basculer('mesure_champs', c.id, !c.actif, 'champs-tous')} onLongPress={() => setChampOptions(c)} />)}</div></div>)}
        <div className="ligne"><select className="input" style={{ maxWidth: 160 }} value={nvChamp.categorie} onChange={(e) => setNvChamp({ ...nvChamp, categorie: e.target.value })}><option value="homme">Homme</option><option value="femme">Femme</option><option value="garcon">Garçon</option><option value="jeune_fille">Jeune fille</option></select>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Nouvelle mesure" value={nvChamp.libelle} onChange={(e) => setNvChamp({ ...nvChamp, libelle: e.target.value })} />
          <Btn variante="sec" onClick={() => nvChamp.libelle.trim() && ajouter('mesure_champs', { categorie: nvChamp.categorie, libelle: nvChamp.libelle.trim(), ordre: 100 }, 'champs-tous', () => { setNvChamp({ ...nvChamp, libelle: '' }); fin('champs'); }, 'Mesure ajoutée.')}>Ajouter</Btn></div></section>
      <Modale ouverte={!!champOptions} titre={champOptions?.libelle ?? 'Options de mesure'} onFermer={() => setChampOptions(null)}>
        <div className="pile">
          <Btn bloc onClick={() => { setChampEdition(champOptions); setChampOptions(null); }}>Modifier</Btn>
          <Btn bloc variante="sec" onClick={() => { if (champOptions) basculer('mesure_champs', champOptions.id, !champOptions.actif, 'champs-tous'); setChampOptions(null); }}>{champOptions?.actif ? 'Désactiver' : 'Activer'}</Btn>
          <Btn bloc variante="danger" onClick={supprimerChamp}>Supprimer</Btn>
        </div>
      </Modale>
      <Modale ouverte={!!champEdition} titre="Modifier la mesure" onFermer={() => setChampEdition(null)}>
        {champEdition && <div className="pile">
          <Champ label="Nom de la mesure"><input className="input" value={champEdition.libelle} onChange={(e) => setChampEdition({ ...champEdition, libelle: e.target.value })} /></Champ>
          <Champ label="Catégorie"><select className="input" value={champEdition.categorie} onChange={(e) => setChampEdition({ ...champEdition, categorie: e.target.value })}>{Object.entries(CATEGORIES_MESURES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Champ>
          <div className="grille2"><Champ label="Unité"><input className="input" value={champEdition.unite} onChange={(e) => setChampEdition({ ...champEdition, unite: e.target.value })} /></Champ><Champ label="Ordre"><input className="input" type="number" min={0} value={champEdition.ordre} onChange={(e) => setChampEdition({ ...champEdition, ordre: Number(e.target.value) })} /></Champ></div>
          <Btn bloc chargement={enCours} onClick={() => lancer(async () => {
            const libelle = champEdition.libelle.trim(), unite = champEdition.unite.trim();
            if (!libelle || !unite || !Number.isInteger(champEdition.ordre) || champEdition.ordre < 0) throw new Error('Renseignez un nom, une unité et un ordre valide.');
            const { error } = await supabase.from('mesure_champs').update({ libelle, categorie: champEdition.categorie, unite, ordre: champEdition.ordre }).eq('id', champEdition.id);
            if (error) throw error;
            setChampEdition(null); fin('champs-tous');
          }, 'Mesure modifiée.', msgErreur)}>Enregistrer</Btn>
        </div>}
      </Modale>
      <Modale ouverte={!!catalogueOptions} titre={catalogueOptions?.element.nom ?? 'Options'} onFermer={() => setCatalogueOptions(null)}>
        <div className="pile">
          <Btn bloc onClick={() => { setCatalogueEdition(catalogueOptions); setCatalogueOptions(null); }}>Modifier</Btn>
          <Btn bloc variante="sec" onClick={() => { if (catalogueOptions) basculer(catalogueOptions.table, catalogueOptions.element.id, !catalogueOptions.element.actif, catalogueOptions.table); setCatalogueOptions(null); }}>{catalogueOptions?.element.actif ? 'Désactiver' : 'Activer'}</Btn>
          <Btn bloc variante="danger" onClick={supprimerCatalogue}>Supprimer</Btn>
        </div>
      </Modale>
      <Modale ouverte={!!catalogueEdition} titre={`Modifier ${catalogueEdition?.titre.toLowerCase() ?? ''}`} onFermer={() => setCatalogueEdition(null)}>
        {catalogueEdition && <div className="pile">
          <Champ label="Nom"><input className="input" value={catalogueEdition.element.nom} onChange={(e) => setCatalogueEdition({ ...catalogueEdition, element: { ...catalogueEdition.element, nom: e.target.value } })} /></Champ>
          <Btn bloc chargement={enCours} onClick={() => lancer(async () => {
            const nom = catalogueEdition.element.nom.trim();
            if (!nom) throw new Error('Le nom est obligatoire.');
            const { error } = await supabase.from(catalogueEdition.table).update({ nom }).eq('id', catalogueEdition.element.id);
            if (error) throw error;
            setCatalogueEdition(null); fin(catalogueEdition.table === 'types_vetements' ? 'types-vetements' : 'emplacements');
          }, 'Modification enregistrée.', msgErreur)}>Enregistrer</Btn>
        </div>}
      </Modale>
    </>
  );
}
