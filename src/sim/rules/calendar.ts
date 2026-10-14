// The calendar as the UI reads it (src/ui imports only sim/rules and sim/types): eight days to a
// quarter and four quarters to a year (D25). The sim keys everything by the day since founding; the
// year, quarter and day of the quarter are derived from it, never stored.
export { calendarOfDay } from '../core/calendar';
export { DAYS_PER_QUARTER, QUARTERS_PER_YEAR } from '../config/time';
