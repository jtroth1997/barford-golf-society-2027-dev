# Barford Golf Society 2027 Scores

Open via a local web server because the JavaScript uses ES modules.

Example:
```bash
python3 -m http.server 8080
```
Then visit `http://localhost:8080/scores.html`.

The current build stores development data only in browser localStorage.
The backend boundary is isolated in `assets/js/scores-data.js`.
