const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' });
export const MONTHS = ['Farvardin · فروردین', 'Ordibehesht · اردیبهشت', 'Khordad · خرداد', 'Tir · تیر', 'Mordad · مرداد', 'Shahrivar · شهریور', 'Mehr · مهر', 'Aban · آبان', 'Azar · آذر', 'Dey · دی', 'Bahman · بهمن', 'Esfand · اسفند'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY = 86400000;
const starts = new Map();
export function persianParts(date = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}
function yearStart(year) {
  if (!Number.isInteger(year) || year < 1300 || year > 1501) throw new Error('Choose a Persian year from 1300 to 1500.');
  if (starts.has(year)) return starts.get(year);
  for (let offset = 0; offset < 8; offset++) {
    const time = Date.UTC(year + 621, 2, 18 + offset);
    const p = persianParts(new Date(time));
    if (p.year === year && p.month === 1 && p.day === 1) { starts.set(year, time); return time; }
  }
  throw new Error('This browser could not resolve the Persian calendar.');
}
export function monthKey(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }
export function previousMonth(year, month) { return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }; }
export function createCalendar(year, month, officialHolidays = []) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || year > 1500) throw new Error('Invalid Persian month or year.');
  const start = yearStart(year) + (month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30) * DAY;
  const length = month <= 6 ? 31 : month < 12 ? 30 : Math.round((yearStart(year + 1) - start) / DAY);
  const selected = new Set(officialHolidays);
  return Array.from({ length }, (_, i) => {
    const date = new Date(start + i * DAY);
    const dayNumber = i + 1;
    const key = `${monthKey(year, month)}-${String(dayNumber).padStart(2, '0')}`;
    const dayOfWeek = date.getUTCDay();
    const isFriday = dayOfWeek === 5;
    const isOfficialHoliday = selected.has(key);
    return { date: key, isoDate: date.toISOString().slice(0, 10), dayNumber, dayOfWeek, isFriday, isOfficialHoliday, isHoliday: isFriday || isOfficialHoliday };
  });
}
export const monthLabel = (year, month) => `${MONTHS[month - 1]} ${year}`;
