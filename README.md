# גדוד 9220 — לוח אירועים מבצעי

Interactive Hebrew military planning calendar — static site, works on GitHub Pages.

## Structure

```
gantt-site/
├── index.html        # Main page
├── style.css         # Dark military theme, RTL, mobile-friendly
├── script.js         # Logic: render, filter, ICS export
└── data/
    └── events.json   # Event data (source of truth for the site)
```

## How to update events

### Option A — Edit events.json directly

Open `data/events.json` in any text editor. Each event looks like:

```json
{
  "id": 1,
  "name": "שם האירוע",
  "category": "גדודי",
  "start": "2026-05-04",
  "end": "2026-05-04",
  "notes": "הערות אופציונליות"
}
```

- `start` and `end` are ISO dates (`YYYY-MM-DD`)
- For a single-day event: `start === end`
- For a multi-day event: `end > start`
- `notes` can be empty (`""`) or contain any text
- `category` must match one of the names in the `categories` array

### Option B — Regenerate from Excel

1. Make sure Python 3 is installed with `openpyxl`: `pip install openpyxl`
2. Place the updated `גאנט.xlsx` in the parent folder
3. Run the parse script from the parent folder:

```bash
python3 parse_gantt.py
```

This overwrites `gantt-site/data/events.json`.

## Categories and colors

| Category   | Color   | Meaning            |
|------------|---------|---------------------|
| גדודי      | Green   | Battalion-level     |
| פלוגתי    | Amber   | Company-level       |
| חטיבתי    | Orange  | Brigade-level       |
| נוספים    | Teal    | Additional events   |
| קיפול     | Red     | Folding/withdrawal  |
| ג״מ       | Purple  | Continuous/weekly   |

To add a new category, add it to the `categories` array in `events.json`:

```json
{ "name": "שם קטגוריה", "color": "#HEX" }
```

## Deploy to GitHub Pages

1. Push the `gantt-site/` folder contents to a GitHub repo
2. In repo Settings → Pages → Source, choose `main` branch, `/ (root)`
3. The site will be live at `https://<username>.github.io/<repo>/`

## Local preview

Open `index.html` via a local server (required for `fetch()`):

```bash
# Python
python3 -m http.server 8080 --directory gantt-site

# Node
npx serve gantt-site
```

Then open `http://localhost:8080`.
