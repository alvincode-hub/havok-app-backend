function getCurrentDate() {
  return new Date();
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000);
}

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
}

function isDateLive(beginTime, endTime) {
  const now = getCurrentDate();

  const start = new Date(beginTime);
  const end = addMinutes(new Date(endTime), 25);

  return now >= start && now <= end;
}

function isDateSoon(beginTime) {
  const now = getCurrentDate();
  const start = new Date(beginTime);

  return start > now && start <= addDays(now, 7);
}

function isInDelay(beginTime) {
  const now = getCurrentDate();
  const start = new Date(beginTime);

  const minDate = addDays(now, -30);
  const maxDate = addDays(now, 30);

  return start >= minDate && start <= maxDate;
}

function isOlderThan15Days(dateToCheck) {
  const now = getCurrentDate();
  const checkDate = new Date(dateToCheck);
  const fifteenDaysAgo = addDays(now, -15);

  return checkDate < fifteenDaysAgo;
}

function isFinish(dateToCheck) {
  const now = getCurrentDate();
  const date = new Date(dateToCheck);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date < now;
}

module.exports = {
  getCurrentDate,
  formatDate,
  addMinutes,
  addDays,
  isDateLive,
  isDateSoon,
  isInDelay,
  isOlderThan15Days,
  isFinish
};