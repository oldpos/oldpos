/* Old POS config — OAuth Client ID for Google Sign-In.
   Client ID is not secret (it lives in the browser). Never put Client SECRET here or on GitHub. */
window.PROPOS_CONFIG = {
  googleClientId: '984274944481-2aeko6a7j35s1ghb0lpe9i4sntfc17hr.apps.googleusercontent.com'
  ,
  // User counter (Google Apps Script + Google Sheet): paste your web-app URL (ends with /exec). Steps: tools/SETUP-bn.md
  userCounterApi: 'https://script.google.com/macros/s/AKfycbyc36Tx2D7Y7G7RZPzpIxp0ENY7QZN0JK0teddrDWU4DSUIzgXKQ5F9wXZtf7EhBINZ/exec',
  // Added to the total. Put the number you show today here (e.g. 1250) so counting continues from it.
  userCountOffset: 0
};
