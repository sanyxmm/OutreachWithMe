// Paste this into the Apps Script project bound to your target Google Sheet
// (Extensions > Apps Script). Deploy > New deployment > Web app, with
// "Execute as: Me" and "Who has access: Anyone". Copy the resulting /exec URL
// into the Referral Launchpad tab's "Google Sheet Web App URL" field.
//
// Anyone with the deployed URL can append rows to this sheet, so keep it
// private (don't post it publicly) and redeploy with a new URL if it leaks.

var SHEET_NAME = "Outreach"; // change to match your tab's name

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var headers = payload.headers || [];
    var rows = payload.rows || [];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0 && headers.length > 0) {
      sheet.appendRow(headers);
    }

    rows.forEach(function (row) {
      sheet.appendRow(row);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, appended: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
