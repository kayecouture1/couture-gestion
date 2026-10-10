-- =====================================================================
-- COUTURE GESTION — 0001 : schéma de base
-- Toutes les tables métier portent atelier_id. Les relations entre tables
-- métier utilisent des clés étrangères COMPOSITES (id, atelier_id) afin
-- que la base elle-même interdise tout lien entre deux ateliers.
-- =====================================================================
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------- Ateliers, comptes, appartenance ----------
create table public.ateliers (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null check (char_length(nom) between 2 and 120),
  code_atelier    text not null unique check (code_atelier ~ '^[a-z0-9]{4,12}$'),
  logo_path       text,
  telephone       text,
  adresse         text,
  visible_public  boolean not null default false,
  statut          text not null default 'actif' check (statut in ('actif','desactive')),
  est_demo        boolean not null default false,
  capacite_jour   int  not null default 5 check (capacite_jour between 1 and 500),
  delai_min_jours int  not null default 3 check (delai_min_jours between 0 and 120),
  jours_travail   int[] not null default '{1,2,3,4,5,6}',
  created_at      timestamptz not null default now()
);

create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profils (
  id               uuid primary key references auth.users(id) on delete cascade,
  nom              text not null check (char_length(nom) between 1 and 80),
  prenom           text not null check (char_length(prenom) between 1 and 80),
  telephone        text,
  email            text,
  photo_path       text,
  doit_changer_mdp boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.membres_atelier (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  atelier_id       uuid not null references public.ateliers(id),
  est_proprietaire boolean not null default false,
  identifiant_interne text,
  statut           text not null default 'actif' check (statut in ('actif','desactive')),
  desactive_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, atelier_id),
  unique (atelier_id, identifiant_interne)
);
create unique index un_proprietaire_par_atelier on public.membres_atelier(atelier_id) where est_proprietaire;
create index on public.membres_atelier(atelier_id);

-- ---------- Rôles de production, profils d'accès, permissions ----------
create table public.roles_production (
  id          uuid primary key default gen_random_uuid(),
  atelier_id  uuid not null references public.ateliers(id),
  nom         text not null check (char_length(nom) between 2 and 60),
  description text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (atelier_id, nom),
  unique (id, atelier_id)
);

create table public.membre_roles_production (
  user_id    uuid not null,
  role_id    uuid not null,
  atelier_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id),
  foreign key (user_id, atelier_id) references public.membres_atelier(user_id, atelier_id) on delete cascade,
  foreign key (role_id, atelier_id) references public.roles_production(id, atelier_id)
);

create table public.permissions (
  code    text primary key,
  libelle text not null,
  groupe  text not null
);

create table public.profils_acces (
  id          uuid primary key default gen_random_uuid(),
  atelier_id  uuid not null references public.ateliers(id),
  nom         text not null check (char_length(nom) between 2 and 60),
  description text,
  created_at  timestamptz not null default now(),
  unique (atelier_id, nom),
  unique (id, atelier_id)
);

create table public.profil_acces_permissions (
  profil_acces_id uuid not null,
  atelier_id      uuid not null,
  permission_code text not null references public.permissions(code),
  primary key (profil_acces_id, permission_code),
  foreign key (profil_acces_id, atelier_id) references public.profils_acces(id, atelier_id) on delete cascade
);

create table public.membre_profils_acces (
  user_id         uuid not null,
  profil_acces_id uuid not null,
  atelier_id      uuid not null,
  primary key (user_id, profil_acces_id),
  foreign key (user_id, atelier_id) references public.membres_atelier(user_id, atelier_id) on delete cascade,
  foreign key (profil_acces_id, atelier_id) references public.profils_acces(id, atelier_id) on delete cascade
);

-- ---------- Abonnements (accès uniquement par le serveur) ----------
create table public.abonnements (
  id          uuid primary key default gen_random_uuid(),
  atelier_id  uuid not null references public.ateliers(id),
  duree_jours int not null check (duree_jours between 1 and 3660),
  statut      text not null default 'en_attente' check (statut in ('en_attente','actif','desactive')),
  debut_at    timestamptz,
  fin_at      timestamptz,
  note        text,
  cree_par    uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  check ((debut_at is null) = (fin_at is null)),
  check (fin_at is null or fin_at > debut_at)
);
create index on public.abonnements(atelier_id, statut);

create table public.codes_abonnement (
  id             uuid primary key default gen_random_uuid(),
  atelier_id     uuid not null references public.ateliers(id),
  abonnement_id  uuid not null references public.abonnements(id) on delete cascade,
  code_hash      text not null unique,
  apercu         text,
  valide_jusqu_a timestamptz not null,
  statut         text not null default 'non_utilise' check (statut in ('non_utilise','utilise','desactive','remplace')),
  utilise_at     timestamptz,
  utilise_par    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);
create index on public.codes_abonnement(abonnement_id);

create table public.abonnements_historique (
  id            bigint generated always as identity primary key,
  atelier_id    uuid not null references public.ateliers(id),
  abonnement_id uuid,
  action        text not null,
  acteur_id     uuid,
  details       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index on public.abonnements_historique(atelier_id, created_at desc);

create table public.tentatives_code (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  atelier_id uuid,
  ip         text,
  reussi     boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.tentatives_code(user_id, created_at desc);
create index on public.tentatives_code(ip, created_at desc);

-- ---------- Clients et mesures ----------
create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  atelier_id     uuid not null references public.ateliers(id),
  nom            text not null check (char_length(nom) between 1 and 80),
  prenom         text not null check (char_length(prenom) between 1 and 80),
  telephone_e164 text check (telephone_e164 is null or telephone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_e164  text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  notes          text,
  archived_at    timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (id, atelier_id)
);
create index on public.clients(atelier_id, telephone_e164);
create index on public.clients(atelier_id, lower(nom), lower(prenom));

create table public.mesure_champs (
  id         uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  categorie  text not null check (categorie in ('homme','femme','garcon','jeune_fille')),
  libelle    text not null check (char_length(libelle) between 1 and 60),
  unite      text not null default 'cm',
  ordre      int not null default 0,
  actif      boolean not null default true,
  unique (atelier_id, categorie, libelle),
  unique (id, atelier_id)
);

create table public.client_mesures (
  client_id  uuid not null,
  champ_id   uuid not null,
  atelier_id uuid not null,
  valeur     numeric(8,2) not null check (valeur >= 0),
  updated_at timestamptz not null default now(),
  primary key (client_id, champ_id),
  foreign key (client_id, atelier_id) references public.clients(id, atelier_id),
  foreign key (champ_id, atelier_id) references public.mesure_champs(id, atelier_id)
);

-- ---------- Catalogue et circuits ----------
create table public.types_vetements (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  nom text not null check (char_length(nom) between 1 and 60),
  actif boolean not null default true,
  unique (atelier_id, nom), unique (id, atelier_id)
);

create table public.modeles (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  nom text not null check (char_length(nom) between 1 and 80),
  type_vetement_id uuid,
  photo_path text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, atelier_id),
  foreign key (type_vetement_id, atelier_id) references public.types_vetements(id, atelier_id)
);

create table public.emplacements (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  nom text not null check (char_length(nom) between 1 and 60),
  actif boolean not null default true,
  unique (atelier_id, nom), unique (id, atelier_id)
);

create table public.modeles_circuits (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  nom text not null check (char_length(nom) between 2 and 80),
  actif boolean not null default true,
  unique (atelier_id, nom), unique (id, atelier_id)
);

create table public.modeles_circuits_etapes (
  id uuid primary key default gen_random_uuid(),
  modele_circuit_id uuid not null,
  atelier_id uuid not null,
  ordre int not null check (ordre > 0),
  nom text not null check (char_length(nom) between 1 and 60),
  mode text not null check (mode in ('personne','role')),
  role_id uuid,
  user_id uuid,
  check ((mode = 'role' and role_id is not null and user_id is null)
      or (mode = 'personne' and user_id is not null and role_id is null)),
  unique (modele_circuit_id, ordre),
  foreign key (modele_circuit_id, atelier_id) references public.modeles_circuits(id, atelier_id) on delete cascade,
  foreign key (role_id, atelier_id) references public.roles_production(id, atelier_id),
  foreign key (user_id, atelier_id) references public.membres_atelier(user_id, atelier_id)
);

-- ---------- Commandes, habits, étapes ----------
create table public.commandes (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  code text not null,
  client_id uuid not null,
  date_rdv date,
  total_fcfa bigint not null check (total_fcfa >= 0),
  statut text not null default 'en_cours' check (statut in ('en_cours','terminee','annulee')),
  note text,
  motif_annulation text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (atelier_id, code), unique (id, atelier_id),
  foreign key (client_id, atelier_id) references public.clients(id, atelier_id)
);
create index on public.commandes(atelier_id, statut, date_rdv);
create index on public.commandes(atelier_id, client_id);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  commande_id uuid not null,
  code text not null,
  type_vetement_id uuid,
  type_libelle text not null,
  modele_id uuid,
  modele_libelle text,
  photo_habit_path text,
  photo_modele_path text,
  mesures_utilisees jsonb not null default '[]',
  statut text not null default 'en_attente'
    check (statut in ('en_attente','en_cours','a_valider','termine','annule')),
  emplacement_id uuid,
  valide_par uuid references auth.users(id),
  valide_at timestamptz,
  created_at timestamptz not null default now(),
  unique (atelier_id, code), unique (id, atelier_id),
  foreign key (commande_id, atelier_id) references public.commandes(id, atelier_id),
  foreign key (type_vetement_id, atelier_id) references public.types_vetements(id, atelier_id),
  foreign key (modele_id, atelier_id) references public.modeles(id, atelier_id),
  foreign key (emplacement_id, atelier_id) references public.emplacements(id, atelier_id)
);
create index on public.habits(atelier_id, statut);
create index on public.habits(commande_id);

create table public.habit_etapes (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null,
  habit_id uuid not null,
  ordre int not null check (ordre > 0),
  nom text not null,
  mode text not null check (mode in ('personne','role')),
  role_id uuid,
  user_id uuid,
  statut text not null default 'en_attente'
    check (statut in ('en_attente','disponible','en_cours','terminee')),
  pris_par uuid references auth.users(id),
  role_utilise_id uuid,
  pris_a timestamptz,
  termine_a timestamptz,
  duree_secondes int check (duree_secondes is null or duree_secondes >= 0),
  check ((mode = 'role' and role_id is not null and user_id is null)
      or (mode = 'personne' and user_id is not null and role_id is null)),
  unique (habit_id, ordre),
  foreign key (habit_id, atelier_id) references public.habits(id, atelier_id),
  foreign key (role_id, atelier_id) references public.roles_production(id, atelier_id),
  foreign key (user_id, atelier_id) references public.membres_atelier(user_id, atelier_id),
  foreign key (role_utilise_id, atelier_id) references public.roles_production(id, atelier_id)
);
create index on public.habit_etapes(atelier_id, statut);
create index on public.habit_etapes(pris_par);

-- ---------- Argent, planning, divers ----------
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null,
  commande_id uuid not null,
  montant_fcfa bigint not null check (montant_fcfa > 0),
  mode text not null default 'especes' check (mode in ('especes','mobile_money','virement','autre')),
  note text,
  paye_le timestamptz not null default now(),
  enregistre_par uuid references auth.users(id),
  annule_at timestamptz,
  motif_annulation text,
  created_at timestamptz not null default now(),
  foreign key (commande_id, atelier_id) references public.commandes(id, atelier_id)
);
create index on public.paiements(atelier_id, paye_le);
create index on public.paiements(commande_id);

create table public.factures (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null,
  commande_id uuid not null,
  numero text not null,
  total_fcfa bigint not null,
  avance_fcfa bigint not null,
  reste_fcfa bigint not null,
  pdf_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (atelier_id, numero),
  foreign key (commande_id, atelier_id) references public.commandes(id, atelier_id)
);

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null references public.ateliers(id),
  titre text not null check (char_length(titre) between 1 and 120),
  libelle text,
  montant_fcfa bigint not null check (montant_fcfa > 0),
  date_depense date not null default ((now() at time zone 'Africa/Bamako')::date),
  created_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.depenses(atelier_id, date_depense);

create table public.propositions_rdv (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null,
  commande_id uuid not null,
  date_proposee date not null,
  statut text not null check (statut in ('proposee','acceptee','modifiee','refusee')),
  motif text,
  decide_par uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (commande_id, atelier_id) references public.commandes(id, atelier_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null,
  habit_id uuid not null,
  canal text not null check (canal in ('appel','whatsapp')),
  message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (habit_id, atelier_id) references public.habits(id, atelier_id)
);

create table public.compteurs (
  atelier_id uuid not null references public.ateliers(id),
  cle text not null,
  valeur bigint not null default 0,
  primary key (atelier_id, cle)
);

create table public.journal_audit (
  id bigint generated always as identity primary key,
  atelier_id uuid,
  acteur_id uuid,
  action text not null,
  ressource text,
  ressource_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.journal_audit(atelier_id, created_at desc);
