export function determineCauseByKeywords(descriptionText: string, headerText: string) {
  const lowerDesc = (descriptionText || "").toLowerCase();
  const lowerHeader = (headerText || "").toLowerCase();
  const fullText = lowerDesc + " " + lowerHeader;
  
  if (fullText.includes("secours") || fullText.includes("ambulance") || fullText.includes("blessé") || fullText.includes("médical") || fullText.includes("malaise")) {
    return "MEDICAL_EMERGENCY";
  }
  
  if (fullText.includes("police") || fullText.includes("gendarmerie") || fullText.includes("sécurité") || 
      fullText.includes("interpellation") || fullText.includes("contrôle")) {
    return "POLICE_ACTIVITY";
  }
  
  if (fullText.includes("panne") || fullText.includes("technique") || fullText.includes("défaillance") || 
      fullText.includes("incident tech") || fullText.includes("incident d'exploitation")) {
    return "TECHNICAL_PROBLEM";
  }
  
  if (fullText.includes("travaux") || fullText.includes("chantier") || fullText.includes("aménagement")) {
    return "CONSTRUCTION";
  }
  
  if (fullText.includes("maintenance") || fullText.includes("entretien") || fullText.includes("réparation")) {
    return "MAINTENANCE";
  }
  
  if (fullText.includes("accident") || fullText.includes("collision") || fullText.includes("accrochage") || 
      fullText.includes("véhicule sur la voie")) {
    return "ACCIDENT";
  }
  
  if (fullText.includes("grève") || fullText.includes("social") || fullText.includes("mouvement social")) {
    return "STRIKE";
  }
  
  if (fullText.includes("manifestation") || fullText.includes("cortège") || fullText.includes("rassemblement") || 
      fullText.includes("défilé") || fullText.includes("marche")) {
    return "DEMONSTRATION";
  }
  
  if (fullText.includes("neige") || fullText.includes("pluie") || fullText.includes("météo") || 
      fullText.includes("tempête") || fullText.includes("vent") || fullText.includes("intempérie") || 
      fullText.includes("orage") || fullText.includes("inondation")) {
    return "WEATHER";
  }
  
  if (fullText.includes("fête") || fullText.includes("festival") || fullText.includes("événement") || 
      fullText.includes("férié")) {
    return "HOLIDAY";
  }
  
  return "OTHER_CAUSE";
}