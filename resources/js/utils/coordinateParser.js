/**
 * Utility for parsing and converting coordinates between Google Earth DMS (Degrees, Minutes, Seconds)
 * and Google Maps Decimal format.
 */

/**
 * Converts a single DMS coordinate string or decimal string into a float decimal number.
 * Examples supported:
 *  - "0°47'5.96\"S" or "0°47'5.96\"LS" -> -0.784989
 *  - "100°39'15.87\"T" or "100°39'15.87\"BT" or "100°39'15.87\"E" -> 100.654408
 *  - "-0.784989" -> -0.784989
 */
export function dmsToDecimal(input) {
  if (input == null) return null;
  const str = String(input).trim();
  if (!str) return null;

  // 1. Direct Decimal Check
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const val = parseFloat(str);
    return isNaN(val) ? null : val;
  }

  // 2. DMS Regex pattern
  // Matches: degrees (0° / 0 deg), minutes (47' / 47m), seconds (5.96" / 5.96s), direction (S/N/E/W/LS/LU/BT/BB/T)
  const regex = /(\d+)\s*[°deg\s]+\s*(\d+)\s*['m\s]+\s*([\d.]+)\s*["''”″\s]*\s*([A-Za-z]+)?/i;
  const match = str.match(regex);

  if (!match) {
    // Fallback: try parsing as simple float if any trailing chars exist
    const cleaned = str.replace(/[^\d.-]/g, '');
    const fallbackVal = parseFloat(cleaned);
    return isNaN(fallbackVal) ? null : fallbackVal;
  }

  const deg = parseFloat(match[1]) || 0;
  const min = parseFloat(match[2]) || 0;
  const sec = parseFloat(match[3]) || 0;
  const dir = (match[4] || '').toUpperCase();

  let dec = deg + (min / 60) + (sec / 3600);

  // South (S / LS) or West (W / BB) implies negative coordinate
  if (dir.includes('S') || dir.includes('LS') || dir.includes('W') || dir.includes('BB')) {
    dec = -dec;
  }

  return dec;
}

/**
 * Converts decimal Lat and Lng to Google Earth DMS string format.
 * Example:
 *  lat: -0.784989 -> "0°47'5.96\"S"
 *  lng: 100.654408 -> "100°39'15.87\"T"
 */
export function decimalToDms(lat, lng) {
  const toDms = (val, isLat) => {
    if (val == null || isNaN(parseFloat(val))) return '';
    const num = parseFloat(val);
    const absVal = Math.abs(num);

    const deg = Math.floor(absVal);
    const minFloat = (absVal - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);

    let dir = '';
    if (isLat) {
      dir = num < 0 ? 'S' : 'N';
    } else {
      dir = num < 0 ? 'W' : 'T'; // 'T' for Timur (East) as in Indonesian Google Earth Pro
    }

    return `${deg}°${min}'${sec}"${dir}`;
  };

  return {
    dmsLat: toDms(lat, true),
    dmsLng: toDms(lng, false),
    formattedDms: `${toDms(lat, true)} ${toDms(lng, false)}`.trim()
  };
}

/**
 * Parses either combined text (e.g. "-0.784989, 100.654408", "-0.784989 100.654408", Google Maps URL, or DMS)
 * or separate lat / lng strings.
 */
export function parseCoordsInput(latOrCombined, lngInput = '') {
  let raw = String(latOrCombined ?? '').trim();
  let lngStr = String(lngInput ?? '').trim();

  if (!raw && !lngStr) {
    return { lat: null, lng: null, isValid: false, dmsLat: '', dmsLng: '', formattedDms: '' };
  }

  // 1. Check if user pasted a Google Maps / Earth URL (e.g. @-0.785123,100.654123 or ?q=-0.785123,100.654123)
  if (raw.includes('http://') || raw.includes('https://') || raw.includes('maps.google') || raw.includes('earth.google')) {
    const urlMatch = raw.match(/([+-]?\d+\.\d+)[,\s]+([+-]?\d+\.\d+)/);
    if (urlMatch) {
      const lat = parseFloat(urlMatch[1]);
      const lng = parseFloat(urlMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return {
          lat,
          lng,
          isValid: true,
          ...decimalToDms(lat, lng)
        };
      }
    }
  }

  let latStr = raw;

  // 2. If passed as single comma-separated combined string
  if (!lngStr && latStr.includes(',')) {
    const parts = latStr.split(',');
    latStr = parts[0];
    lngStr = parts.slice(1).join(',');
  } else if (!lngStr) {
    // 3. Check for two decimal numbers separated by whitespace e.g. "-0.784989 100.654408"
    const spaceDecMatch = latStr.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (spaceDecMatch) {
      latStr = spaceDecMatch[1];
      lngStr = spaceDecMatch[2];
    } else {
      // 4. Check for two DMS parts separated by space (e.g. 0°47'5.96"S 100°39'15.87"T)
      const dmsPairMatch = latStr.match(/^(.+?[NSEWLSBLUT])\s+(.+?[NSEWLSBLUT])$/i);
      if (dmsPairMatch) {
        latStr = dmsPairMatch[1];
        lngStr = dmsPairMatch[2];
      }
    }
  }

  const lat = dmsToDecimal(latStr);
  const lng = dmsToDecimal(lngStr);

  const isValid = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  return {
    lat: isValid ? lat : null,
    lng: isValid ? lng : null,
    isValid,
    ...(isValid ? decimalToDms(lat, lng) : { dmsLat: '', dmsLng: '', formattedDms: '' })
  };
}
