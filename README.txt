NORTH005 DAVAO ERP - FILES
Upload ALL of these to GitHub (replace the old ones): index.html, favicon.ico, manifest.webmanifest, app.js, modules.js, sales.js, ca.js, rentals.js, dash.js, attendance.js, docs.js, orgchart.js, thermal.js, and the assets folder.
Vercel redeploys automatically. Then hard-refresh the site (Ctrl+Shift+R) or clear site data on your phone.

FIRST-TIME SETUP FOR SALES & COLLECTION (Administrator)
1. MASTER REGISTRY > Upload Masterlist (Excel)
2. MASTER REGISTRY > Import Areas (Excel report): choose your current DDN or SAMAL report; sets each outlet's collector. Do it once for each file.
3. SALES & COLLECTION > Import Accounting File (Excel) every day.
HANDWRITTEN SHEET READER (Thermal Paper) - no setup needed, no API key, no charges
1. In THERMAL PAPER DAILY SUMMARY, drop / paste / choose a photo of the handwritten sheet.
2. The app reads it automatically on your own device. Nothing is sent to an AI service and no Anthropic
   key is needed. The only download is Tesseract.js's free English text model (about 3 MB, cached after first use).
3. Detected booth codes and roll quantities appear in editable rows: amber = uncertain reading,
   red = duplicate booth, orange = booth not found in the Master Registry.
4. Check every row against the photo, fix anything wrong, then press Save summary.
If a reading is hard to make out, use the "Quick list" box (e.g. 350-5 351-5) or the "+ Add row" button.
