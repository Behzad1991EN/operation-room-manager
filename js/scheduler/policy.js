export const SEARCH_STAGES = Object.freeze([
  { id: 'preferred', label: 'One fixed shift per day; no senior fixed holiday shifts', seniorHolidays: false, doubles: false },
  { id: 'senior-holidays', label: 'Senior holiday shifts allowed; one fixed shift per day', seniorHolidays: true, doubles: false },
  { id: 'junior-doubles', label: 'Shortage: double fixed shifts allowed for 0–4 years', seniorHolidays: true, doubles: true },
]);
export const stagePolicy = id => SEARCH_STAGES.find(stage => stage.id === (id ?? 'preferred'));
