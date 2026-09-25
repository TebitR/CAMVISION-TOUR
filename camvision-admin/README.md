# Camvision Tour — Admin (Next.js)

Back-office Next.js 15 + Tailwind + composants type shadcn/ui.

## Démarrage

1. Backend FastAPI sur `http://localhost:8000` (Docker Compose).
2. Dans ce dossier :

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

Identifiants par défaut (`.env` racine) :
- Email : `admin@camvision.cm`
- Mot de passe : `motdepasseadmin`

## Routes

| URL | Rôle |
|-----|------|
| `/admin/login` | Connexion JWT |
| `/admin` | Dashboard stats |
| `/admin/categories` | CRUD catégories |
| `/admin/monuments` | Liste / filtres |
| `/admin/monuments/new` | Création |
| `/admin/monuments/[id]/edit` | Édition |
