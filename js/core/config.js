/* Old POS config — OAuth Client ID for Google Sign-In.
   Client ID is not secret (it lives in the browser). Never put Client SECRET here or on GitHub. */
window.PROPOS_CONFIG = {
  googleClientId: '984274944481-2aeko6a7j35s1ghb0lpe9i4sntfc17hr.apps.googleusercontent.com'
  ,
  // User counter (Google Apps Script + Google Sheet) — web-app URL (ends with /exec). Steps: tools/SETUP-bn.md
  userCounterApi: 'https://script.google.com/macros/s/AKfycbyfV86pxAWls1s9h2LaRFCUvDfBvvN_n5wL-jFzBpgj_eo6VA2jlAuV0dJdGyaKDRGI/exec',
  // Kept at 0: the counter starts again from zero (v12.3.0). Nothing is added to the total.
  userCountOffset: 0
};
