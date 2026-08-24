const { DECIMALS } = require('./currencies');

function decimalsFor(currency) {
  const d = DECIMALS[currency];
  if (d === undefined) throw new Error(`Unknown currency: ${currency}`);
  return d;
}

function toMinor(amountStr, currency) {
  const decimals = decimalsFor(currency);
  const str = String(amountStr).trim();
  const negative = str.startsWith('-');
  const unsigned = negative ? str.slice(1) : str;
  const [whole, frac = ''] = unsigned.split('.');
  if (frac.length > decimals) {
    throw new Error(`${amountStr} has more precision than ${currency} allows (${decimals}dp)`);
  }
  const paddedFrac = frac.padEnd(decimals, '0');
  const minor = Number(whole || '0') * 10 ** decimals + Number(paddedFrac || '0');
  return negative ? -minor : minor;
}

function formatMinor(minor, currency) {
  const decimals = decimalsFor(currency);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const scale = 10 ** decimals;
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

function divRoundHalfUp(numerator, denominator) {
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  const quotient = Math.floor(n / denominator);
  const remainder = n % denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return sign * rounded;
}

module.exports = { decimalsFor, toMinor, formatMinor, divRoundHalfUp };
