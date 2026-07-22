const bangladeshTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Dhaka',
});

export const formatBangladeshTime = (date = new Date()) =>
  bangladeshTimeFormatter.format(date);
