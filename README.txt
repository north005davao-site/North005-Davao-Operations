NORTH005 DAVAO ERP - FILES
Upload ALL of these to GitHub (replace the old ones): index.html, favicon.ico, manifest.webmanifest, app.js, modules.js, sales.js, ca.js, rentals.js, dash.js, attendance.js, docs.js, orgchart.js, thermal.js, and the assets folder.
Vercel redeploys automatically. Then hard-refresh the site (Ctrl+Shift+R) or clear site data on your phone.

FIRST-TIME SETUP FOR SALES & COLLECTION (Administrator)
1. MASTER REGISTRY > Upload Masterlist (Excel)
2. MASTER REGISTRY > Import Areas (Excel report): choose your current DDN or SAMAL report; sets each outlet's collector. Do it once for each file.
3. SALES & COLLECTION > Import Accounting File (Excel) every day.
AI HANDWRITING READER (Thermal Paper) - one-time setup
1. Create an API key at console.anthropic.com (pay-as-you-go).
2. Supabase dashboard > Edge Functions > Secrets > add ANTHROPIC_API_KEY.
3. In THERMAL PAPER DAILY SUMMARY, upload a photo and press "Read handwriting with AI".
