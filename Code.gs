// ─────────────────────────────────────────────────────────────────────────────
// Chapelwood Resource Finder — Google Apps Script Web Endpoint
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO DEPLOY:
//   1. Open your Google Sheet
//   2. Click Extensions → Apps Script
//   3. Delete any existing code and paste this entire file
//   4. Click Save (floppy disk icon)
//   5. Click Deploy → New deployment
//   6. Click the gear icon next to "Select type" → choose "Web app"
//   7. Set:
//        Description:  Chapelwood Resource Writer
//        Execute as:   Me (your Google account)
//        Who has access: Anyone
//   8. Click Deploy → Authorize access → Allow
//   9. Copy the Web app URL — paste it into chapelwood-admin.html as SCRIPT_URL
//
// To update the script later: Deploy → Manage deployments → edit the existing
// deployment (don't create a new one, or the URL will change).
// ─────────────────────────────────────────────────────────────────────────────

// !! IMPORTANT: paste your Google Sheet ID here (the long string from the URL)
// e.g. https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
var SPREADSHEET_ID = '1d7gDUulw6TvgbM4XozKZEdAKexXLws0Xv88CVwPDBgQ';

var SHEET_NAME = 'Sheet1'; // Change if your tab has a different name

var HEADERS = [
  'Resource Name',
  'Organization Name',
  'Program Name (If Applicable)',
  'Resource Type',
  'Public Access?',
  'Resource Description',
  'Eligibility',
  'Address',
  'Public Phone Number',
  'Public Email',
  'Public Website',
  'Hours',
  'Walk-ins?',
  'Languages',
  'Application',
  'Other Info',
  'Duplicate?',
  'Verified'
];

// Field keys match the full header names used in the admin tool's data objects
var FIELD_KEYS = [
  'Resource Name',
  'Organization Name',
  'Program Name (If Applicable)',
  'Resource Type',
  'Public Access?',
  'Resource Description',
  'Eligibility',
  'Address',
  'Public Phone Number',
  'Public Email',
  'Public Website',
  'Hours',
  'Walk-ins?',
  'Languages',
  'Application',
  'Other Info',
  'Duplicate?',
  'Verified'
];

// ── Handle GET (health check / CORS preflight via redirect) ──────────────────
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById('1d7gDUulw6TvgbM4XozKZEdAKexXLws0Xv88CVwPDBgQ');
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
    var headers = data[0];
    var rows = data.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i] === '' ? null : String(row[i]); });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Handle POST (write resources to sheet) ───────────────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Support both { resources: [...] } and a bare array
    var records = Array.isArray(payload) ? payload : payload.resources;

    if (!records || !Array.isArray(records)) {
      return jsonResponse({ success: false, error: 'No resources array found in payload.' });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Use first sheet regardless of tab name
    var sheet = ss.getSheets()[0];
    var sheetName = sheet.getName();

    // Always write header row first
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

    // Clear all existing data rows
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
    }

    // Build rows from records using full header names as keys
    var rows = records.map(function(r) {
      return FIELD_KEYS.map(function(key) {
        var val = r[key];
        return (val === undefined || val === null) ? '' : String(val);
      });
    });

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }

    // Force flush
    SpreadsheetApp.flush();

    return jsonResponse({ success: true, written: rows.length, sheetName: sheetName, firstRecord: records[0]['Resource Name'] || 'unknown' });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
