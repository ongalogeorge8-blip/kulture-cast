/* Calendar-day countdown for East Africa Time (UTC+03:00). No network or storage. */
(function () {
  'use strict';
  var output = document.getElementById('kc-christmas-countdown');
  if (!output) return;
  function update() {
    var eastAfrica = new Date(Date.now() + 3 * 60 * 60 * 1000);
    var year = eastAfrica.getUTCFullYear();
    var month = eastAfrica.getUTCMonth();
    var day = eastAfrica.getUTCDate();
    var today = Date.UTC(year, month, day);
    var christmas = Date.UTC(year, 11, 25);
    if (today > christmas) christmas = Date.UTC(year + 1, 11, 25);
    var days = Math.round((christmas - today) / 86400000);
    output.textContent = days === 0 ? 'Merry Christmas! Today is Christmas Day.' : days + (days === 1 ? ' day' : ' days') + ' until Christmas';
  }
  update();
  setInterval(update, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) update(); });
  window.addEventListener('focus', update);
}());
