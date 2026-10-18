PORTAL TIERS — FREE STATIC WEBSITE

FILES
- index.html: website structure and text
- style.css: dark premium responsive design
- script.js: sample leaderboard and gamemode filter

PREVIEW ON YOUR COMPUTER
1. Extract the ZIP file.
2. Open the portal_tiers folder.
3. Double-click index.html. It should open in your browser.
   Internet is only needed for the optional Google Fonts; the website itself is static.

CUSTOMIZE
- Edit player names, modes, tiers, and points in script.js inside the `players` array.
- Edit the Discord invite link in index.html (search for https://discord.com/).
- Edit site text and tier descriptions in index.html.
- Colors and layout are in style.css.

PUBLISH FREE WITH GITHUB PAGES
1. Create/sign in to a GitHub account.
2. Create a new PUBLIC repository named `portal-tiers` (or any name).
3. Upload index.html, style.css, and script.js to the repository root (not inside another folder).
4. Open repository Settings -> Pages.
5. Under Build and deployment, choose "Deploy from a branch".
6. Choose branch `main` and folder `/ (root)`, then Save.
7. Wait a few minutes. The Pages section will show your website URL.
   For a project repository named portal-tiers, the URL usually looks like:
   https://YOUR-USERNAME.github.io/portal-tiers/

IMPORTANT LIMITATIONS
- This is a front-end demo: leaderboard data is stored in script.js.
- It does not yet have accounts, admin login, live server data, database, or player submissions.
- Do not enter passwords or secret keys into these public files.
- Sample rankings are fictional and marked as demo data.
