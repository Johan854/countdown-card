# Countdown Card (FR)

Carte Home Assistant de **compte à rebours** (jours, heures, minutes, secondes) pour **Noël** (sapin illuminé, guirlande, neige animée) ou les **anniversaires** (gâteau, ballons, fanions, confettis), avec **photo perso**. Elle se cache hors saison. Style verre, thème clair/sombre automatique, éditeur visuel, textes en français. Le calcul se fait à partir de l'horloge : aucun capteur nécessaire.

## Installation (HACS)
1. HACS → ⋮ → *Dépôts personnalisés* → `https://github.com/Johan854/countdown-card`, catégorie **Tableau de bord**.
2. Installer, puis recharger le navigateur.

## Exemples
```yaml
# Noël (visible dans les 90 derniers jours)
type: custom:countdown-card
style: christmas
message: Ho Ho Ho !
image: /local/noel.jpg        # facultatif (dossier /config/www/)

# Anniversaire (visible la veille et le jour J)
type: custom:countdown-card
style: birthday
name: Logan
date: "03-14"                 # MM-JJ chaque année (ou AAAA-MM-JJ)
birth_year: 2014              # facultatif : affiche l'âge le jour J
image: /local/logan.jpg       # facultatif
```

| Option | Description |
|---|---|
| `style` | `christmas` (par défaut) ou `birthday` |
| `date` | `MM-JJ` (chaque année) ou `AAAA-MM-JJ` ; 25 décembre par défaut pour Noël |
| `name` / `birth_year` | Prénom et année de naissance (anniversaire) |
| `lead` / `message` / `title` | Textes personnalisables |
| `show_from_days` | Visible dans les N derniers jours : 90 pour Noël, 1 pour un anniversaire par défaut, 0 = toujours |
| `image` | Photo perso |
| `image_mode` | `background` (en fond, Noël par défaut) ou `replace` (cadre à la place de l'illustration, anniversaire par défaut) |
| `image_opacity` | Opacité de la photo de fond |
| `show_seconds`, `show_tree`, `snow` | Secondes, illustration (sapin / gâteau), animation (neige / confettis) |

Le jour J, la carte affiche « Joyeux Noël ! » ou « Joyeux anniversaire … ! », puis se cache le lendemain.
