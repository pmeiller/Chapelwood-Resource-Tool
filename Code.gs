// ─────────────────────────────────────────────────────────────────────────────
// Chapelwood Resource Sheet — Google Apps Script  Rev 9
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO DEPLOY:
//   1. Open your Google Sheet
//   2. Click Extensions → Apps Script
//   3. Replace ALL existing code with this file
//   4. Click Save  (floppy disk icon)
//   5. Reload the Google Sheet — a "📋 Resources" menu will appear
//   6. Use  Resources → 🔑 Set GitHub Token  the first time
//   7. The sheet auto-pulls resources.json on every open
//
// TOKEN SCOPE NEEDED:
//   Fine-grained PAT → Contents: Read and write   (for the Chapelwood-Resource-Tool repo)
//   Classic PAT      → repo scope
// ─────────────────────────────────────────────────────────────────────────────

var RESOURCES_JSON_URL = 'https://pmeiller.github.io/Chapelwood-Resource-Tool/resources.json';
var GITHUB_OWNER  = 'pmeiller';
var GITHUB_REPO   = 'Chapelwood-Resource-Tool';
var GITHUB_FILE   = 'resources.json';
var GITHUB_BRANCH = 'main';

var HEADERS = [
  'Resource Name', 'Organization Name', 'Program Name (If Applicable)',
  'Resource Type', 'Resource SubType', 'Hot List?', 'Public Access?',
  'Resource Description', 'Eligibility', 'Address', 'Public Phone Number',
  'Public Email', 'Public Website', 'Hours', 'Walk-ins?', 'Languages',
  'Application', 'Other Info', 'Duplicate?', 'Verified'
];

// ── Colors ──────────────────────────────────────────────────────────────────
var COLOR_CLEAN   = '#1a1a2e';  // dark navy  — header when published / in sync
var COLOR_DIRTY   = '#b71c1c';  // deep red   — header when unpublished changes exist
var COLOR_PULLING = '#1565c0';  // blue       — header while pulling

// ── Property keys ────────────────────────────────────────────────────────────
var PROP_DIRTY     = 'cw_dirty';       // 'true' / 'false'
var PROP_LAST_PULL = 'cw_last_pull';   // ISO timestamp of last successful pull
var PROP_TOKEN     = 'cw_github_token'; // stored in UserProperties (per-user)

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────

function onOpen() {
  buildMenu();

  var dirty = isDirty();
  if (dirty) {
    var ui = SpreadsheetApp.getUi();
    var resp = ui.alert(
      '⚠️  Unpublished Changes',
      'This sheet has changes that have NOT been published to resources.json.\n\n' +
      'What would you like to do?\n\n' +
      '  • YES  — Pull fresh data from GitHub (your local edits will be lost)\n' +
      '  • NO   — Keep your local edits (publish them using  📋 Resources → Publish)',
      ui.ButtonSet.YES_NO
    );
    if (resp === ui.Button.YES) {
      pullFromGitHub(true);
    }
    // If NO: do nothing — leave the dirty state, keep edits
  } else {
    pullFromGitHub(true);
  }
}

function onEdit(e) {
  // Only track edits to data rows (row > 1) on the first sheet
  var sheet = e.range.getSheet();
  if (sheet.getIndex() !== 1) return;
  if (e.range.getRow() < 2)   return;

  setDirty(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU
// ─────────────────────────────────────────────────────────────────────────────

function buildMenu() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Resources')
    .addItem('↓  Pull from GitHub (overwrites sheet)', 'pullFromGitHubConfirmed')
    .addSeparator()
    .addItem('↑  Publish to GitHub', 'publishToGitHub')
    .addSeparator()
    .addItem('🔑  Set GitHub Token', 'promptForToken')
    .addItem('ℹ️   Check Status', 'showStatus')
    .addToUi();
}

// ─────────────────────────────────────────────────────────────────────────────
// PULL — reads resources.json and writes to the sheet
// ─────────────────────────────────────────────────────────────────────────────

// Called from the menu — confirms before overwriting dirty data
function pullFromGitHubConfirmed() {
  if (isDirty()) {
    var resp = SpreadsheetApp.getUi().alert(
      '⚠️  Discard Unpublished Changes?',
      'You have unpublished changes. Pulling will OVERWRITE them with the current GitHub data.\n\nContinue?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );
    if (resp !== SpreadsheetApp.getUi().Button.YES) return;
  }
  pullFromGitHub(false);
}

// silent=true suppresses the success toast (used on auto-pull at open)
function pullFromGitHub(silent) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];

  setHeaderColor(COLOR_PULLING);
  ss.toast('Pulling from GitHub…', '📋 Resources', -1);

  try {
    var resp      = UrlFetchApp.fetch(RESOURCES_JSON_URL + '?t=' + new Date().getTime());
    var resources = JSON.parse(resp.getContentText());

    if (!Array.isArray(resources) || resources.length === 0) {
      throw new Error('resources.json returned empty or invalid data.');
    }

    // Wipe existing content, write headers + data
    sheet.clearContents();
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

    var rows = resources.map(function(r) {
      return HEADERS.map(function(h) {
        return (r[h] === null || r[h] === undefined) ? '' : String(r[h]);
      });
    });
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);

    // Freeze header row, auto-resize columns
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);

    setDirty(false);
    PropertiesService.getDocumentProperties()
      .setProperty(PROP_LAST_PULL, new Date().toISOString());

    ss.toast('✅  Pulled ' + resources.length + ' resources.', '📋 Resources', 4);

  } catch (err) {
    setHeaderColor(isDirty() ? COLOR_DIRTY : COLOR_CLEAN);
    SpreadsheetApp.getUi().alert('Pull failed:\n\n' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH — writes sheet data back to resources.json on GitHub
// ─────────────────────────────────────────────────────────────────────────────

function publishToGitHub() {
  var token = getToken();
  if (!token) {
    SpreadsheetApp.getUi().alert(
      'No GitHub Token',
      'Set your Personal Access Token first via:\n📋 Resources → 🔑 Set GitHub Token',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data  = sheet.getDataRange().getValues();

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('Nothing to publish — the sheet is empty.');
    return;
  }

  var sheetHeaders = data[0];
  var resources = data.slice(1)
    .map(function(row) {
      var obj = {};
      sheetHeaders.forEach(function(h, i) {
        var v = row[i];
        obj[h] = (v === '' || v === null || v === undefined) ? null : String(v);
      });
      return obj;
    })
    .filter(function(r) {
      return r['Resource Name'] || r['Organization Name'];
    });

  ss.toast('Publishing to GitHub…', '📋 Resources', -1);

  var apiBase = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' +
                GITHUB_REPO + '/contents/' + GITHUB_FILE;

  try {
    // Step 1 — get current SHA
    var shaResp = UrlFetchApp.fetch(apiBase + '?ref=' + GITHUB_BRANCH, {
      headers: githubHeaders(token),
      muteHttpExceptions: true
    });
    if (shaResp.getResponseCode() === 401 || shaResp.getResponseCode() === 403) {
      clearToken();
      throw new Error('GitHub auth failed (' + shaResp.getResponseCode() +
        '). Token cleared — set a new one via 🔑 Set GitHub Token.');
    }
    if (shaResp.getResponseCode() !== 200) {
      var shaErr = JSON.parse(shaResp.getContentText());
      throw new Error('GitHub ' + shaResp.getResponseCode() + ': ' + (shaErr.message || 'unknown'));
    }
    var sha = JSON.parse(shaResp.getContentText()).sha;

    // Step 2 — push updated file
    var jsonStr  = JSON.stringify(resources, null, 2);
    var encoded  = Utilities.base64Encode(jsonStr, Utilities.Charset.UTF_8);
    var stamp    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');

    var pushResp = UrlFetchApp.fetch(apiBase, {
      method: 'PUT',
      headers: githubHeaders(token),
      payload: JSON.stringify({
        message: 'Publish from Sheet: ' + resources.length + ' resources — ' + stamp,
        content: encoded,
        sha: sha,
        branch: GITHUB_BRANCH
      }),
      muteHttpExceptions: true
    });

    var code = pushResp.getResponseCode();
    if (code !== 200 && code !== 201) {
      var pushErr = JSON.parse(pushResp.getContentText());
      throw new Error('GitHub ' + code + ': ' + (pushErr.message || 'unknown'));
    }

    setDirty(false);
    ss.toast('☁️  Published ' + resources.length + ' resources. Live in ~30 sec.', '📋 Resources', 6);

  } catch (err) {
    SpreadsheetApp.getUi().alert('Publish failed:\n\n' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function promptForToken() {
  var ui     = SpreadsheetApp.getUi();
  var result = ui.prompt(
    '🔑  Set GitHub Token',
    'Paste your Personal Access Token.\n\n' +
    'Fine-grained: Contents → Read and write\n' +
    'Classic:      repo scope\n\n' +
    'Token is stored per-user and never visible in the sheet.',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() === ui.Button.OK) {
    var t = result.getResponseText().trim();
    if (t) {
      PropertiesService.getUserProperties().setProperty(PROP_TOKEN, t);
      ui.alert('Token saved ✅\n\nYou can now use "Publish to GitHub".');
    }
  }
}

function getToken()  { return PropertiesService.getUserProperties().getProperty(PROP_TOKEN) || ''; }
function clearToken(){ PropertiesService.getUserProperties().deleteProperty(PROP_TOKEN); }

// ─────────────────────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────────────────────

function showStatus() {
  var dirty    = isDirty();
  var lastPull = PropertiesService.getDocumentProperties().getProperty(PROP_LAST_PULL);
  var hasToken = !!getToken();

  var lastPullStr = lastPull
    ? Utilities.formatDate(new Date(lastPull), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a')
    : 'Never';

  SpreadsheetApp.getUi().alert(
    'ℹ️  Resource Sheet Status',
    'Unpublished changes:  ' + (dirty ? 'YES ⚠️' : 'No ✅') + '\n' +
    'Last pull from GitHub:  ' + lastPullStr + '\n' +
    'GitHub token stored:  ' + (hasToken ? 'Yes ✅' : 'No ❌'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRTY STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isDirty() {
  return PropertiesService.getDocumentProperties().getProperty(PROP_DIRTY) === 'true';
}

function setDirty(flag) {
  PropertiesService.getDocumentProperties().setProperty(PROP_DIRTY, flag ? 'true' : 'false');
  setHeaderColor(flag ? COLOR_DIRTY : COLOR_CLEAN);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function setHeaderColor(color) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var range = sheet.getRange(1, 1, 1, HEADERS.length);
    range.setBackground(color)
         .setFontColor('#ffffff')
         .setFontWeight('bold');
  } catch(e) { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB API HEADERS
// ─────────────────────────────────────────────────────────────────────────────

function githubHeaders(token) {
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}
