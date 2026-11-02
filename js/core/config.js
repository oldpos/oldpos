/* Old POS config — OAuth Client ID for Google Sign-In.
   Client ID is not secret (it lives in the browser). Never put Client SECRET here or on GitHub. */
window.PROPOS_CONFIG = {
  googleClientId: '984274944481-2aeko6a7j35s1ghb0lpe9i4sntfc17hr.apps.googleusercontent.com'
  ,
  // User counter (Google Apps Script + Google Sheet) — web-app URL (ends with /exec). Steps: tools/SETUP-bn.md
  userCounterApi: 'https://script.google.com/macros/s/AKfycby96ukVVeFhhcwZTmVtbpHSgLU7TGPc-WYxsSpOYUUwwIvMlyvTx2rcJFKWMo-gD_5J/exec',
  // Kept at 0: the counter starts again from zero (v12.3.0). Nothing is added to the total.
  userCountOffset: 0
};
