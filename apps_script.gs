/**
 * Google Apps Script backend for uploading audio into YOUR Google Drive folder.
 *
 * 1) Create a new Apps Script project.
 * 2) Paste this entire file.
 * 3) Set FOLDER_ID below (recommended) OR leave it blank to auto-create a folder named 'DialectAudio' in your root Drive.
 * 4) Deploy -> New deployment -> Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5) Copy the Web App URL into app.js: DRIVE_UPLOAD_ENDPOINT
 */

const FOLDER_ID = "";              // <- paste your target folder ID here (optional)
const FALLBACK_FOLDER_NAME = "DialectAudio";

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? e.postData.contents : "";
    const payload = JSON.parse(body);

    const entryId = String(payload.entryId || "unknown");
    const filename = String(payload.filename || "audio.webm");
    const mimeType = String(payload.mimeType || "audio/webm");
    const dataBase64 = String(payload.dataBase64 || "");

    if (!dataBase64) {
      return jsonOut({ ok:false, error:"Missing dataBase64" });
    }

    const bytes = Utilities.base64Decode(dataBase64);
    const blob = Utilities.newBlob(bytes, mimeType, filename);

    const folder = getTargetFolder_();
    const file = folder.createFile(blob);

    // Optional: add some metadata into description
    file.setDescription("Dialect dict upload. entryId=" + entryId);

    return jsonOut({
      ok: true,
      fileId: file.getId(),
      fileName: file.getName(),
      // Link type depends on your Drive sharing settings. This is a standard view URL:
      viewUrl: "https://drive.google.com/file/d/" + file.getId() + "/view"
    });

  } catch (err) {
    return jsonOut({ ok:false, error: String(err) });
  }
}

function getTargetFolder_() {
  if (FOLDER_ID) {
    return DriveApp.getFolderById(FOLDER_ID);
  }
  // auto-create/find folder by name in root
  const it = DriveApp.getRootFolder().getFoldersByName(FALLBACK_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.getRootFolder().createFolder(FALLBACK_FOLDER_NAME);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
