function myFunction() {
  Logger.log("Hello");
  Logger.log("MissuBee");
  Logger.log("Hello MissuBee");
  SpreadsheetApp.getActiveSheet().getRange("A1").setValue("Hello MissuBee");
}
