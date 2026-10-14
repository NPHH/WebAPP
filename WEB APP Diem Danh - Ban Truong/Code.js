function sum() {
  
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Bài 5 - Array và Object");
    
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
