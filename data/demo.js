// Entirely fictional staff. Loaded only after the user chooses the demo action.
export const demoEmployees = Array.from({ length: 16 }, (_, i) => ({
  id: `demo-${i + 1}`,
  name: `Demo employee ${String(i + 1).padStart(2, '0')}`,
  yearsOfService: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 3, 6][i],
  radiationBenefit: i >= 12,
  productivityCategory: ['0–4', '0–4', '0–4', '4–8', '4–8', '4–8', '4–8', '8–12', '8–12', '8–12', '8–12', '12–16', '12–16', '16+', '0–4', '4–8'][i],
}));
