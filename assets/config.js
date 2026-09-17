// Shared endpoints used by both the public catalog and the admin page.
window.SITE_CONFIG = {
  // Publish to web > CSV URL for the price list sheet (see README "One-time setup").
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAlMorq-Qm00CunOdRydhqFnABThudytc-OkFPD4SmXsEi-_BYiCbNIWpPj0ENNCK0KD5BgrMkxyKo/pub?output=csv",

  // Apps Script Web App URL (ends in /exec) — see README "Order tracking"
  // and "Admin page" sections. Handles public order submission plus
  // password-gated product/order management.
  API_URL: "https://script.google.com/macros/s/AKfycbwE24vSsmdBhP8S_qeMPqx2Ocp88HVqdnEd8EtI27mWlXhCS65j5imX9vIU0-TbwkMP1A/exec"
};
